// app/lib/verification-service.ts
import {
  checkDOI,
  searchReference,
  checkURL,
  searchScholar,
  //smartSearchReference,
  //smsartRepairReference
} from '@/app/lib/referenceToolsCode'
import type { Reference, ReferenceStatus } from '@/app/types/reference'

export type TokenUsage = {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

interface ExtendedReference extends Reference {
  checksPerformed?: string[]
}

export type VerificationStatus = {
  status: 'pending' | 'complete' | 'needs-human' | 'error'
  messages?: any[]
  iteration?: number
  functionResult?: any
  lastToolCallId?: string
  error?: string
  webSearchResults?: {
    output_text: string
    citations: Array<{
      type: 'url_citation'
      start_index: number
      end_index: number
      url: string
      title?: string
    }>
  }
  result?: {
    status: 'verified' | 'unverified' | 'needs-human' | 'error'
    message: string
    checks_performed?: string[]
    reference: string
  }
  tokenUsage?: TokenUsage
}

export type ProcessingStep =
  | 'initializing'
  | 'web_search'
  | 'google_search'
  | 'scholar_search'
  | 'check_doi'
  | 'check_url'
  | 'finalizing'

// Badge colors for different check types (dark mode)
export const checkBadgeColors: Record<string, string> = {
  'DOI Lookup': 'bg-blue-900 text-blue-200 hover:bg-blue-800 border-blue-700',
  'Google Search':
    'bg-purple-900 text-purple-200 hover:bg-purple-800 border-purple-700',
  'Web Search':
    'bg-orange-900 text-orange-200 hover:bg-orange-800 border-orange-700',
  'URL Verification':
    'bg-teal-900 text-teal-200 hover:bg-teal-800 border-teal-700',
  'Scholar Search':
    'bg-indigo-900 text-indigo-200 hover:bg-indigo-800 border-indigo-700',
  'Citation Format':
    'bg-emerald-900 text-emerald-200 hover:bg-emerald-800 border-emerald-700',
  'Metadata Check':
    'bg-amber-900 text-amber-200 hover:bg-amber-800 border-amber-700'
}

/**
 * Perform a web search for a reference
 */
async function performWebSearch(reference: string) {
  try {
    console.log('performWebSearch:', reference)

    const response = await fetch('/api/references/openAI-websearch/responses-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference })
    })

    if (!response.ok) {
      throw new Error(`Web search API error: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error in web search:', error)
    return {
      status: 'error',
      error: 'Failed to perform web search',
      output_text: 'Web search failed.',
      citations: []
    }
  }
}

/**
 * Verify a single reference using the verification API
 */
export async function verifyReference(
  reference: Reference,
  onStatusUpdate?: (step: ProcessingStep, args?: any) => void,
  performedChecks?: Set<string>
): Promise<ExtendedReference> {
  try {
    // Initialize with first processing step
    onStatusUpdate?.('initializing')

    let currentState: VerificationStatus = {
      status: 'pending',
      messages: [],
      iteration: 0
    }

    console.log('****** Verifying reference:', reference)
    console.log('****** Reference ID:', reference.id)
    console.log('****** Reference raw:', reference.raw)
    console.log('****** Reference DOI:', reference.DOI)
    console.log('****** Reference URL:', reference.url)
    console.log('****** Reference title:', reference.title)
    console.log('****** Reference type:', reference.type)

    // Perform web search first
    /*onStatusUpdate?.('web_search', { reference: reference.raw })
    performedChecks?.add('Web Search')

    const webSearchResults = await performWebSearch(reference.raw)
    if (webSearchResults.status === 'success') {
      currentState.webSearchResults = {
        output_text: webSearchResults.output_text,
        citations: webSearchResults.citations
      }
    }

    console.log('****** Web search results:', webSearchResults)*/

    while (currentState.status === 'pending' && currentState.iteration! < 8) {
      // Call the API
      const response = await fetch('/api/o3-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: reference.raw,
          iteration: currentState.iteration,
          previousMessages: currentState.messages,
          functionResult: currentState.functionResult,
          lastToolCallId: currentState.lastToolCallId
          //webSearchResults: currentState.webSearchResults // Pass search results to o3-agent
        })
      })

      const llmResponse = await response.json()

      if (llmResponse.functionToCall) {
        const { name, arguments: args } = llmResponse.functionToCall
        let functionResult

        // Update processing step based on the tool being called
        onStatusUpdate?.(name as ProcessingStep, args)

        switch (name) {
          case 'check_doi':
            performedChecks?.add('DOI Lookup')
            functionResult = await checkDOI(args.doi, args.title)
            break
          case 'google_search':
            performedChecks?.add('Google Search')
            functionResult = await searchReference(args.reference)
            break
          /*case 'smart_repair_reference':
            performedChecks?.add('Repairing Reference')
            functionResult = await smartRepairReference(args.reference)
            break*/
          case 'scholar_search':
            performedChecks?.add('Scholar Search')
            functionResult = await searchScholar(args.query)
            break
          case 'check_url':
            performedChecks?.add('URL Verification')
            functionResult = await checkURL(args.url, args.reference)
            break
        }

        currentState = {
          ...llmResponse,
          functionResult,
          lastToolCallId: llmResponse.lastToolCallId,
          webSearchResults: currentState.webSearchResults // Preserve web search results
        }
      } else {
        // If no function is being called, we're likely finalizing
        onStatusUpdate?.('finalizing')
        currentState = {
          ...llmResponse,
          webSearchResults: currentState.webSearchResults // Preserve web search results
        }
      }

      // Pause briefly for UX
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    // Map the verification status to our reference status
    let refStatus: ReferenceStatus = 'pending'
    let explanation = ''
    let formattedText = reference.raw

    if (currentState.result) {
      switch (currentState.result.status) {
        case 'verified':
          refStatus = 'verified'
          break
        case 'needs-human':
          refStatus = 'needs-human'
          break
        case 'unverified':
          refStatus = 'unverified'
          break
        case 'error':
          refStatus = 'error'
          break
      }

      explanation = currentState.result.message || 'Verification completed.'
      formattedText = currentState.result.reference || reference.raw
    } else if (currentState.error) {
      refStatus = 'error'
      explanation =
        currentState.error || 'An error occurred during verification.'
    }

    // Get checks performed
    const checksPerformed = getChecksPerformed(currentState, performedChecks)

    // Return updated reference
    return {
      ...reference,
      status: refStatus,
      message: explanation,
      fixedReference: formattedText !== reference.raw ? formattedText : null,
      checksPerformed
    }
  } catch (error) {
    console.error('Verification error:', error)
    return {
      ...reference,
      status: 'error',
      message: 'An error occurred while connecting to the verification service.'
    }
  }
}

/**
 * Function to get checks performed from verification state
 */
export function getChecksPerformed(
  currentState: any,
  performedChecks?: Set<string>
) {
  if (
    currentState?.result?.checks_performed &&
    currentState.result.checks_performed.length > 0
  ) {
    return currentState.result.checks_performed
  }

  // Fallback to our tracked checks
  if (performedChecks && performedChecks.size > 0) {
    return Array.from(performedChecks)
  }

  // Last resort: try to extract from message history
  const checks = new Set<string>()

  // Add Web Search if we have web search results
  if (currentState?.webSearchResults) {
    checks.add('Web Search')
  }

  currentState?.messages?.forEach((msg: any) => {
    if (msg.role === 'assistant' && msg.tool_calls) {
      msg.tool_calls.forEach((call: any) => {
        if (call.function?.name === 'check_doi') {
          checks.add('DOI Lookup')
        } else if (call.function?.name === 'google_search') {
          checks.add('Google Search')
        } else if (call.function?.name === 'check_url') {
          checks.add('URL Verification')
        } else if (call.function?.name === 'scholar_search') {
          checks.add('Scholar Search')
        }
      })
    }
  })

  return Array.from(checks)
}

/**
 * Extract references from text using the references extraction API
 */
export async function extractReferences(text: string): Promise<Reference[]> {
  try {
    const response = await fetch('/api/references/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()

    if (!data.references || !Array.isArray(data.references)) {
      return []
    }

    // Convert to our Reference format
    return data.references.map((ref: any, index: number) => ({
      id: `ref-${Date.now()}-${index}`,
      authors: ref.authors || [],
      title: ref.title || `Reference ${index + 1}`,
      DOI: ref.DOI || null,
      url: ref.url || null,
      journal: ref.journal || null,
      year: ref.year || null,
      publisher: ref.publisher || null,
      volume: ref.volume || null,
      issue: ref.issue || null,
      pages: ref.pages || null,
      conference: ref.conference || null,
      type: ref.type || null,
      raw: ref.raw || '',
      status: 'pending' as ReferenceStatus,
      sourceDocument: 'Extracted Text',
      message: 'Waiting to be verified...',
      verification_source: null,
      url_valid: null,
      url_match: null
    }))
  } catch (error) {
    console.error('Error extracting references:', error)
    throw error
  }
}

/**
 * Get badge color for a check type
 */
export function getBadgeColor(checkType: string): string {
  return (
    checkBadgeColors[checkType] ||
    'bg-gray-800 text-gray-300 hover:bg-gray-700 border-gray-600'
  )
}
