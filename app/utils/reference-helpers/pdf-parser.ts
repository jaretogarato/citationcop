import { getDocument } from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'

import Utils from './utils'

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
   * Find consistent y-positions that likely represent headers/footers
   */
  private async findHeaderPositions(
    doc: PDFDocumentProxy
  ): Promise<Map<number, Set<number>>> {
    const headerPositions = new Map<number, Set<number>>()
    const pagesToAnalyze = Math.min(3, doc.numPages)
    const yPositions: { [pageNum: number]: Set<number> } = {}

    // Collect y-positions from first few pages
    for (let pageNum = 1; pageNum <= pagesToAnalyze; pageNum++) {
      const page = await doc.getPage(pageNum)
      const content = await page.getTextContent()
      yPositions[pageNum] = new Set()

      for (const item of content.items as any[]) {
        const y = Math.round(item.transform[5])
        yPositions[pageNum].add(y)
      }
    }

    // Find positions that appear on multiple pages
    const commonPositions = new Set<number>()
    Object.values(yPositions).forEach((positions) => {
      positions.forEach((y) => {
        let appearances = 0
        Object.values(yPositions).forEach((otherPositions) => {
          if ([y - 1, y, y + 1].some((py) => otherPositions.has(py))) {
            appearances++
          }
        })
        if (appearances >= 2) {
          commonPositions.add(y)
        }
      })
    })

    // Apply to all pages
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      headerPositions.set(pageNum, commonPositions)
    }

    return headerPositions
  }

  /**
   * Check if a position matches a header position (within tolerance)
   */
  private isHeaderPosition(
    y: number,
    pageNum: number,
    headerPositions: Map<number, Set<number>>
  ): boolean {
    const positions = headerPositions.get(pageNum)
    if (!positions) return false
    return Array.from(positions).some((headerY) => Math.abs(headerY - y) <= 5)
  }

  /**
   * Find references section and collect references
   */
  private async getRefLines(doc: PDFDocumentProxy): Promise<PDFLine[]> {
    const numPages = doc.numPages
    const collectedLines: PDFLine[] = []
    let foundReferences = false

    // Start from the last page and work upwards
    for (
      let pageIndex = numPages;
      pageIndex >= 1 && !foundReferences;
      pageIndex--
    ) {
      const page = await doc.getPage(pageIndex)
      const textContent = await page.getTextContent()

      // Convert items to lines
      const pageItems: PDFItem[] = textContent.items.map((item: any) => ({
        str: item.str,
        height: item.transform[3],
        width: item.width,
        transform: item.transform,
        url: item.url
      }))

      const pageLines = this.mergeSameLine(pageItems)

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
}

export default PDFParser
