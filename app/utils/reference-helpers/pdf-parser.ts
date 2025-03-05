import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

// Ensure the correct worker is used
GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";


// --------------------------------------------------
// 1. Basic line & reference info types
// --------------------------------------------------
export interface PDFLine {
  x: number
  y: number
  width: number
  height: number
  text: string
  url?: string
  _height: number[]
}

export interface BaseReferenceInfo {
  identifiers?: {
    DOI?: string
    arXiv?: string
    [key: string]: string | undefined
  }
  url?: string
  authors?: string[]
  title?: string
  year?: string
  type?: string
  text?: string
}

interface PDFItem {
  str: string
  height: number
  width: number
  transform: number[] // [scaleX, skewX, skewY, scaleY, moveX, moveY]
  url?: string
}

export type ParsedReference = PDFLine & BaseReferenceInfo

// --------------------------------------------------
// 2. The PDFParser Class
// --------------------------------------------------
export class PDFParser {
  private refRegex: RegExp[][] = [
    [/^\(\d+\)\s?/],
    [/^\[\d{0,3}\].+?[\,\.\uff0c\uff0e]?/],
    [/^\uff3b\d{0,3}\uff3d.+?[\,\.\uff0c\uff0e]?/],
    [/^\d+[\,\.\uff0c\uff0e]/],
    [/^\d+[^\d\w]+?[\,\.\uff0c\uff0e]?/],
    [/^\[.+?\].+?[\,\.\uff0c\uff0e]?/],
    [/^\d+\s+/],
    [
      /^[A-Z]\w.+?\(\d+[a-z]?\)/,
      /^[A-Z][A-Za-z]+[\,\.\uff0c\uff0e]?/,
      /^.+?,.+.,/,
      /^[\u4e00-\u9fa5]{1,4}[\,\.\uff0c\uff0e]?/
    ]
  ]

  /**
   * Main entry point: loads the PDF and extracts references
   */
  public async parseReferencesFromPdfBuffer(
    pdfBuffer: ArrayBuffer
  ): Promise<string> {
    const doc: PDFDocumentProxy = await getDocument({ data: pdfBuffer }).promise

    // Get raw reference lines from PDF
    const refLines = await this.getRefLines(doc)

    // Merge the lines into proper references
    const mergedRefs = this.mergeSameRef(refLines)

    // Convert to formatted text
    return mergedRefs.map((line) => line.text).join('\n')
  }

  /**
   * Check if text is a reference section heading
   */
  private isRefHeading(text: string): boolean {
    let s = text.trim().toLowerCase()
    s = s.replace(/[.,:\-–;!]+$/g, '')
    s = s.replace(/^[.,:\-–;!]+/g, '')
    return s === 'references' || s === 'bibliography' || /参考文献/i.test(s)
  }

  /**
   * Merge PDF items with similar Y coordinates into lines
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
        url: item.url,
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
        prevLine.url = prevLine.url || current.url
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

  /**
   * Merge lines that belong to the same reference
   */
  private mergeSameRef(refLines: PDFLine[]): PDFLine[] {
    if (!refLines.length) return []
    const lines = [...refLines]
    const out: PDFLine[] = []

    let currentRef: PDFLine | null = null
    let currentRefType: number | null = null

    for (const line of lines) {
      const lineType = this.getRefType(line.text)

      if (!currentRef) {
        currentRef = { ...line }
        currentRefType = lineType
        continue
      }

      if (lineType !== -1 && lineType === currentRefType) {
        out.push(currentRef)
        currentRef = { ...line }
      } else {
        let prevText = currentRef.text.replace(/-$/, '')
        currentRef.text = `${prevText}${prevText.endsWith('-') ? '' : ' '}${line.text}`
        if (line.url) {
          currentRef.url = currentRef.url || line.url
        }
      }
    }

    if (currentRef) out.push(currentRef)
    return out
  }

  /**
   * Determine reference type based on patterns
   */
  private getRefType(text: string): number {
    for (let i = 0; i < this.refRegex.length; i++) {
      const patternSet = this.refRegex[i]
      const matches = patternSet.some((regex) => {
        const raw = text.trim()
        return regex.test(raw) || regex.test(raw.replace(/\s+/g, ''))
      })
      if (matches) return i
    }
    return -1
  }

