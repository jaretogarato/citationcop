import { NextRequest, NextResponse } from 'next/server'
import { parseReferences } from '@/app/utils/grobid/parse-grobid-response'
import { Reference } from '@/app/types/reference'

export const runtime = 'edge'

const GROBID_HOST = process.env.GROBID_HOST
const GROBID_TIMEOUT = 30000

const GROBID_ENDPOINTS = {
  references: `${GROBID_HOST}/api/processCitationList`
} as const

class GrobidError extends Error {
  constructor(
    message: string,
    public status: number = 500
  ) {
    super(message)
    this.name = 'GrobidError'
  }
}

export async function POST(req: NextRequest) {
  try {
    const { references } = (await req.json()) as { references: Reference[] }

    if (!references?.length) {
      throw new GrobidError('No references provided for consolidation', 400)
    }

    // Ensure each raw citation is trimmed and on its own line
    const rawCitations = references
      .map((ref) => ref.raw?.trim())
      .filter(Boolean)
      .join('\n')

    if (!rawCitations) {
      throw new GrobidError('No valid raw citations found in references', 400)
    }

    // For debugging
    console.log('Raw citations being sent:', rawCitations)

    const formData = new FormData()
    formData.append('citations', rawCitations)
    formData.append('consolidateCitations', '1')
    formData.append('includeRawCitations', '1')

    const response = await fetch(GROBID_ENDPOINTS.references, {
      method: 'POST',
      body: formData,
      headers: {
        Accept: 'application/xml'
      },
      signal: AbortSignal.timeout(GROBID_TIMEOUT)
    })

    if (response.status === 503) {
      throw new GrobidError('GROBID service temporarily unavailable', 503)
    }

    if (!response.ok) {
      throw new GrobidError(
        `GROBID consolidation failed: ${response.status} ${response.statusText}`,
        response.status
      )
    }

    const xml = await response.text()
    const consolidatedReferences = parseReferences(xml)

    // Merge consolidated data with original references
    const mergedReferences = references.map((originalRef, index) => {
      const consolidatedRef = consolidatedReferences[index]
      if (!consolidatedRef) {
        return originalRef
      }

      return {
        ...originalRef,
        ...consolidatedRef,
        consolidated: true,
        consolidatedDoi: consolidatedRef.DOI || originalRef.DOI,
        raw: originalRef.raw
      }
    })

    return NextResponse.json(mergedReferences)
  } catch (error) {
    console.error('Error consolidating references:', error)

    if (error instanceof GrobidError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }

    const status =
      error instanceof Error && 'status' in error ? (error as any).status : 500

    return NextResponse.json(
      {
        error: 'Failed to consolidate references',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status }
    )
  }
}
