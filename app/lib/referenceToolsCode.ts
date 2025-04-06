// app/lib/referenceToolsCode.ts (ensure this matches your import in o3ReferenceVerificationService)

// Implementation of reference tools

export async function checkDOI(doi: string, title: string, config = {}) {
  try {
    const response = await fetch('/api/references/verify-doi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doi, title })
    })

    if (!response.ok) {
      throw new Error(`Failed to verify DOI: ${response.statusText}`)
    }

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



export async function searchReference(reference: string, config = {}) {
  console.log('****Searching reference for:', reference)
  console.log('Payload to be sent:', JSON.stringify({ reference }))
  try {
    const response = await fetch('/api/references/verify-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference })
    })

    if (!response.ok) {
      throw new Error(`Failed to search reference: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error searching reference:', error)
    return {
      success: false,
      error: `Failed to search reference: ${error instanceof Error ? error.message : String(error)}`,
      suggestion: 'Try scholar search if available, or check the URL directly.'
    }
  }
}

export async function searchScholar(query: string, config = {}) {
  //.log('Searching scholar for:', query)
  //console.log('Payload to be sent:', JSON.stringify({ query }))
  try {
    const response = await fetch('/api/references/verify-search-scholar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    })

    //console.log('Response google scholar:', response)
    if (!response.ok) {
      throw new Error(`Failed to search scholar: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error with scholar search:', error)
    return {
      success: false,
      error: `Failed to do scholar search: ${error instanceof Error ? error.message : String(error)}`,
      suggestion: 'If there is a DOI or URL, check them directly.'
    }
  }
}

export async function checkURL(url: string, reference: string, config = {}) {
  try {
    const response = await fetch('/api/fetch-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    })

    // Parse the JSON response regardless of HTTP status code
    const jsonResponse = await response.json().catch(() => {
      return {
        error: `Failed to parse response`,
        statusCode: response.status
      }
    })

    // If we have an error either in the response or the HTTP status
    if (!response.ok || jsonResponse.error) {
      // Create status-specific guidance
      return {
        success: false,
        url: url,
        status: response.status,
        statusText: response.statusText,
        error:
          jsonResponse.error ||
          `URL check failed with status ${response.status}`,
        verificationInfo: {
          isAccessible: false,
          statusMeaning: `Error ${response.status}`,
          suggestion:
            'Consider verifying the reference using DOI or literature search instead.'
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
    return {
      success: false,
      url: url,
      error: `Failed to access URL: ${error instanceof Error ? error.message : String(error)}`,
      status: 500,
      verificationInfo: {
        isAccessible: false,
        statusMeaning: 'Network Error',
        networkError: true,
        suggestion: 'Consider verifying through other sources.'
      }
    }
  }
}


export async function smartSearchReference(reference: string, config = {}) {
  try {
    const response = await fetch('/api/references/openAI-websearch/searchPreview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference })
    })

    if (!response.ok) {
      throw new Error(`Failed to search reference: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error searching reference:', error)
    return {
      success: false,
      error: `Failed to search reference: ${error instanceof Error ? error.message : String(error)}`,
      suggestion: 'Try scholar search if available, or check the URL directly.'
    }
  }
}

export async function smartRepairReference(reference: string, config = {}) {
  try {
    const response = await fetch('/api/references/openAI-websearch/repair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference })
    })

    if (!response.ok) {
      throw new Error(`Failed to search reference: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error searching reference:', error)
    return {
      success: false,
      error: `Failed to search reference: ${error instanceof Error ? error.message : String(error)}`,
      suggestion: 'Oh no an error occured trying to fix the reference.'
    }
  }
}