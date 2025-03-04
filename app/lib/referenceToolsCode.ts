// /app/lib/referenceTools.ts
// A standalone utility module for reference verification tools

// Configuration options to make service behavior more configurable
interface FetchConfig {
  maxRetries?: number
  requestTimeout?: number
}

// Helper function for retryable fetch with timeout
// Private implementation detail - not exported
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number = 60000
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

// Retryable fetch implementation
// Private implementation detail - not exported
async function retryableFetch(
  url: string,
  options: RequestInit,
  config: FetchConfig = {}
): Promise<Response> {
  const { maxRetries = 3, requestTimeout = 60000 } = config

  let lastError: Error | null = null
  let lastResponse: Response | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Exponential backoff for retries
      if (attempt > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * Math.pow(2, attempt - 1))
        )
      }

      const response = await fetchWithTimeout(url, options, requestTimeout)
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
      console.error(`Attempt ${attempt + 1}/${maxRetries} failed:`, error)
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry if it was an abort error (timeout)
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.error(`Request timed out after ${requestTimeout}ms`)
        throw new Error(`Request timed out after ${requestTimeout}ms`)
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

// Helper function to get status-specific information for URL checks
// Private implementation detail - not exported
function getStatusSpecificInfo(status: number) {
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

// 1. DOI Verification Tool
export async function checkDOI(
  doi: string,
  title: string,
  config: FetchConfig = {}
) {
  try {
    const response = await retryableFetch(
      '/api/references/verify-doi',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ references: [{ DOI: doi, title }] })
      },
      config
    )

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

// 2. Literature Search Tool
export async function searchReference(
  reference: string,
  config: FetchConfig = {}
) {
  try {
    const response = await retryableFetch(
      '/api/references/verify-search',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference })
      },
      config
    )
    console.log('response', response)
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

// 3. URL Verification Tool
export async function checkURL(
  url: string,
  reference: string,
  config: FetchConfig = {}
) {
  try {
    const response = await retryableFetch(
      '/api/fetch-url',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      },
      config
    )

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
      const statusInfo = getStatusSpecificInfo(response.status)

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

    const statusInfo = getStatusSpecificInfo(statusCode)

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

// Export only the three main tool functions needed by external components
export const ReferenceTools = {
  checkDOI,
  searchReference,
  checkURL
}

export default ReferenceTools
