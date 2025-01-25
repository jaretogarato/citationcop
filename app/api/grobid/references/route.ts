//app/api/grobid/references/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { parseReferences } from '@/app/utils/grobid/parse-grobid-response'
import { Reference } from '@/app/types/reference'
import { filterInvalidReferences } from '@/app/utils/reference-helpers/reference-helpers'

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
    /*console.log(
      `Filtered ${allReferences.length - validReferences.length} invalid references. ` +
        `${validReferences.length} valid references remaining.`
    )*/
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
