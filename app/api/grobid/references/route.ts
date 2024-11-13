import { NextRequest, NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';
import { Reference, ReferenceType } from '@/types/reference';

export const config = {
  runtime: 'edge'
};

// Configuration with environment variable
const GROBID_HOST = process.env.GROBID_HOST

// Constants
const GROBID_ENDPOINTS = {
  references: `${GROBID_HOST}/api/processReferences`
} as const;

const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true
} as const;

// Response types
interface GrobidExtractResponse {
  references: Reference[];
}

// Helper functions for cleaner code
function extractIdentifier(idArray: any[], type: string): string | null {
  return idArray.find((id) => id['@_type'] === type)?.['#text'] || null;
}

function extractAuthorName(author: any): string | null {
  if (!author?.persName) return null;
  const firstName = author.persName.forename?.['#text'] || '';
  const surname =
    author.persName.surname?.['#text'] || author.persName.surname || '';
  const fullName = `${firstName} ${surname}`.trim();
  return fullName || null;
}

function parseReferences(xml: string): Reference[] {
  const parser = new XMLParser(parserOptions);
  const result = parser.parse(xml);

  const biblStructs = result?.TEI?.text?.back?.div?.listBibl?.biblStruct || [];
  const references = Array.isArray(biblStructs) ? biblStructs : [biblStructs];

  return references.map((ref, index): Reference => {
    const analytic = ref.analytic || {};
    const monogr = ref.monogr || {};
    const imprint = monogr.imprint || {};

    // Get all identifiers
    const identifiers = ref.idno || [];
    const idArray = Array.isArray(identifiers) ? identifiers : [identifiers];

    // Extract authors with better error handling
    const authorList = [...(analytic.author || []), ...(monogr.author || [])]
      .flat()
      .map(extractAuthorName)
      .filter((author): author is string => author !== null);

    // Extract page range with validation
    const pageRange = imprint.biblScope && {
      from: imprint.biblScope['@_from'],
      to: imprint.biblScope['@_to']
    };

    const title = analytic.title?.['#text'] || monogr.title?.['#text'] || '';
    if (!title) {
      console.warn('Reference found without title', { ref });
    }

    return {
      id: Date.now() + index,
      authors: authorList,
      type: (ref['@_type'] as ReferenceType) || 'article',
      title: title,
      year: imprint.date?.['@_when'] || null,
      DOI: extractIdentifier(idArray, 'DOI'),
      url: ref.ptr?.['@_target'] || null,
      journal: monogr.title?.['#text'] || null,
      volume: imprint.biblScope?.['#text'] || null,
      issue:
        imprint.biblScope?.['@_unit'] === 'issue'
          ? imprint.biblScope['#text']
          : null,
      pages:
        pageRange && pageRange.from && pageRange.to
          ? `${pageRange.from}-${pageRange.to}`
          : null,
      publisher: imprint.publisher?.['#text'] || null,
      arxivId: extractIdentifier(idArray, 'arXiv'),
      PMID: extractIdentifier(idArray, 'PMID'),
      ISBN: extractIdentifier(idArray, 'ISBN'),
      conference:
        ref['@_type'] === 'inproceedings' ? monogr.title?.['#text'] : null,
      status: 'pending'
    };
  });
}

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

export default async function handler(
  req: NextRequest
): Promise<NextResponse<GrobidExtractResponse | { error: string }>> {

  console.log('*** Extracting references request received. In edge Function *** ');

  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file');

    console.log('*** Extracting references request received. In edge Function ***. File:', file);

    if (!file || !(file instanceof File)) {
      throw new GrobidError('No PDF file provided', 400);
    }

    // Validate file type
    if (!file.type.includes('pdf')) {
      throw new GrobidError('File must be a PDF', 400);
    }

    const grobidFormData = new FormData();
    grobidFormData.append(
      'input',
      new Blob([await file.arrayBuffer()], { type: 'application/pdf' })
    );
    
    const response = await fetch(GROBID_ENDPOINTS.references, {
      method: 'POST',
      body: grobidFormData,
      headers: {
        Accept: 'application/xml'
      }
    });
    console.log('*** Extracting references request received. In edge Function ***. Response:', response);

    if (!response.ok) {
      throw new GrobidError(
        `GROBID processing failed: ${response.status} ${response.statusText}`,
        response.status
      );
    }

    const xml = await response.text();
    const references = parseReferences(xml);

    if (references.length === 0) {
      console.warn('No references extracted from document');
    }

    return NextResponse.json({
      references: references
    });
  } catch (error) {
    console.error('Error processing document:', error);
    if (error instanceof GrobidError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: 'Failed to process document' },
      { status: 500 }
    );
  }
}