  /**
   * Detects header and footer positions and filters repeated text across pages.
   */
  private async detectHeaderFooterPositions(
    doc: PDFDocumentProxy
  ): Promise<{ headers: Set<number>; footers: Set<number> }> {
    const pagesToAnalyze = Math.min(3, doc.numPages - 1) // Analyze up to 3 pages, skipping the first
    const yPositions: { headers: number[]; footers: number[] } = {
      headers: [],
      footers: []
    }
    const textContentByPage: { headers: string[]; footers: string[] } = {
      headers: [],
      footers: []
    }
    const tolerance = 5 // Allowable deviation in `y` positions

    // Analyze pages starting from the second for headers
    for (
      let pageIndex = 2;
      pageIndex < 2 + pagesToAnalyze && pageIndex <= doc.numPages;
      pageIndex++
    ) {
      const page = await doc.getPage(pageIndex)
      const textContent = await page.getTextContent()

      textContent.items.forEach((item: any) => {
        const y = Math.round(item.transform[5]) // Vertical position
        const text = item.str.trim()

        // Collect header content
        if (y < doc.numPages * 0.2) {
          // Text close to the top
          yPositions.headers.push(y)
          textContentByPage.headers.push(text)
        }

        // Collect footer content
        if (y > doc.numPages * 0.8) {
          // Text close to the bottom
          yPositions.footers.push(y)
          textContentByPage.footers.push(text)
        }
      })
    }

    // Filter consistent header/footer positions
    const findCommonPositions = (positions: number[], texts: string[]) => {
      const positionCounts = positions.reduce(
        (acc, y) => {
          acc[y] = (acc[y] || 0) + 1
          return acc
        },
        {} as { [key: number]: number }
      )

      const textCounts = texts.reduce(
        (acc, text) => {
          acc[text] = (acc[text] || 0) + 1
          return acc
        },
        {} as { [key: string]: number }
      )

      // Return positions that repeat and match consistent text patterns
      return new Set(
        Object.keys(positionCounts)
          .filter((y) => positionCounts[+y] >= 2 && textCounts[texts[+y]] >= 2)
          .map((y) => +y)
      )
    }

    return {
      headers: findCommonPositions(
        yPositions.headers,
        textContentByPage.headers
      ),
      footers: findCommonPositions(
        yPositions.footers,
        textContentByPage.footers
      )
    }
  }

  /**
   * Filters out headers and footers and focuses on body content.
   */
  private async getRefLines(doc: PDFDocumentProxy): Promise<PDFLine[]> {
    const { headers, footers } = await this.detectHeaderFooterPositions(doc)
    const numPages = doc.numPages
    const collectedLines: PDFLine[] = []
    let foundReferences = false

    for (
      let pageIndex = numPages;
      pageIndex >= 1 && !foundReferences;
      pageIndex--
    ) {
      const page = await doc.getPage(pageIndex)
      const textContent = await page.getTextContent()

      const pageItems: PDFItem[] = textContent.items.map((item: any) => ({
        str: item.str,
        height: item.transform[3],
        width: item.width,
        transform: item.transform,
        url: item.url
      }))

      const filteredItems = pageItems.filter((item) => {
        const y = Math.round(item.transform[5])
        const isHeader = [...headers].some(
          (headerY) => Math.abs(y - headerY) <= 0.2
        )
        const isFooter = [...footers].some(
          (footerY) => Math.abs(y - footerY) <= 0.2
        )

        // Exclude headers/footers
        return !isHeader && !isFooter
      })

      const pageLines = this.mergeSameLine(filteredItems)

      // Process lines from the page (bottom to top)
      for (let i = pageLines.length - 1; i >= 0; i--) {
        const line = pageLines[i]
        const text = line.text.trim()

        // Check if the line contains the "References" heading
        if (this.isRefHeading(text)) {
          foundReferences = true
          break
        }



        // Collect the line if "References" has not been found yet
        collectedLines.push(line)
      }
    }

    // Reverse the collected lines to maintain reading order
    return collectedLines.reverse()
  }
}

export default PDFParser
