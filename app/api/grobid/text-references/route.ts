// API Route (save as route.ts) NOT IN USE
import { NextRequest, NextResponse } from 'next/server';
import { parseReferences } from '@/utils/grobid/parse-grobid-response';
import { Reference } from '@/types/reference';

export const runtime = 'edge';

const GROBID_HOST = process.env.GROBID_HOST;

const GROBID_ENDPOINTS = {
  references: `${GROBID_HOST}/api/processCitationList`
} as const;

class GrobidError extends Error {
  constructor(
    message: string,
    public status: number = 500
  ) {
    super(message);
    this.name = 'GrobidError';
  }
}

export async function POST(req: NextRequest) {
  try {
    const { citations } = await req.json();
    
    if (!citations) {
      throw new GrobidError('No citations provided', 400);
    }

    const grobidFormData = new FormData();
    grobidFormData.append('citations', citations);

    const response = await fetch(GROBID_ENDPOINTS.references, {
      method: 'POST',
      body: grobidFormData,
      headers: {
        'Accept': 'application/xml'
      }
    });

    if (!response.ok) {
      throw new GrobidError(
        `GROBID processing failed: ${response.status} ${response.statusText}`,
        response.status
      );
    }

    const xml = await response.text();
    const references: Reference[] = parseReferences(xml);
    
    return NextResponse.json({ references });
  } catch (error) {
    console.error('Error processing string:', error);
    return NextResponse.json(
      {
        error: error instanceof GrobidError ? error.message : 'Failed to process string',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: error instanceof GrobidError ? error.status : 500 }
    );
  }
}