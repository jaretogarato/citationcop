import { getDocument, PDFDocumentProxy, GlobalWorkerOptions } from 'pdfjs-dist'

// Ensure the correct worker is used
GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

interface PDFItem {
  str: string
  height: number
  width: number
  transform: number[]
}

interface PDFLine {
  x: number
  y: number
  width: number
  height: number
  text: string
  _height: number[]
}

interface PageParseResult {
  pageNumber: number
  rawText: string
  lines: PDFLine[]
}

export class DocumentParsingService {
  private pdfDoc: PDFDocumentProxy | null = null

  /**
   * Initialize the service with a PDF file
   */
  async initialize(file: File | ArrayBuffer | Blob): Promise<void> {
    let arrayBuffer: ArrayBuffer
    if (file instanceof File || file instanceof Blob) {
      arrayBuffer = await file.arrayBuffer()
    } else {
      arrayBuffer = file
    }
    this.pdfDoc = await getDocument({ data: arrayBuffer }).promise
    console.log(`Loaded PDF with ${this.pdfDoc.numPages} pages`)
  }

  /**
   * Parse the entire document and return an array with the text content for each page.
   */
  async parseDocument(): Promise<PageParseResult[]> {
    if (!this.pdfDoc) {
      throw new Error('PDF document not initialized')
    }
    const numPages = this.pdfDoc.numPages
    const results: PageParseResult[] = []

    // Process pages sequentially (or in parallel if needed)
    for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
      const page = await this.pdfDoc.getPage(pageNumber)
      const textContent = await page.getTextContent()

      // Map items to our own type
      const items: PDFItem[] = textContent.items.map((item: any) => ({
        str: item.str,
        height: item.transform[3],
        width: item.width,
        transform: item.transform
      }))

      // Merge items into coherent lines
      const lines = this.mergeSameLine(items)

      // Combine lines into raw text for this page
      const rawText = lines
        .map((line) => line.text)
        .join('\n')
        .trim()

      results.push({ pageNumber, rawText, lines })
    }

    return results
  }

  /**
   * Merge text items that are on the same line.
   */
  private mergeSameLine(items: PDFItem[]): PDFLine[] {
    if (items.length === 0) return []

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
        // Set final height for the previous line and start a new line
        prevLine.height = Math.max(...prevLine._height)
        lines.push(current)
      }
    }
    // Set final height for the last line
    lines[lines.length - 1].height = Math.max(
      ...lines[lines.length - 1]._height
    )
    return lines
  }
}
