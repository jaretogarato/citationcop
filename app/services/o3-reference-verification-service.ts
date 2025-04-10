// First, import the ProcessingStep type to match the verification-service API
import type { Reference } from '@/app/types/reference'

// now using this so we can have same code everywhere.
import { verifyReference } from '@/app/lib/verification-service'
import type { ProcessingStep } from '@/app/lib/verification-service'

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
  /*private async callVerificationAgent(
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
      //console.log('Agent response:', responseData)

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
  }*/

  public async processBatch(
    references: Reference[],
    onBatchProgress?: (verifiedReferences: VerifiedReference[]) => void,
    onReferenceVerified?: (verifiedReference: VerifiedReference) => void,
    onStatusUpdate?: (
      referenceId: string,
      step: ProcessingStep,
      args?: any
    ) => void
  ): Promise<VerifiedReference[]> {
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

        const batchPromises = batch.map(async (ref) => {
          const performedChecks = new Set<string>()

          try {
            const result = await verifyReference(
              ref,
              (step, args) => {
                if (onStatusUpdate) onStatusUpdate(ref.id, step, args)
              },
              performedChecks
            )

            const verified: VerifiedReference = {
              reference: result,
              status: result.status as ProcessStatus,
              result
            }

            if (onReferenceVerified) onReferenceVerified(verified)

            return verified
          } catch (error) {
            console.error('??Reference verification failed:', error)
            return {
              reference: ref,
              status: 'error' as ProcessStatus,
              result: {
                error: error instanceof Error ? error.message : String(error)
              }
            }
          }
        })

        try {
          const batchResults = await Promise.all(batchPromises)
          verifiedReferences.push(...batchResults)

          if (onBatchProgress) {
            onBatchProgress(verifiedReferences)
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