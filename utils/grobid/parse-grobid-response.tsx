import { XMLParser } from 'fast-xml-parser';
import { Reference, ReferenceType } from '@/types/reference';

const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true
} as const;

// Response types
interface GrobidExtractResponse {
  references: Reference[];
}

export function parseReferences(xml: string): Reference[] {
  const parser = new XMLParser(parserOptions);
  const result = parser.parse(xml);

  // Log the complete parsed XML structure for debugging purposes
  console.log('Parsed XML structure:', JSON.stringify(result, null, 2));

  const biblStructs = result?.TEI?.text?.back?.div?.listBibl?.biblStruct || [];
  const references = Array.isArray(biblStructs) ? biblStructs : [biblStructs];

  return references.map((ref, index): Reference => {
    const analytic = ref.analytic || {};
    const monogr = ref.monogr || {};
    const imprint = monogr.imprint || {};

    // Extract identifiers only from <analytic>
    const identifiers = analytic.idno ? (Array.isArray(analytic.idno) ? analytic.idno : [analytic.idno]) : [];
    
    console.log('Reference identifiers:', JSON.stringify(identifiers, null, 2));

    // Extract DOI using the already processed idArray
    const doi = extractIdentifier(identifiers, 'DOI');

    // Rest of the parsing process...
    // Extract raw citation
    const rawNote = Array.isArray(ref.note)
      ? ref.note.find((note: any) => note['@_type'] === 'raw_reference')
      : ref.note?.['@_type'] === 'raw_reference'
        ? ref.note
        : null;

    const raw = rawNote?.['#text'] || null;

    // Determine the reference type based on titles and levels
    let type: ReferenceType = 'article';
    if (monogr.title?.['@_level'] === 'm' && !analytic.title) {
      type = 'book';
    } else if (monogr.title?.['@_level'] === 'j') {
      type = 'article';
    } else if (ref['@_type']) {
      type = ref['@_type'] as ReferenceType;
    }

    // Handle authors correctly
    const analyticAuthors = analytic.author
      ? Array.isArray(analytic.author)
        ? analytic.author
        : [analytic.author]
      : [];

    const authorList = analyticAuthors
      .filter((author: any): author is NonNullable<typeof author> => author != null)
      .map((author: any) => {
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
      .filter((author: any): author is string => author !== null);

    // Handle URL/ptr from <analytic>
    const url = analytic.ptr?.['@_target'] || null;

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

    // Get reference status based on DOI verification
    const { status, message } = determineReferenceStatus(doi, raw);

    return {
      id: Date.now() + index,
      authors: authorList,
      type,
      title,
      year,
      DOI: doi,
      url,
      journal,
      volume,
      issue:
        imprint.biblScope?.['@_unit'] === 'issue'
          ? imprint.biblScope['#text']
          : null,
      pages,
      publisher: imprint.publisher?.['#text'] || null,
      arxivId: extractIdentifier(identifiers, 'arXiv'),
      PMID: extractIdentifier(identifiers, 'PMID'),
      ISBN: extractIdentifier(identifiers, 'ISBN'),
      conference:
        ref['@_type'] === 'inproceedings' ? monogr.title?.['#text'] : null,
      status,
      message,
      verification_source: 'CrossRef', 
      date_of_access: null,
      raw  // Add the raw citation string to the reference object
    };
  });
}





// Function to verify DOI absence in raw string
function verifyDOIInRawString(doi: string | null, rawString: string | null): boolean {
  // Return false if DOI is null or empty since we only want to check when there is a DOI
  if (!doi || doi.trim() === "") {
    return false;
  }

  // Return false if rawString is null or empty, as we cannot verify absence
  if (!rawString) {
    return false;
  }

  // Clean up DOI for comparison
  const cleanDoi = doi.toLowerCase().trim();
  const rawLower = rawString.toLowerCase();

  // Check if DOI is NOT present in the raw string
  const doiFound = rawLower.includes(cleanDoi);

  // Return true if the DOI is NOT found, meaning it is absent
  return !doiFound;
}

// Function to check if a DOI exists in raw text and determine status
export function determineReferenceStatus(doi: string | null, rawText: string | null): {
  status: 'verified' | 'pending',
  message?: string
} {
  const isVerified = verifyDOIInRawString(doi, rawText)

  console.log('DOI:', doi, 'Raw:', rawText, 'Verified:', isVerified);
  return {
    status: isVerified ? 'verified' : 'pending',
    message: isVerified ? 'DOI verified in CrossRef' : undefined
  };
}

// Helper functions for cleaner code
//function extractIdentifier(idArray: any[], type: string): string | null {
//  return idArray.find((id) => id['@_type'] === type)?.['#text'] || null;
//}

// Helper functions for cleaner code
/*function extractIdentifier(idArray: any[], type: string): string | null {
  const identifier = idArray.find((id) => id['@_type'] === type)?.['#text'] || null;
  if (type === 'DOI') {
    console.log('Extracting DOI from:', idArray);
    console.log('Found DOI:', identifier);
  }
  return identifier;
}*/

function extractIdentifier(idArray: any[], type: string): string | null {
  console.log('Extracting identifier:', type, 'from:', JSON.stringify(idArray, null, 2));
  for (const id of idArray) {
    if (id['@_type'] === type) {
      console.log(`Found ${type}:`, id['#text']);
      return id['#text'];
    }
  }
  console.log(`No identifier of type ${type} found.`);
  return null;
}