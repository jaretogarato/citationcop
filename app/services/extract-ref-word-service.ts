import mammoth from 'mammoth'

export class SimpleWordReferenceService {
  // Common reference section headers in different languages
  private readonly referencePatterns = [
    // English
    'references',
    'bibliography',
    'works cited',
    'literature cited',
    'reference list',
    // French
    'références',
    'bibliographie',
    'ouvrages cités',
    'œuvres citées',
    // Spanish
    'referencias',
    'bibliografía',
    'obras citadas',
    // German
    'literaturverzeichnis',
    'quellenverzeichnis',
    'referenzen',
    'bibliographie',
    // Italian
    'riferimenti',
    'bibliografia',
    'opere citate',
    // Portuguese
    'referências',
    'bibliografia',
    'obras citadas',
    // Dutch
    'referenties',
    'bibliografie',
    'geciteerde werken',
    // Swedish
    'referenser',
    'källförteckning',
    'bibliografi',
    // Norwegian
    'referanser',
    'bibliografi',
    'kildeliste',
    // Danish
    'referencer',
    'bibliografi',
    'litteraturliste',
    // Finnish
    'viitteet',
    'lähdeluettelo',
    'kirjallisuus',
    // Chinese (Simplified)
    '参考文献',
    '引用文献',
    '文献目录',
    // Japanese
    '参考文献',
    '引用文献',
    '文献目録',
    // Korean
    '참고문헌',
    '인용문헌',
    '문헌목록',
    // Russian
    'список литературы',
    'библиография',
    'использованная литература'
  ]

  async extractReferences(file: ArrayBuffer): Promise<string> {
    try {
      // Generate style map for all possible heading levels
      const styleMap = Array.from(
        { length: 9 },
        (_, i) => `p[style-name='Heading ${i + 1}'] => h${i + 1}:fresh`
      )

      // Add common reference styles in various languages
      styleMap.push(
        "p[style-name='References'] => h2:fresh",
        "p[style-name='Bibliography'] => h2:fresh",
        "p[style-name='Références'] => h2:fresh",
        "p[style-name='Bibliographie'] => h2:fresh",
        "p[style-name='Referencias'] => h2:fresh",
        "p[style-name='Bibliografía'] => h2:fresh",
        "p[style-name='Literaturverzeichnis'] => h2:fresh"
      )

      const result = await mammoth.convertToHtml(
        { arrayBuffer: file },
        { styleMap }
      )

      const html = result.value

      // Get all headings with their positions
      const headingRegex = /<h\d[^>]*>([^<]+)<\/h\d>/gi
      const headings = [...html.matchAll(headingRegex)].map((match) => ({
        text: match[1],
        startIndex: match.index!,
        endIndex: match.index! + match[0].length,
        fullMatch: match[0]
      }))

      // Search headings from end
      for (let i = headings.length - 1; i >= 0; i--) {
        const heading = headings[i]
        // Normalize text: lowercase, remove diacritics, trim
        const headingText = this.normalizeText(heading.text)

        // Check for exact matches first
        if (
          this.referencePatterns.some(
            (pattern) => this.normalizeText(pattern) === headingText
          )
        ) {
          return this.extractContent(html, heading, headings[i + 1]?.startIndex)
        }

        // Check for partial matches (e.g., "Chapter 5: References")
        const hasReferenceWord = this.referencePatterns.some((pattern) =>
          headingText.includes(this.normalizeText(pattern))
        )

        if (hasReferenceWord) {
          return this.extractContent(html, heading, headings[i + 1]?.startIndex)
        }
      }

      throw new Error('No references section found')
    } catch (error) {
      console.error('Error extracting references:', error)
      throw error
    }
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFKD') // Decompose characters with diacritics
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .trim()
  }

  private extractContent(
    html: string,
    currentHeading: any,
    nextHeadingIndex?: number
  ): string {
    const startIndex = currentHeading.endIndex
    const endIndex = nextHeadingIndex || html.length

    let content = html.slice(startIndex, endIndex)

    // Convert to plain text
    content = content
      .replace(/<\/?[^>]+(>|$)/g, '\n') // Replace HTML tags with newlines
      .replace(/&[^;]+;/g, ' ') // Replace HTML entities
      .replace(/\n{3,}/g, '\n\n') // Normalize line breaks
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim()

    console.log('Found references section:', {
      heading: currentHeading.text,
      contentLength: content.length,
      firstFewWords: content.slice(0, 100) + '...'
    })

    return content
  }
}
