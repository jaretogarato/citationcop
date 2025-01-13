// utils.ts

/**
 * Minimal interface describing the shape of a parsed reference object.
 * Adjust as needed for your own use.
 */
export interface ItemBaseInfo {
    identifiers?: {
      DOI?: string;
      arXiv?: string;
      [key: string]: string | undefined;
    };
    url?: string;
    authors?: string[];
    title?: string;
    year?: string;
    type?: string;  // e.g. 'journalArticle', 'book', etc.
    text?: string;  // Original text
    // any other fields you need...
  }
  
  /**
   * A simplified utilities class that provides:
   * - Regex-based extraction of DOIs, arXiv IDs, and URLs
   * - Basic parsing of reference text (authors, titles, year)
   * - Helpers like isChinese, isDOI, matchArXiv
   */
  export default class Utils {
    /**
     * Regex patterns for extracting DOIs, arXiv IDs, and URLs.
     */
    public regex = {
      DOI: /10\.\d{4,9}\/[-\._;()\/:A-Za-z0-9><]+[^\.\]]/,
      arXiv: /arXiv[\.:](\d+\.\d+)/,
      URL: /https?:\/\/[^\s.]+/
    };
  
    /**
     * Extract identifiers (DOI, arXiv) from a line of text.
     */
    public getIdentifiers(text: string): ItemBaseInfo['identifiers'] {
      const targets = [
        { key: 'DOI', ignoreSpace: true, regex: this.regex.DOI },
        { key: 'arXiv', ignoreSpace: true, regex: this.regex.arXiv }
      ];
  
      const identifiers: Record<string, string> = {};
  
      for (const target of targets) {
        const source = target.ignoreSpace ? text.replace(/\s+/g, '') : text;
        const res = source.match(target.regex);
        if (res) {
          // Take the last match
          identifiers[target.key] = res.slice(-1)[0];
        }
      }
  
      return identifiers;
    }
  
    /**
     * Extract a URL from text if it matches the `URL` regex.
     */
    private extractURL(text: string): string | undefined {
      const res = text.match(this.regex.URL);
      return res ? res.slice(-1)[0] : undefined;
    }
  
    /**
     * "Main" reference text parser. Attempts to extract:
     *  - year
     *  - authors
     *  - title
     *  - publicationVenue (if relevant)
     *
     * This is all heuristic-based, so feel free to simplify if it's too customized.
     */
    public parseRefText(text: string): {
      year?: string;
      authors?: string[];
      title: string;
      publicationVenue?: string;
    } {
      try {
        let input = text;
  
        // Remove leading bracket references like "[1]"
        input = input.replace(/^\[\d+?\]/, '').replace(/\s+/g, ' ');
  
        let title: string;
        let titleMatch: string;
  
        // If the text has quotes like “title”, we treat that as the title
        const quoteMatch = input.match(/\u201c(.+)\u201d/);
        if (quoteMatch) {
          [titleMatch, title] = quoteMatch;
          // If the title ends with a comma, strip it
          if (title.endsWith(',')) {
            title = title.slice(0, -1);
          }
        } else {
          // Otherwise, do a naive approach: split on ". " or "." and guess the "longest chunk"
          const chunks =
            input.indexOf('. ') !== -1 && input.match(/\.\s/g)?.length! >= 2
              ? input.split('. ')
              : input.split('.');
  
          // Sort them by length descending
          // Then do some extra logic to skip small or weird chunks.
          const sorted = chunks
            .sort((a, b) => b.length - a.length)
            .map((s) => {
              // Count uppercase initials, punctuation, digits, etc.
              let count = 0;
              [/[A-Z]\./g, /[,\.\-\(\)\:]/g, /\d/g].forEach((regex) => {
                const res = s.match(regex);
                count += res ? res.length : 0;
              });
              // Return "density" plus the original string
              return [count / s.length, s] as [number, string];
            })
            // Filter out chunks that are too short or look like a "journal" line
            .filter((val) => val[1].match(/\s+/g)?.length! >= 3)
            // Sort by "density"
            .sort((a, b) => a[0] - b[0]);
  
          // Choose the first result after sorting
          title = (sorted[0] && sorted[0][1]) || input;
          titleMatch = title;
          // If the title ends with "[A-Z]", remove that bracket note
          if (/\[[A-Z]\]$/.test(title)) {
            title = title.replace(/\[[A-Z]\]$/, '');
          }
        }
  
        title = title.trim();
  
        // Attempt to separate authors from the rest
        const splitByTitle = input.split(titleMatch);
        const authorInfo = (splitByTitle[0] || '').trim();
        let publicationVenue = '';
  
        if (splitByTitle[1]) {
          // e.g. the next chunk might be the "journal / conference" name
          const matchVenue = splitByTitle[1].match(/[^.\s].+[^\.]/);
          publicationVenue = matchVenue
            ? matchVenue[0].split(/[,\d]/)[0].trim()
            : '';
        }
  
        // If we see "et al." in the author chunk, we shorten it
        let finalAuthors = authorInfo.includes('et al.')
          ? [authorInfo.split('et al.')[0].trim() + ' et al.']
          : [authorInfo.trim()];
  
        // Attempt to find a plausible year (19xx or 20xx) not too far in future
        const currentYear = new Date().getFullYear();
        const yearMatches = text
          .match(/[^\d]\d{4}[^\d-]/g)
          ?.map((s) => s.match(/\d+/)![0]);
  
        let possibleYear = yearMatches?.find((yr) => {
          return Number(yr) <= currentYear + 1;
        });
  
        // Remove that year from authors chunk, if found
        if (possibleYear) {
          finalAuthors = finalAuthors.map((a) =>
            a.replace(possibleYear + '.', '').replace(possibleYear, '').trim()
          );
        }
  
        return {
          year: possibleYear,
          title,
          authors: finalAuthors,
          publicationVenue
        };
      } catch {
        // If something fails, just return the entire text as title
        return { title: text };
      }
    }
  
    /**
     * An alternative approach to parsing text. The original code called this `_parseRefText`.
     * It tries to detect year, authors, and title in a different, simpler manner.
     */
    public _parseRefText(text: string): { year: string; authors: string[]; title: string } {
      let year: string | undefined;
  
      // Attempt to match any 4-digit year in range
      const _years = text.match(/[^\d]?(\d{4})[^\d]?/g) as string[];
      if (_years) {
        const validYears = _years
          .map((chunk) => Number(chunk.match(/\d{4}/)![0]))
          .filter((y) => y > 1900 && y < new Date().getFullYear());
        if (validYears.length > 0) {
          year = String(validYears[0]);
        }
      }
      if (!year) {
        year = ''; // fallback
      }
  
      // If text has Chinese, guess a different approach
      if (this.isChinese(text)) {
        // naive approach: split on punctuation, guess which is authors vs. title
        const parts = text
          .replace(/\[.+?\]/g, '')
          .replace(/\s+/g, ' ')
          .split(/[\.,\uff0c\uff0e\uff3b\[\]]/)
          .map((e) => e.trim())
          .filter((e) => e);
  
        let authors: string[] = [];
        let titles: string[] = [];
        for (let part of parts) {
          if (part.length >= 2 && part.length <= 3) {
            authors.push(part);
          } else {
            titles.push(part);
          }
        }
        let title = titles.sort((a, b) => b.length - a.length)[0] || text;
        return { title, authors, year };
      } else {
        // Western text approach
        let authors: string[] = [];
        let stripped = text.replace(/[\u4e00-\u9fa5]/g, '');
        const authorRegexs = [/[A-Za-z,\.\s]+?\.?[\.,;]/g, /[A-Z][a-z]+ et al.,/];
        authorRegexs.forEach((regex) => {
          stripped.match(regex)?.forEach((author) => {
            authors.push(author.slice(0, -1));
          });
        });
  
        // guess the title as the largest chunk that doesn't include "http"
        let title =
          stripped
            .split(/[,\.]\s/g)
            .filter((e: string) => !e.includes('http'))
            .sort((a, b) => b.length - a.length)[0] || text;
  
        return { title, authors, year };
      }
    }
  
    /**
     * Build a URL from extracted identifiers if possible
     */
    public identifiers2URL(identifiers: ItemBaseInfo['identifiers']): string | undefined {
      if (!identifiers) return undefined;
      if (identifiers.DOI) {
        return `https://doi.org/${identifiers.DOI}`;
      }
      if (identifiers.arXiv) {
        return `https://arxiv.org/abs/${identifiers.arXiv}`;
      }
      return undefined;
    }
  
    /**
     * The main "entry point" used in PDFParser to parse each reference line.
     */
    public refText2Info(text: string): ItemBaseInfo {
      // 1. Extract DOIs/arXiv
      const identifiers = this.getIdentifiers(text);
  
      // 2. Construct a URL if we found identifiers
      const potentialURL = this.extractURL(text) || this.identifiers2URL(identifiers);
  
      // 3. Parse the text for authors, year, title, etc.
      const parsed = this.parseRefText(text);
  
      // 4. Return a combined object
      return {
        identifiers,
        url: potentialURL,
        authors: parsed.authors || [],
        title: parsed.title,
        year: parsed.year,
        text, // store the raw text
        type: identifiers?.arXiv ? 'preprint' : 'journalArticle'
      };
    }
  
    /**
     * Check if a text is primarily Chinese (at least 50% Chinese characters).
     */
    public isChinese(text: string): boolean {
      const stripped = text.replace(/\s+/g, '');
      const matches = stripped.match(/[\u4E00-\u9FA5]/g);
      const count = matches ? matches.length : 0;
      return count / stripped.length > 0.5;
    }
  
    /**
     * Check if the entire string is a valid DOI. 
     * This was used in the original code to confirm if a line is purely a DOI.
     */
    public isDOI(text: string): boolean {
      if (!text) return false;
      const res = text.match(this.regex.DOI);
      if (!res) return false;
      return (
        res[0] === text &&
        // exclude certain substrings
        !/(cnki|issn)/i.test(text)
      );
    }
  
    /**
     * Quick check if there's an arXiv ID in the text.
     */
    public matchArXiv(text: string): string | false {
      const res = text.match(this.regex.arXiv);
      if (res != null && res.length >= 2) {
        return res[1]; // e.g. "1234.5678"
      }
      return false;
    }
  }
  