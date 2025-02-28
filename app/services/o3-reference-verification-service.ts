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
      maxIterations: 15,
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

  // Helper function to get status-specific information
  private getStatusSpecificInfo(status: number) {
    // Default fallback
    let info = {
      meaning: 'Unknown error',
      reasons: ["The URL couldn't be accessed due to an unknown error"],
      suggestion:
        'Consider verifying the reference using DOI or literature search instead.'
    }

    // Client errors (4xx)
    if (status === 404) {
      info = {
        meaning: 'Not Found (404)',
        reasons: [
          'The resource no longer exists at this URL',
          'The URL may have been mistyped or is incorrect',
          'The content has been moved or deleted'
        ],
        suggestion:
          'This URL is confirmed to not exist. Try verifying the reference through DOI lookup or literature search.'
      }
    } else if (status === 403) {
      info = {
        meaning: 'Forbidden (403)',
        reasons: [
          'Access to this resource is restricted',
          'The server understood the request but refuses to authorize it',
          'Authentication may be required'
        ],
        suggestion:
          'This URL exists but is not publicly accessible. Try verifying the reference through other sources.'
      }
    } else if (status === 401) {
      info = {
        meaning: 'Unauthorized (401)',
        reasons: [
          'Authentication is required to access this resource',
          'The citation may refer to a paywalled or private resource'
        ],
        suggestion:
          'This resource requires authentication. Consider verifying through academic databases.'
      }
    } else if (status >= 400 && status < 500) {
      info = {
        meaning: `Client Error (${status})`,
        reasons: [
          'The request was malformed or invalid',
          'The URL may be incorrect or incomplete',
          'The resource may no longer be available at this location'
        ],
        suggestion:
          "There's a problem with the URL format or the resource doesn't exist. Try alternative verification methods."
      }
    }

    // Server errors (5xx)
    else if (status >= 500 && status < 600) {
      info = {
        meaning: `Server Error (${status})`,
        reasons: [
          'The server encountered an error while processing the request',
          'The website may be temporarily down or experiencing issues',
          'The service might be overloaded'
        ],
        suggestion:
          'The server is currently unable to handle the request. This may be temporary, but you should try DOI or literature search instead.'
      }
    }

    return info
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

  private trackError(reference: string, error: string): void {
    this.errorLog.push({
      reference: reference.substring(0, 100),
      error,
      timestamp: new Date()
    })

    // Keep the log from growing too large
    if (this.errorLog.length > 100) {
      this.errorLog.shift()
    }
  }

  // Check if we should stop trying for a particular error type
  private checkCircuitBreaker(errorType: string): boolean {
    if (!this.errorCounts[errorType]) {
      this.errorCounts[errorType] = 1
      return false
    }

    this.errorCounts[errorType]++

    if (this.errorCounts[errorType] >= 5) {
      console.error(`Circuit breaker triggered for error type: ${errorType}`)
      return true
    }

    return false
  }

  // Reset after successful operations
  private resetCircuitBreaker(errorType: string): void {
    if (this.errorCounts[errorType]) {
      this.errorCounts[errorType] = 0
    }
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
        success: false,
        error: `Failed to verify DOI: ${error instanceof Error ? error.message : String(error)}`,
        suggestion:
          'Try verifying the reference through literature search instead.'
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
        success: false,
        error: `Failed to search reference: ${error instanceof Error ? error.message : String(error)}`,
        suggestion:
          'Try using DOI lookup if available, or check the URL directly.'
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

      // Parse the JSON response regardless of HTTP status code
      const jsonResponse = await response.json().catch((e) => {
        return {
          error: `Failed to parse response: ${e.message}`,
          statusCode: response.status
        }
      })

      // If we have an error either in the response or the HTTP status
      if (!response.ok || jsonResponse.error) {
        // Create status-specific guidance based on HTTP status code
        const statusInfo = this.getStatusSpecificInfo(response.status)

        return {
          // Structure this in a way that helps the LLM understand this isn't a system error
          // but rather information about the reference
          success: false,
          url: url,
          status: response.status,
          statusText: response.statusText,
          error:
            jsonResponse.error ||
            `URL check failed with status ${response.status}`,
          // Include actionable guidance for the LLM
          verificationInfo: {
            isAccessible: false,
            statusMeaning: statusInfo.meaning,
            possibleReasons: statusInfo.reasons,
            suggestion: statusInfo.suggestion
          }
        }
      }

      // Success case
      return {
        success: true,
        ...jsonResponse
      }
    } catch (error) {
      console.error('Error checking URL:', error)

      // Try to extract a status code from the error if possible
      let statusCode = 500 // Default to general server error
      if (error instanceof Error) {
        if ('code' in error) {
          // Network errors like ENOTFOUND, ECONNREFUSED
          const code = (error as any).code
          if (code === 'ENOTFOUND') statusCode = 404 // Domain not found
          if (code === 'ECONNREFUSED') statusCode = 503 // Service unavailable
        }
        if ('status' in error) {
          statusCode = (error as any).status
        }
      }

      const statusInfo = this.getStatusSpecificInfo(statusCode)

      return {
        success: false,
        url: url,
        error: `Failed to access URL: ${error instanceof Error ? error.message : String(error)}`,
        status: statusCode,
        verificationInfo: {
          isAccessible: false,
          statusMeaning: statusInfo.meaning,
          networkError: true,
          possibleReasons: [
            ...statusInfo.reasons,
            'Network error when attempting to access the URL',
            'The URL may be malformed or invalid',
            'The host server may be unreachable'
          ],
          suggestion: statusInfo.suggestion
        }
      }
    }
  }

  // Enhanced wrapper around the o3-agent API call
  private async callVerificationAgent(
    reference: string,
    iteration: number,
    messages: any[],
    functionResult: any,
    lastToolCallId: string | null
  ) {
    // If the function result contains error information about a URL,
    // restructure it to be more helpful for the LLM
    if (
      functionResult &&
      functionResult.success === false &&
      functionResult.url &&
      lastToolCallId
    ) {
      // Enhance the function result with more context
      const enhancedResult = {
        ...functionResult,
        // Add an explicit message to help the LLM interpret the result
        message: `URL check for ${functionResult.url} was unsuccessful (${
          functionResult.status
            ? `HTTP ${functionResult.status}: ${functionResult.verificationInfo?.statusMeaning || 'Error'}`
            : 'Network Error'
        }). ${
          functionResult.verificationInfo?.suggestion ||
          'Consider other verification methods.'
        }`,
        // Keep original error information for debugging
        originalError: functionResult.error
      }

      // Replace the function result with our enhanced version
      functionResult = enhancedResult
    }

    try {
      const response = await this.retryableFetch('/api/o3-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference,
          iteration,
          previousMessages: messages,
          functionResult,
          lastToolCallId
        })
      })

      const responseData = await response.json()

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
    onUpdate?: (state: ProcessState) => void
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
    const verificationPromise = this._verifyReference(reference, onUpdate)

    // Race them
    return Promise.race([verificationPromise, timeoutPromise])
  }

  private async _verifyReference(
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
          // Use our enhanced agent call instead of direct fetch
          const llmResponse = await this.callVerificationAgent(
            reference.raw || JSON.stringify(reference),
            currentState.iteration || 0,
            currentState.messages || [],
            currentState.functionResult,
            currentState.lastToolCallId || null
          )

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
                functionResult = {
                  success: false,
                  error: `Unknown function: ${name}`,
                  suggestion: 'Try another verification method.'
                }
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
        // Check for parsing errors that were flagged by the route
        if (currentState.parsingError) {
          this.logError(
            reference,
            'json-parsing',
            currentState.parseErrorMessage || 'JSON parsing error occurred',
            currentState
          )

          //console.log('Using fallback result from parsing error')

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
          reference.status = currentState.result.status || 'verified'
          reference.message =
            currentState.result.message || 'Verification complete'
          reference.fixedReference = currentState.result.reference

          /*if (currentState.result.reference) {
            console.log('Fixed reference:', currentState.result.reference)
          }*/
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
