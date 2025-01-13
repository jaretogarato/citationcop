import { getDocument, PDFWorker, GlobalWorkerOptions } from 'pdfjs-dist'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'

GlobalWorkerOptions.workerSrc = '/pdf.worker.js'
const pdfWorker = new PDFWorker()

interface TextLine {
  text: string
  y: number
  lineIndex: number
}

export class PDFTextExtractionService {
  async extractText(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      const pdf = await getDocument({
        data: uint8Array,
        worker: pdfWorker
      }).promise

      let fullText = ''

      // Process each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum)
          const textContent = await page.getTextContent()

          if (!textContent?.items?.length) continue

          // Extract text from this page
          const pageText = this.processPage(
            textContent,
            page.getViewport({ scale: 1.0 }).height
          )

          // Add page text with proper spacing
          if (pageText) {
            if (fullText) fullText += '\n\n'
            fullText += pageText
          }
        } catch (error) {
          console.warn(`Error processing page ${pageNum}:`, error)
          continue
        }
      }

      return this.cleanOutput(fullText)
    } catch (error) {
      console.error('Error parsing PDF:', error)
      throw new Error('Failed to parse PDF')
    }
  }

  private processPage(textContent: any, pageHeight: number): string {
    try {
      // Group text items into lines
      const lines = this.groupIntoLines(textContent.items, pageHeight)

      // Sort lines by y-position (top to bottom)
      lines.sort((a, b) => b.y - a.y)

      // Combine lines into text
      return lines.map((line) => line.text).join('\n')
    } catch (error) {
      console.warn('Error processing page:', error)
      return ''
    }
  }

  private groupIntoLines(items: any[], pageHeight: number): TextLine[] {
    const lines: Map<number, string[]> = new Map()
    const yPositions: Set<number> = new Set()

    // First pass: collect all y positions and group text by y coordinate
    for (const item of items) {
      if (!('transform' in item)) continue

      const y = Math.round(item.transform[5])
      const text = this.cleanText(item.str)

      // Skip header/footer areas and empty text
      if (!text || y < pageHeight * 0.1 || y > pageHeight * 0.9) continue

      yPositions.add(y)

      if (!lines.has(y)) {
        lines.set(y, [])
      }
      lines.get(y)?.push(text)
    }

    // Convert to array of lines
    const result: TextLine[] = []
    let lineIndex = 0

    for (const y of Array.from(yPositions)) {
      const texts = lines.get(y)
      if (texts) {
        result.push({
          text: texts.join(' '),
          y,
          lineIndex: lineIndex++
        })
      }
    }

    return result
  }

  private cleanText(text: string): string {
    if (!text) return ''

    return text
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Control chars
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width spaces
      .replace(/­/g, '') // Soft hyphens
      .replace(/\s+/g, ' ') // Multiple spaces
      .trim()
  }

  private cleanOutput(text: string): string {
    if (!text) return ''

    return text
      .replace(/\n{3,}/g, '\n\n') // Normalize multiple line breaks
      .replace(/\s+/g, ' ') // Normalize spaces within lines
      .trim()
  }
}
