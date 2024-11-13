import { NextRequest, NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';
import { Reference, ReferenceType } from '@/types/reference';

export const runtime = 'edge';

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

/*function extractAuthorName(author: any): string | null {
  if (!author?.persName) return null;
  const firstName = author.persName.forename?.['#text'] || '';
  const surname =
    author.persName.surname?.['#text'] || author.persName.surname || '';
  const fullName = `${firstName} ${surname}`.trim();
  return fullName || null;
}*/

function parseReferences(xml: string): Reference[] {
  const parser = new XMLParser(parserOptions);
  const result = parser.parse(xml);

  console.log('Parsed XML structure:', JSON.stringify(result, null, 2));

  const biblStructs = result?.TEI?.text?.back?.div?.listBibl?.biblStruct || [];
  const references = Array.isArray(biblStructs) ? biblStructs : [biblStructs];

  return references.map((ref, index): Reference => {
    const analytic = ref.analytic || {};
    const monogr = ref.monogr || {};
    const imprint = monogr.imprint || {};

    // Determine the reference type based on titles and levels
    let type: ReferenceType = 'article';
    if (monogr.title?.['@_level'] === 'm' && !analytic.title) {
      // If only monograph title exists with level 'm', it's likely a book or report
      type = 'book'; // or could be 'report' based on other indicators
    } else if (monogr.title?.['@_level'] === 'j') {
      type = 'article';
    } else if (ref['@_type']) {
      type = ref['@_type'] as ReferenceType;
    }

    // Get all identifiers
    const identifiers = ref.idno || [];
    const idArray = Array.isArray(identifiers) ? identifiers : [identifiers];

    // Handle authors correctly
    const analyticAuthors = analytic.author
      ? Array.isArray(analytic.author)
        ? analytic.author
        : [analytic.author]
      : [];
    const monogrAuthors = monogr.author
      ? Array.isArray(monogr.author)
        ? monogr.author
        : [monogr.author]
      : [];

    const authorList = [...analyticAuthors, ...monogrAuthors]
      .filter((author): author is NonNullable<typeof author> => author != null)
      .map((author) => {
        try {
          if (!author?.persName) return null;
          // Handle both single and multiple forenames
          let firstName = '';
          if (author.persName.forename) {
            if (Array.isArray(author.persName.forename)) {
              firstName = author.persName.forename
                .map((f: any) => f['#text'])
                .filter(Boolean)
                .join(' ');
            } else {
              firstName = author.persName.forename['#text'] || '';
            }
          }
          const surname =
            author.persName.surname?.['#text'] || author.persName.surname || '';
          const fullName = `${firstName} ${surname}`.trim();
          return fullName || null;
        } catch (error) {
          console.warn('Error parsing author:', author, error);
          return null;
        }
      })
      .filter((author): author is string => author !== null);

    // Handle URL/ptr from both analytic and monogr
    const url = analytic.ptr?.['@_target'] || monogr.ptr?.['@_target'] || null;

    // Better handling of page ranges
    let pages = null;
    if (imprint.biblScope) {
      const scopeArray = Array.isArray(imprint.biblScope)
        ? imprint.biblScope
        : [imprint.biblScope];

      const pageScope = scopeArray.find(
        (scope: any) => scope['@_unit'] === 'page'
      );
      if (pageScope) {
        if (pageScope['@_from'] && pageScope['@_to']) {
          pages = `${pageScope['@_from']}-${pageScope['@_to']}`;
        } else if (pageScope['#text']) {
          pages = pageScope['#text'];
        }
      }
    }

    // Get volume from biblScope
    const volume = Array.isArray(imprint.biblScope)
      ? imprint.biblScope.find((scope: any) => scope['@_unit'] === 'volume')?.[
          '#text'
        ]
      : imprint.biblScope?.['@_unit'] === 'volume'
        ? imprint.biblScope['#text']
        : null;

    // Handle year with fallback
    const year =
      imprint.date?.['@_when'] || imprint.date?.['#text']?.toString() || null;

    let journal: string | null = null;
    if (type === 'article' && monogr.title?.['@_level'] === 'j') {
      journal = monogr.title['#text'] || null;
    }

    const title = analytic.title?.['#text'] || monogr.title?.['#text'] || '';

    if (
      ref.note?.['@_type'] === 'report_type' ||
      title.toLowerCase().includes('report') ||
      monogr.ptr?.['@_target']?.includes('blog') ||
      monogr.ptr?.['@_target']?.includes('news')
    ) {
      type = 'report';
    }

    return {
      id: Date.now() + index,
      authors: authorList,
      type,
      title,
      year,
      DOI: extractIdentifier(idArray, 'DOI'),
      url,
      journal,
      volume,
      issue:
        imprint.biblScope?.['@_unit'] === 'issue'
          ? imprint.biblScope['#text']
          : null,
      pages,
      publisher: imprint.publisher?.['#text'] || null,
      arxivId: extractIdentifier(idArray, 'arXiv'),
      PMID: extractIdentifier(idArray, 'PMID'),
      ISBN: extractIdentifier(idArray, 'ISBN'),
      conference:
        ref['@_type'] === 'inproceedings' ? monogr.title?.['#text'] : null,
      status: 'pending',
      date_of_access: null
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

// In your POST handler:
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

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
