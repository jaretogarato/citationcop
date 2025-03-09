// First, import the ProcessingStep type to match the verification-service API
import type { Reference } from '@/app/types/reference'
import {
  checkDOI,
  searchReference,
  searchScholar,
  checkURL
} from '@/app/lib/referenceToolsCode'

// Use the same ProcessingStep type for compatibility
export type ProcessingStep =
  | 'initializing'
  | 'search_reference'
  | 'scholar_search'
  | 'check_doi'
  | 'check_url'
  | 'finalizing'

type ProcessStatus = 'pending' | 'complete' | 'error'

// Updated ProcessState type
type ProcessState = {
  status: ProcessStatus
  messages?: any[]
  iteration?: number
  result?: any
  error?: string

  // Old properties (keep for backward compatibility)
  functionResult?: any
  lastToolCallId?: string

  // New properties for multiple tool calls
  functionResults?: any[]
  toolCallIds?: string[]
  toolCalls?: Array<{
    id: string
    name: string
    arguments: any
  }>

  // Error handling properties
  parsingError?: boolean
  parseErrorMessage?: string
  rawContent?: string
  resultWasFallback?: boolean
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
  private errorCounts: Record<string, number> = {}
  public errorLog: Array<{
    reference: string
    error: string
    timestamp: Date
  }> = []

  constructor(config?: ServiceConfig) {
    // Default configuration with sensible values
    this.config = {
      maxRetries: 3,
      requestTimeout: 60000, // 60 seconds
      maxIterations: 30,
      batchSize: 15,
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

  private logError(
    reference: Reference,
    errorPath: string,
    error: any,
    state?: ProcessState
  ) {
    // First, properly format the error message
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : JSON.stringify(error)

    console.error(
      `##################### \nReference error [${errorPath}]: ${errorMessage}`,
      {
        referenceId: reference.id || 'unknown',
        reference: reference.raw?.substring(0, 100) || 'no raw reference',
        iteration: state?.iteration || 0,
        state: state
          ? { ...state, messages: `[${state.messages?.length || 0} messages]` }
          : 'no state'
      }
    )
  }

  // Expose a method to get error statistics
  public getErrorStats(): {
    count: number
    mostRecent: Date | null
    commonErrors: Record<string, number>
  } {
    const commonErrors: Record<string, number> = {}

    this.errorLog.forEach((entry) => {
      if (!commonErrors[entry.error]) {
        commonErrors[entry.error] = 0
      }
      commonErrors[entry.error]++
    })

    return {
      count: this.errorLog.length,
      mostRecent:
        this.errorLog.length > 0
          ? this.errorLog[this.errorLog.length - 1].timestamp
          : null,
      commonErrors
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
          this.logError({} as Reference, 'retryableFetch', error)

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
    this.logError({} as Reference, 'retryableFetch', lastError)
    throw lastError || new Error('All retry attempts failed')
  }

  // Enhanced wrapper around the o3-agent API call
  private async callVerificationAgent(
    reference: string,
    iteration: number,
    messages: any[],
    functionResults: any[] = [],
    toolCallIds: string[] = []
  ) {
    try {
      const response = await this.retryableFetch('/api/o3-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference,
          iteration,
          previousMessages: messages,
          functionResults, // Now an array
          toolCallIds // Now an array
        })
      })

      const responseData = await response.json()
      console.log('Agent response:', responseData)

      // Add detailed logging for specific cases
      if (responseData.status === 'error') {
        console.error('==================\nAGENT ERROR RESPONSE:', {
          error: responseData.error,
          errorType: responseData.errorType,
          iteration,
          referenceStart: reference.substring(0, 100) + '...'
        })
      }

      // Log when we receive a parsing error
      if (responseData.parsingError) {
        console.warn('==================\nPARSING ERROR DETECTED:', {
          parseErrorMessage: responseData.parseErrorMessage,
          iteration,
          resultStatus: responseData.result?.status || 'unknown'
        })
      }

      return responseData
    } catch (error) {
      console.error('Error calling verification agent:', error)
      throw error
    }
  }

  public async verifyReference(
    reference: Reference,
    onUpdate?: (state: ProcessState) => void,
    onStatusUpdate?: (step: ProcessingStep, args?: any) => void // Add the step update parameter
  ): Promise<VerifiedReference> {
    // Create a timeout promise
    const timeoutPromise = new Promise<VerifiedReference>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `Verification timed out after ${this.config.requestTimeout * 2}ms`
          )
        )
      }, this.config.requestTimeout * 2) // Double the individual request timeout for the whole operation
    })

    // Create the main verification promise
    const verificationPromise = this._verifyReference(
      reference,
      onUpdate,
      onStatusUpdate
    )

    // Race them
    return Promise.race([verificationPromise, timeoutPromise])
  }

  private async _verifyReference(
    reference: Reference,
    onUpdate?: (state: ProcessState) => void,
    onStatusUpdate?: (step: ProcessingStep, args?: any) => void
  ): Promise<VerifiedReference> {
    // Validate input
    if (!reference) {
      return {
        reference: reference || ({} as Reference),
        status: 'error',
        result: { error: 'Invalid reference provided' }
      }
    }

    console.log('Verifying reference:', reference)

    // Begin with initializing step
    onStatusUpdate?.('initializing')

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
          console.log('Iteration:', currentState.iteration)
          console.log('Current state:', currentState)
          console.log('Reference:', reference)

          // Use our enhanced agent call instead of direct fetch
          const llmResponse = await this.callVerificationAgent(
            reference.raw || JSON.stringify(reference),
            currentState.iteration || 0,
            currentState.messages || [],
            currentState.functionResults || [], // Now an array
            currentState.toolCallIds || [] // Now an array
          )

          if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
            // Process multiple tool calls in parallel
            const toolCalls = llmResponse.toolCalls
            const functionResults = []
            const toolCallIds = []

            // Execute all tool calls
            for (const toolCall of toolCalls) {
              const { id, name, arguments: args } = toolCall
              let functionResult

              // Update status step based on the function being called
              if (onStatusUpdate && name) {
                // Cast the name to ProcessingStep if it matches one of the expected values
                if (
                  name === 'check_doi' ||
                  name === 'search_reference' ||
                  name === 'scholar_search' ||
                  name === 'check_url'
                ) {
                  onStatusUpdate(name as ProcessingStep, args)
                }
              }

              console.log('Tool call name:@@@@', name)
              // Execute the appropriate function
              switch (name) {
                case 'check_doi':
                  functionResult = await checkDOI(args.doi, args.title)
                  break
                case 'search_reference':
                  functionResult = await searchReference(args.reference)
                  break
                case 'scholar_search':
                  console.log('Searching scholar for:', args.query)
                  functionResult = await searchScholar(args.query)
                  break
                case 'check_url':
                  functionResult = await checkURL(args.url, args.reference)
                  break
                default:
                  functionResult = {
                    success: false,
                    error: `Unknown function: ${name}`,
                    suggestion: 'Try another verification method.'
                  }
              }

              // Store results to send back to the model
              functionResults.push(functionResult)
              toolCallIds.push(id)
            }

            // Update current state with all function results
            currentState = {
              ...llmResponse,
              functionResults,
              toolCallIds
            }
          } else {
            // No function called, likely finalizing
            onStatusUpdate?.('finalizing')
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

          // If we've reached the max iterations, mark as error
          if (currentState.iteration >= this.config.maxIterations) {
            currentState.status = 'error'
            currentState.error = `Max iterations reached with error: ${
              error instanceof Error ? error.message : String(error)
            }`
          }
        }
      }

      // Process the final state
      if (currentState.status === 'complete') {
        // Finalizing step
        onStatusUpdate?.('finalizing')

        // Check for parsing errors that were flagged by the route
        if (currentState.parsingError) {
          this.logError(
            reference,
            'json-parsing',
            currentState.parseErrorMessage || 'JSON parsing error occurred',
            currentState
          )

          // Still mark as complete but use the fallback result
          if (currentState.result) {
            // Update the original reference with verification result
            reference.status = currentState.result.status || 'needs-human'
            reference.message =
              currentState.result.message ||
              'Verification produced an invalid response format that could not be parsed. Human review recommended.'
            reference.fixedReference = currentState.result.reference
          }
        } else if (currentState.result) {
          // Normal complete flow - no errors
          reference.status = currentState.result.status || 'verified'
          reference.message =
            currentState.result.message || 'Verification complete'
          reference.fixedReference = currentState.result.reference
        }
      } else if (currentState.status === 'error' || currentState.error) {
        // Only set to error if process failed
        this.logError(
          reference,
          'verification-failed',
          currentState.error || 'Verification failed',
          currentState
        )
        reference.status = 'error'
        reference.message =
          currentState.error || 'Something went wrong during verification'
      } else {
        // Fallback for undefined states
        this.logError(
          reference,
          'undefined-state',
          'Verification process ended in an undefined state',
          currentState
        )
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
      this.logError(reference, 'verifyReference', error)
      reference.status = 'error'
      reference.message = `Verification failed: ${
        error instanceof Error ? error.message : String(error)
      }`

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
    onBatchProgress?: (verifiedReferences: VerifiedReference[]) => void,
    onReferenceVerified?: (verifiedReference: VerifiedReference) => void,
    onStatusUpdate?: (
      referenceId: string,
      step: ProcessingStep,
      args?: any
    ) => void // Add step update parameter
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
          this.verifyReference(
            ref,
            (state) => {
              console.log(
                `Verifying reference ${i + batch.indexOf(ref) + 1}/${validReferences.length}`
              )
            },
            // Pass the step update but add the reference ID
            onStatusUpdate
              ? (step, args) => onStatusUpdate(ref.id, step, args)
              : undefined
          )
            .then((result) => {
              // Call the onReferenceVerified callback when each reference is verified
              if (onReferenceVerified) {
                try {
                  onReferenceVerified(result)
                } catch (callbackError) {
                  console.error(
                    'Error in reference verified callback:',
                    callbackError
                  )
                }
              }
              return result
            })
            .catch((error) => {
              // Error handling...
              const errorResult = {
                reference: ref,
                status: 'error' as ProcessStatus,
                result: {
                  error: error instanceof Error ? error.message : String(error)
                }
              }

              // Also call the callback for error cases
              if (onReferenceVerified) {
                try {
                  onReferenceVerified(errorResult)
                } catch (callbackError) {
                  console.error(
                    'Error in reference verified callback:',
                    callbackError
                  )
                }
              }

              return errorResult
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
