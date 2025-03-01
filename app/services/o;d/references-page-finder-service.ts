import { getDocument } from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { GlobalWorkerOptions } from 'pdfjs-dist'

//GlobalWorkerOptions.workerSrc = '/workers/pdf.worker.js'
// Ensure the correct worker is used
GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";


interface PDFItem {
  str: string
  height: number
  width: number
  transform: number[] // [scaleX, skewX, skewY, scaleY, moveX, moveY]
}

interface PDFLine {
  x: number
  y: number
  width: number
  height: number
  text: string
  _height: number[]
}

export class ReferencesPageFinder {
  /**
   * Check if text is a reference section heading - more lenient version
   */
  private isRefHeading(text: string): boolean {
    // Clean and standardize the text
    let s = text.trim().toLowerCase()
    s = s.replace(/[.,:\-–;!]+$/g, '')
    s = s.replace(/^[.,:\-–;!]+/g, '')

    // Common section number patterns to remove
    s = s.replace(
      /^(?:\d+\.?\s*|[IVXivx]+\.?\s*|Section\s+\d+\s*[:.]?\s*)/g,
      ''
    )

    // Must be a short line (typical for headings)
    if (s.length > 40) return false

    // Word boundary check - these must be complete words
    const wordPatterns = [
      /\breferences?\b/,
      /\bbibliography\b/,
      /\bworks cited\b/,
      /\bréférences?\b/,
      /\breferencias\b/,
      /参考文献/ // Chinese doesn't need word boundaries
    ]

    return wordPatterns.some((pattern) => pattern.test(s))
  }

  /**
   * Merge PDF items with similar Y coordinates into lines
   * Using the original implementation which handles columns well
   */
  private mergeSameLine(items: PDFItem[]): PDFLine[] {
    if (!items.length) return []

    const toLine = (item: PDFItem): PDFLine => {
      let x = Number(item.transform[4].toFixed(1))
      let y = Number(item.transform[5].toFixed(1))
      let w = item.width
      if (w < 0) {
        x += w
        w = -w
      }
      return {
        x,
        y,
        width: w,
        height: item.height,
        text: item.str,
        _height: [item.height]
      }
    }

    const lines: PDFLine[] = [toLine(items[0])]

    for (let i = 1; i < items.length; i++) {
      const current = toLine(items[i])
      const prevLine = lines[lines.length - 1]

      const sameLine =
        current.y === prevLine.y ||
        (current.y >= prevLine.y && current.y < prevLine.y + prevLine.height) ||
        (current.y + current.height > prevLine.y &&
          current.y + current.height <= prevLine.y + prevLine.height)

      if (sameLine) {
        prevLine.text += ' ' + current.text
        prevLine.width += current.width
        prevLine._height.push(current.height)
      } else {
        prevLine.height = Math.max(...prevLine._height)
        lines.push(current)
      }
    }

    lines[lines.length - 1].height = Math.max(
      ...lines[lines.length - 1]._height
    )
    return lines
  }

  private async fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result)
        } else {
          reject(new Error('Failed to convert file to ArrayBuffer'))
        }
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(file)
    })
  }

  public async findReferencesPage(input: File | ArrayBuffer): Promise<number> {
    try {
      const pdfBuffer =
        input instanceof File ? await this.fileToArrayBuffer(input) : input

      const doc: PDFDocumentProxy = await getDocument({ data: pdfBuffer })
        .promise
      const numPages = doc.numPages

      // Start from the last page and work backwards
      for (let pageIndex = numPages; pageIndex >= 1; pageIndex--) {
        const page = await doc.getPage(pageIndex)
        const textContent = await page.getTextContent()

        const pageItems: PDFItem[] = textContent.items.map((item: any) => ({
          str: item.str,
          height: item.transform[3],
          width: item.width,
          transform: item.transform
        }))

        // Use their proven line merging logic
        const pageLines = this.mergeSameLine(pageItems)

        // Just look for reference headings with more lenient matching
        for (const line of pageLines) {
          if (this.isRefHeading(line.text)) {
            return pageIndex
          }
        }
      }

      return -1 // References section not found
    } catch (error) {
      console.error('Error processing PDF:', error)
      throw error
    }
  }
}

export default ReferencesPageFinder
