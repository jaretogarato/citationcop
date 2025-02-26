// o3-reference-verification-service.ts
import type { Reference } from '@/app/types/reference'

type ProcessStatus = 'pending' | 'complete' | 'error'

type ProcessState = {
  status: ProcessStatus
  messages?: any[]
  iteration?: number
  result?: any
  error?: string
  functionResult?: string
  lastToolCallId?: string
}

type VerifiedReference = {
  reference: Reference
  status: ProcessStatus
  result?: any
}

// Configuration options to make service behavior more configurable
interface ServiceConfig {
  maxRetries?: number
  requestTimeout?: number
  maxIterations?: number
  batchSize?: number
}

export class o3ReferenceVerificationService {
  private config: Required<ServiceConfig>

  constructor(config?: ServiceConfig) {
    // Default configuration with sensible values
    this.config = {
      maxRetries: 3,
      requestTimeout: 30000, // 30 seconds
      maxIterations: 5,
      batchSize: 5,
      ...config
    }
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController()
    const { signal } = controller

    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal
      })

      return response
    } finally {
      clearTimeout(timeoutId)
    }
  }

  private async retryableFetch(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    let lastError: Error | null = null
    let lastResponse: Response | null = null

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        // Exponential backoff for retries
        if (attempt > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * Math.pow(2, attempt - 1))
          )
        }

        const response = await this.fetchWithTimeout(
          url,
          options,
          this.config.requestTimeout
        )
        lastResponse = response

        // For URL verification, we want to return the response even if it's not OK
        // so we can analyze the status code
        if (url.includes('/api/fetch-url')) {
          return response
        }

        // For other endpoints, we'll still require OK status
        if (!response.ok) {
          const errorText = await response
            .text()
            .catch(() => 'No error details available')
          throw new Error(
            `HTTP error ${response.status}: ${response.statusText}. Details: ${errorText}`
          )
        }

        return response
      } catch (error) {
        console.error(
          `Attempt ${attempt + 1}/${this.config.maxRetries} failed:`,
          error
        )
        lastError = error instanceof Error ? error : new Error(String(error))

        // Don't retry if it was an abort error (timeout)
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new Error(
            `Request timed out after ${this.config.requestTimeout}ms`
          )
        }
      }
    }

    // If we're checking a URL and we have a response with a status code, return it
    // even if it's an error status
    if (
      options.body &&
      typeof options.body === 'string' &&
      options.body.includes('/api/fetch-url') &&
      lastResponse
    ) {
      return lastResponse
    }

    throw lastError || new Error('All retry attempts failed')
  }

  private async checkDOI(doi: string, title: string) {
    try {
      const response = await this.retryableFetch('/api/references/verify-doi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ references: [{ DOI: doi, title }] })
      })

      return await response.json()
    } catch (error) {
      console.error('Error checking DOI:', error)
      return {
        error: `Failed to verify DOI: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }

  private async searchReference(reference: string) {
    try {
      const response = await this.retryableFetch(
        '/api/references/verify-search',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference })
        }
      )

      return await response.json()
    } catch (error) {
      console.error('Error searching reference:', error)
      return {
        error: `Failed to search reference: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }

  private async checkURL(url: string, reference: string) {
    try {
      const response = await this.retryableFetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })

      return await response.json()
    } catch (error) {
      console.error('Error checking URL:', error)
      // Return a structured error object that the LLM can understand
      // Rather than throwing, we return information about the broken URL
      return {
        error: `Failed to access URL: ${error instanceof Error ? error.message : String(error)}`,
        statusCode:
          error instanceof Error && 'statusCode' in error
            ? error.statusCode
            : 500,
        isURLBroken: true,
        message:
          'The URL appears to be broken or inaccessible. This likely indicates an invalid citation URL.'
      }
    }
  }

  public async verifyReference(
    reference: Reference,
    onUpdate?: (state: ProcessState) => void
  ): Promise<VerifiedReference> {
    // Validate input
    if (!reference) {
      return {
        reference: reference || ({} as Reference),
        status: 'error',
        result: { error: 'Invalid reference provided' }
      }
    }

    let currentState: ProcessState = {
      status: 'pending',
      messages: [],
      iteration: 0
    }

    if (onUpdate) {
      try {
        onUpdate(currentState)
      } catch (error) {
        console.error('Error in onUpdate callback:', error)
      }
    }

    try {
      while (
        currentState.status === 'pending' &&
        currentState.iteration! < this.config.maxIterations
      ) {
        try {
          const response = await this.retryableFetch('/api/o3-agent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reference: reference.raw || JSON.stringify(reference),
              iteration: currentState.iteration,
              previousMessages: currentState.messages,
              functionResult: currentState.functionResult,
              lastToolCallId: currentState.lastToolCallId
            })
          })

          const llmResponse = await response.json()

          if (llmResponse.functionToCall) {
            const { name, arguments: args } = llmResponse.functionToCall
            let functionResult

            switch (name) {
              case 'check_doi':
                functionResult = await this.checkDOI(args.doi, args.title)
                break
              case 'search_reference':
                functionResult = await this.searchReference(args.reference)
                break
              case 'check_url':
                functionResult = await this.checkURL(args.url, args.reference)
                // Even if URL check failed, allow process to continue
                break
              default:
                functionResult = { error: `Unknown function: ${name}` }
            }

            currentState = {
              ...llmResponse,
              functionResult,
              lastToolCallId: llmResponse.lastToolCallId
            }
          } else {
            currentState = llmResponse
          }

          currentState.iteration = (currentState.iteration || 0) + 1

          if (onUpdate) {
            try {
              onUpdate(currentState)
            } catch (error) {
              console.error('Error in onUpdate callback:', error)
            }
          }
        } catch (error) {
          console.error('Iteration error:', error)

          // Don't immediately fail - increment iteration and continue if possible
          currentState.iteration = (currentState.iteration || 0) + 1

          // If we've reached the max retries, mark as error
          if (currentState.iteration >= this.config.maxIterations) {
            currentState.status = 'error'
            currentState.error = `Max iterations reached with error: ${error instanceof Error ? error.message : String(error)}`
          }
        }
      }

      // Only log if we have a successful result
      if (
        currentState.status === 'complete' &&
        currentState.result?.reference
      ) {
        console.log('fixed reference:', currentState.result.reference)
      }

      // If process errors, update the reference's status to error
      // When process completes, get the LLM's verification status and message
      if (currentState.status === 'complete' && currentState.result) {
        // Update the original reference with verification result
        reference.status = currentState.result.status || 'verified'
        reference.message =
          currentState.result.message || 'Verification complete'
        reference.fixedReference = currentState.result.reference
      } else if (currentState.status === 'error' || currentState.error) {
        // Only set to error if process failed
        reference.status = 'error'
        reference.message =
          currentState.error || 'Something went wrong during verification'
      } else {
        // Fallback for undefined states
        reference.status = 'error'
        reference.message = 'Verification process ended in an undefined state'
      }

      return {
        reference,
        status: currentState.status,
        result: currentState.result
      }
    } catch (error) {
      console.error('Verification process error:', error)

      reference.status = 'error'
      reference.message = `Verification failed: ${error instanceof Error ? error.message : String(error)}`

      return {
        reference,
        status: 'error',
        result: {
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  }

  public async processBatch(
    references: Reference[],
    onBatchProgress?: (verifiedReferences: VerifiedReference[]) => void
  ): Promise<VerifiedReference[]> {
    // Validate input
    if (!Array.isArray(references)) {
      console.error('Invalid references array provided')
      return []
    }

    const verifiedReferences: VerifiedReference[] = []
    const validReferences = references.filter((ref) => ref)

    if (validReferences.length === 0) {
      console.warn('No valid references to process')
      return []
    }

    try {
      for (let i = 0; i < validReferences.length; i += this.config.batchSize) {
        const batch = validReferences.slice(i, i + this.config.batchSize)
        const batchPromises = batch.map((ref) =>
          this.verifyReference(ref, (state) => {
            console.log(
              `Verifying reference ${i + batch.indexOf(ref) + 1}/${validReferences.length}`
            )
          }).catch((error) => {
            console.error(
              `Error verifying reference ${i + batch.indexOf(ref) + 1}:`,
              error
            )
            return {
              reference: ref,
              status: 'error' as ProcessStatus, // Explicitly cast to ProcessStatus
              result: {
                error: error instanceof Error ? error.message : String(error)
              }
            }
          })
        )

        try {
          const batchResults = await Promise.all(batchPromises)
          verifiedReferences.push(...batchResults)

          if (onBatchProgress) {
            try {
              onBatchProgress(verifiedReferences)
            } catch (progressError) {
              console.error('Error in batch progress callback:', progressError)
            }
          }
        } catch (batchError) {
          console.error('Error processing batch:', batchError)
        }
      }
    } catch (error) {
      console.error('Error in batch processing:', error)
    }

    return verifiedReferences
  }
}
