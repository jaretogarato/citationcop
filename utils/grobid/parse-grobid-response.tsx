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
  
  // Helper functions for cleaner code
  function extractIdentifier(idArray: any[], type: string): string | null {
    return idArray.find((id) => id['@_type'] === type)?.['#text'] || null;
  }
  
  export function parseReferences(xml: string): Reference[] {
    const parser = new XMLParser(parserOptions);
    const result = parser.parse(xml);
  
    //console.log('Parsed XML structure:', JSON.stringify(result, null, 2));
  
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