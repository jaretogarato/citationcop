import { NextResponse } from 'next/server'
import type { Reference } from '@/app/types/reference'

export const maxDuration = 300
const EMAIL = process.env.DOI_EMAIL

async function fetchCrossrefData(doi: string): Promise<any> {
  const response = await fetch(
    `https://api.crossref.org/works/${encodeURIComponent(doi)}?mailto=${EMAIL}`,
    {
      headers: {
        'User-Agent': `CitationVerifier/1.0 (mailto:${EMAIL})`
      }
    }
  )

  if (!response.ok) {
    // If rate limited, wait and retry
    if (response.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return fetchCrossrefData(doi)
    }
    throw new Error(`DOI verification failed: ${response.statusText}`)
  }

  return await response.json()
}

export async function POST(request: Request) {
  try {
    const { doi } = await request.json()

    if (!doi) {
      return NextResponse.json(
        { error: 'Invalid request: doi is required' },
        { status: 400 }
      )
    }

    const data = await fetchCrossrefData(doi)
    const work = data.message

    // Extract key metadata fields for the LLM to use in its reasoning.
    const keyInfo = {
      doi: work.DOI,
      crossrefTitle: work.title && work.title.length > 0 ? work.title[0] : '',
      publisher: work.publisher || '',
      url: work.URL || ''
    }

    return NextResponse.json(keyInfo)
  } catch (error) {
    console.error('Error in DOI verification:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to verify DOI'
      },
      { status: 500 }
    )
  }
}
