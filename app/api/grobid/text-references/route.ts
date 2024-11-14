
import { NextRequest, NextResponse } from 'next/server'
import { parseReferences } from '@/utils/grobid/parse-grobid-response'


/// this needs to be changed to do a list of references.
// probably processCitationList
// see: https://grobid.readthedocs.io/en/latest/Grobid-service/

export const runtime = 'edge'

// Configuration with environment variable
const GROBID_HOST = process.env.GROBID_HOST;

// Constants
const GROBID_ENDPOINTS = {
  references: `${GROBID_HOST}/api/processReferences`
} as const;

console.log(
  '*** Extracting references request received. In edge Function ***. GROBID_ENDPOINTS:',
  GROBID_ENDPOINTS
);

// Error handling utility
class GrobidError extends Error {
  constructor(
    message: string,
    public status: number = 500
  ) {
    super(message);
    this.name = 'GrobidError';
  }
}

// In your POST handler:
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof Blob)) {
      throw new GrobidError('No PDF file provided', 400);
    }

    const grobidFormData = new FormData();
    grobidFormData.append(
      'input',
      new Blob([await file.arrayBuffer()], { type: 'application/pdf' })
    );

    console.log(
      'Attempting to connect to GROBID at:',
      GROBID_ENDPOINTS.references
    );

    const response = await fetch(GROBID_ENDPOINTS.references, {
      method: 'POST',
      body: grobidFormData,
      headers: {
        Accept: 'application/xml'
      }
    });

    if (!response.ok) {
      throw new GrobidError(
        `GROBID processing failed: ${response.status} ${response.statusText}`,
        response.status
      );
    }

    const xml = await response.text();
    const references = parseReferences(xml);
    console.log('Extracted references:', references);
    return NextResponse.json({ references });
  } catch (error) {
    console.error('Error processing document:', error);
    return NextResponse.json(
      {
        error:
          error instanceof GrobidError
            ? error.message
            : 'Failed to process document',
        details: (error as Error).message
      },
      { status: error instanceof GrobidError ? error.status : 500 }
    );
  }
}