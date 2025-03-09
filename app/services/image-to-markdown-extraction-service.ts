import { RefPagesResult } from '@/app/types/reference'

export interface ReferenceMarkdownResult {
  pageNumber: number
  markdown: string
}

export class ReferenceMarkdownService {
  /**
   * Extracts markdown content from each reference page.
   *
   * For each page provided in the RefPagesResult, this method calls the
   * '/api/open-ai-vision/image-2-ref-markdown' endpoint with the corresponding image data
   * and parsed text. It returns an array of markdown extraction results.
   *
   * @param refPagesResult The result object containing pages, raw text, and image data.
   * @returns An array of ReferenceMarkdownResult.
   */
  async extractMarkdown(
    refPagesResult: RefPagesResult
  ): Promise<ReferenceMarkdownResult[]> {
    const { pages, rawText, imageData } = refPagesResult

    const markdownResults = await Promise.all(
      pages.map(async (page, index) => {
        const filePath = imageData[index]
        const parsedText = rawText[index]

        const response = await fetch('/api/open-ai-vision/image-2-ref-markdown', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filePath,
            parsedText,
            model: 'free'
          })
        })

        if (!response.ok) {
          throw new Error('Failed to extract references content')
        }

        const { markdown } = await response.json()

        return {
          pageNumber: page,
          markdown
        }
      })
    )

    return markdownResults
  }
}
