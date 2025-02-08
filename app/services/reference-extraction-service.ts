interface ProcessedPage {
  pageNumber: number
  imageData: string
  parsedContent: {
    rawText: string
  }
}

import { ExtractedReference } from '@/app/types/reference'

export class EnhancedReferenceExtractor {
  async extractReferences(pages: ProcessedPage[]): Promise<ExtractedReference[]> {
    const allReferences: ExtractedReference[] = []

    for (const page of pages) {
      const references = await this.extractReferencesFromPage(page)
      allReferences.push(...references)
    }

    return this.postProcessReferences(allReferences)
  }

  private async extractReferencesFromPage(page: ProcessedPage): Promise<ExtractedReference[]> {
    const response = await fetch('/api/llama-vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath: page.imageData,
        parsedText: page.parsedContent.rawText,
        mode: 'free'
      })
    })

    if (!response.ok) {
      throw new Error('Failed to extract references')
    }

    const { markdown } = await response.json()
    const references = this.splitMarkdownIntoReferences(markdown)
    
    return references.map(ref => ({
      text: ref,
      pageNumber: page.pageNumber
    }))
  }

  private splitMarkdownIntoReferences(markdown: string): string[] {
    return markdown
      .split(/\n(?=\[\d+\]|\d+\.\s|[A-Z][a-z]+,\s+[A-Z]\.|\[.*?\]\s+\()/g)
      .map(ref => ref.trim())
      .filter(ref => this.isValidReference(ref))
  }

  private isValidReference(text: string): boolean {
    return (
      text.length > 10 &&
      /[A-Z]/.test(text) &&
      /\d/.test(text) &&
      !/^(Figure|Table|Section)\s/i.test(text)
    )
  }

  private postProcessReferences(references: ExtractedReference[]): ExtractedReference[] {
    return references.sort((a, b) => a.pageNumber - b.pageNumber)
  }
}