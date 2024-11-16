// CURRENTLY NOT USED IN THE CODE

import { NextRequest, NextResponse } from 'next/server';
import { parseReferences } from '@/utils/grobid/parse-grobid-response';
import { Reference } from '@/types/reference';

export const runtime = 'edge';

// Consider adding timeout and retry configuration
const GROBID_HOST = process.env.GROBID_HOST;
const GROBID_TIMEOUT = 30000; // 30 seconds

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
    const { references } = await req.json() as { references: Reference[] }

    if (!references?.length) {
      throw new GrobidError('No raw text references provided', 400);
    }

    const grobidFormData = new FormData()
    const raw = references.map(ref => ref.raw?.trim()).filter(Boolean);
    
    if (!raw.length) {
      throw new GrobidError('No valid references after processing', 400);
    }

    grobidFormData.append('citations', raw.join('\n'));
    grobidFormData.append('consolidateCitations', '1');

    const response = await fetch(GROBID_ENDPOINTS.references, {
      method: 'POST',
      body: grobidFormData,
      headers: {
        'Accept': 'application/xml'
      },
      // Add timeout and retry logic for 503 errors
      signal: AbortSignal.timeout(GROBID_TIMEOUT)
    });

    if (response.status === 503) {
      // Implement retry logic here for when GROBID is busy
      throw new GrobidError('GROBID service temporarily unavailable', 503);
    }

    if (!response.ok) {
      throw new GrobidError(
        `GROBID processing failed: ${response.status} ${response.statusText}`,
        response.status
      );
    }

    const xml = await response.text();
    const extractedReferences: Reference[] = parseReferences(xml);
    
    return NextResponse.json({ references: extractedReferences });
  } catch (error) {
    console.error('Error processing references:', error);
    
    if (error instanceof GrobidError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    const status = error instanceof Error && 'status' in error ? 
      (error as any).status : 500;
      
    return NextResponse.json(
      { error: 'Failed to process references', details: error instanceof Error ? error.message : 'Unknown error' },
      { status }
    );
  }
}