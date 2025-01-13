import { getDocument, PDFWorker, GlobalWorkerOptions } from 'pdfjs-dist'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'

GlobalWorkerOptions.workerSrc = '/pdf.worker.js'
const pdfWorker = new PDFWorker()

interface ExtractedTextItem {
  text: string
  x: number
  y: number
  width: number
  pageNum: number
}

export class PDFTextExtractionService {
  private readonly COLUMN_THRESHOLD = 100 // Minimum gap between columns
  private readonly MIN_LINE_GAP = 2 // Minimum vertical gap between lines

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
          const viewport = page.getViewport({ scale: 1.0 })

          // Get page content
          const pageText = await this.processPage(
            textContent,
            viewport.width,
            viewport.height,
            pageNum
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

  private async processPage(
    textContent: any,
    pageWidth: number,
    pageHeight: number,
    pageNum: number
  ): Promise<string> {
    try {
      const items = this.extractTextItems(textContent, pageHeight, pageNum)

      /*console.debug(
        'Extracted items:',
        items.map((item) => item.text)
      )*/

      if (!items.length) return ''

      const columns = this.detectColumns(items, pageWidth)

      /*console.debug(
        'Detected columns:',
        columns.map((col) => col.map((item) => item.text))
      )*/

      if (!columns.length) return this.processOneColumn(items)

      return columns.map((col) => this.processOneColumn(col)).join('\n\n')
    } catch (error) {
      console.warn('Error processing page:', error)
      return ''
    }
  }

  private extractTextItems(
    textContent: any,
    pageHeight: number,
    pageNum: number
  ): ExtractedTextItem[] {
    const headerZone = pageHeight * 0.05
    const footerZone = pageHeight * 0.9

    return textContent.items
      .filter((item: any): item is TextItem => {
        const isValid =
          'transform' in item &&
          item.str.trim().length > 0 &&
          item.transform[5] > headerZone &&
          item.transform[5] < footerZone

     
        return isValid
      })
      .map((item: TextItem) => ({
        text: this.cleanText(item.str),
        x: item.transform[4],
        y: item.transform[5],
        width: item.width || 0,
        pageNum
      }))
  }

  private detectColumns(
    items: ExtractedTextItem[],
    pageWidth: number
  ): ExtractedTextItem[][] {
    // Get x-positions
    const xPositions = items.map((item) => item.x)
    const uniqueX = Array.from(new Set(xPositions)).sort((a, b) => a - b)

    // Find significant gaps between x-positions
    const gaps: { start: number; end: number }[] = []
    for (let i = 0; i < uniqueX.length - 1; i++) {
      const gap = uniqueX[i + 1] - uniqueX[i]
      if (gap > this.COLUMN_THRESHOLD) {
        gaps.push({
          start: uniqueX[i],
          end: uniqueX[i + 1]
        })
      }
    }

    // If no significant gaps found, treat as single column
    if (!gaps.length) return [items]

    // Split items into columns based on gaps
    const columns: ExtractedTextItem[][] = []
    let currentColumn: ExtractedTextItem[] = []
    let currentX = 0

    for (const item of items.sort((a, b) => a.x - b.x)) {
      // Check if item starts a new column
      const gap = gaps.find((g) => g.start < item.x && item.x < g.end)

      if (gap && item.x - currentX > this.COLUMN_THRESHOLD) {
        if (currentColumn.length) {
          columns.push(currentColumn)
          currentColumn = []
        }
      }

      currentColumn.push(item)
      currentX = item.x
    }

    // Add last column
    if (currentColumn.length) {
      columns.push(currentColumn)
    }

    return columns
  }

  private processOneColumn = (items: ExtractedTextItem[]): string => {
    const sortedItems = [...items].sort((a, b) => {
      const yDiff = Math.abs(b.y - a.y)
      if (yDiff < 0.5) return a.x - b.x
      return b.y - a.y
    })

    let result = ''
    let lastY = -1

    for (const item of sortedItems) {
      if (lastY !== -1 && Math.abs(item.y - lastY) > this.MIN_LINE_GAP) {
        result += '\n'
      }

      if (result.length > 0 && !result.endsWith('\n')) {
        result += ' '
      }

      result += item.text
      lastY = item.y
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
      .replace(/([.!?])\s*(\w)/g, '$1\n$2') // Line break after sentences
      .replace(/\n{3,}/g, '\n\n') // Normalize line breaks
      .replace(/\s+/g, ' ') // Normalize spaces within lines
      .trim()
  }
}
