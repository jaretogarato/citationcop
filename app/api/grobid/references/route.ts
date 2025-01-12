//app/api/grobid/references/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { parseReferences } from '@/app/utils/grobid/parse-grobid-response'
import { Reference } from '@/app/types/reference'

export const runtime = 'edge'

// Configuration with environment variable
const GROBID_HOST = process.env.GROBID_HOST

// Constants
const GROBID_ENDPOINTS = {
  references: `${GROBID_HOST}/api/processReferences`
} as const

// Error handling utility
class GrobidError extends Error {
  constructor(
    message: string,
    public status: number = 500
  ) {
    super(message)
    this.name = 'GrobidError'
  }
}

// In your POST handler:
export async function POST(req: NextRequest) {
  try {
    //console.log('Received request with formData:', req.method, req.headers);

    const formData = await req.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof Blob)) {
      throw new GrobidError('No PDF file provided', 400)
    }

    const grobidFormData = new FormData()
    grobidFormData.append(
      'input',
      new Blob([await file.arrayBuffer()], { type: 'application/pdf' })
    )

    /*console.log(
      'Attempting to connect to GROBID at:',
      GROBID_ENDPOINTS.references
    )*/

    // Add optional parameters
    grobidFormData.append('includeRawCitations', '1')

    const response = await fetch(GROBID_ENDPOINTS.references, {
      method: 'POST',
      body: grobidFormData,
      headers: {
        Accept: 'application/xml'
      }
    })

    if (!response.ok) {
      throw new GrobidError(
        `GROBID processing failed: ${response.status} ${response.statusText}`,
        response.status
      )
    }

    const xml = await response.text()
    const allReferences: Reference[] = parseReferences(xml)

    // Filter out invalid references
    const validReferences = filterInvalidReferences(allReferences)

    // Optionally log the filtering results
    console.log(
      `Filtered ${allReferences.length - validReferences.length} invalid references. ` +
        `${validReferences.length} valid references remaining.`
    )
    console.log('Grobid References: ', validReferences)

    return NextResponse.json({ references: validReferences })
  } catch (error) {
    console.error('Error processing document:', error)
    return NextResponse.json(
      {
        error:
          error instanceof GrobidError
            ? error.message
            : 'Failed to process document',
        details: (error as Error).message
      },
      { status: error instanceof GrobidError ? error.status : 500 }
    )
  }
}

// Helper function to check if two author lists are similar
const areAuthorsSimilar = (authors1: string[], authors2: string[]): boolean => {
  if (Math.abs(authors1.length - authors2.length) > 1) return false

  // Normalize author names and sort them
  const normalizeAndSort = (authors: string[]) =>
    authors.map((a) => a.toLowerCase().trim()).sort()

  const set1 = new Set(normalizeAndSort(authors1))
  const set2 = new Set(normalizeAndSort(authors2))

  // Count matching authors
  let matches = 0
  for (const author of set1) {
    if (set2.has(author)) matches++
  }

  // If at least 70% of authors match, consider them similar
  const threshold = Math.min(set1.size, set2.size) * 0.7
  return matches >= threshold
}

// Helper function to filter invalid references and remove duplicates
const filterInvalidReferences = (references: Reference[]): Reference[] => {
  // First, filter out references without valid authors and titles
  const validRefs = references.filter((ref) => {
    const hasValidAuthors = Array.isArray(ref.authors) && ref.authors.length > 0
    const hasValidTitle =
      typeof ref.title === 'string' && ref.title.trim() !== ''
    return hasValidAuthors && hasValidTitle
  })

  // Then, remove duplicates while considering similar authors
  const uniqueRefs = new Map<number, Reference>()

  for (const ref of validRefs) {
    const normalizedTitle = ref.title.toLowerCase().trim()

    let isDuplicate = false
    for (const existingRef of uniqueRefs.values()) {
      const existingTitle = existingRef.title.toLowerCase().trim()

      if (
        normalizedTitle === existingTitle &&
        areAuthorsSimilar(existingRef.authors, ref.authors)
      ) {
        isDuplicate = true
        break
      }
    }

    if (!isDuplicate) {
      uniqueRefs.set(ref.id, ref)
    }
  }

  return Array.from(uniqueRefs.values())
}
