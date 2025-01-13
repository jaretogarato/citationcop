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
  public refRegex: RegExp[][] // same as before
  public utils: Utils

  constructor(utils?: Utils) {
    this.utils = utils || new Utils()
    this.refRegex = [
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
  }

  /**
   * Main entry point: loads the PDF, scans from the bottom for “References” heading,
   * merges lines, and returns an array of references.
   */
  public async parseReferencesFromPdfBuffer(
    pdfBuffer: ArrayBuffer
  ): Promise<ParsedReference[]> {
    const doc: PDFDocumentProxy = await getDocument({ data: pdfBuffer }).promise
    // Step 1: get all lines from the “references section” only
    const refLines = await this.getRefLines(doc)

    // Step 2: merge lines that belong to the same reference
    const mergedRefLines = this.mergeSameRef(refLines)

    // Step 3: parse them using `utils.refText2Info(...)`
    const references = mergedRefLines.map((line) => {
      const parsedInfo = this.utils.refText2Info(line.text)
      return { ...line, ...parsedInfo } as ParsedReference
    })

    return references
  }

  /**
   * Grabs lines from pages (scanning from last to first),
   * looks for a heading matching “References/Bibliography/参考文献”,
   * and once found, collects lines to return as potential references.
   */
  private async getRefLines(doc: PDFDocumentProxy): Promise<PDFLine[]> {
    const numPages = doc.numPages
    let refPart: PDFLine[] = []
    let foundHeading = false

    // Scan from last page up until we find the heading
    for (
      let pageIndex = numPages;
      pageIndex >= 1 && !foundHeading;
      pageIndex--
    ) {
      const page: PDFPageProxy = await doc.getPage(pageIndex)
      const textContent = await page.getTextContent()

      const pageItems: PDFItem[] = textContent.items.map((item: any) => ({
        str: item.str,
        height: item.transform[3],
        width: item.width,
        transform: item.transform,
        url: item.url
      }))

      // Merge items into lines (top-down order)
      const pageLines = this.mergeSameLine(pageItems)

      // Reverse so we read bottom-up
      const bottomUp = [...pageLines].reverse()

      for (let i = 0; i < bottomUp.length; i++) {
        const line = bottomUp[i]

        if (this.isRefHeading(line.text)) {
          console.log('Found heading - stopping collection')
          foundHeading = true
          break
        }

        // Add this line to our collection
        refPart.push(line)
      }
    }

    if (!foundHeading) {
      return [] // Never found the heading
    }

    // refPart has references in bottom-up order (because we read that way)
    // so reverse to get them in reading order
    return refPart.reverse()
  }

  /**
   * Check if a line is a heading for references.
   * Could be “References”, “Bibliography”, or the Chinese “参考文献”.
   */
  private isRefHeading(text: string): boolean {
    // Lowercase and trim
    let s = text.trim().toLowerCase()
    // Remove trailing punctuation like . , : etc.:
    s = s.replace(/[.,:\-–;!]+$/g, '') // remove punctuation at end
    s = s.replace(/^[.,:\-–;!]+/g, '') // remove punctuation at start

    return s === 'references' || s === 'bibliography' || /参考文献/i.test(s)
  }

  /**
   * Merge PDF items with similar Y coords => lines
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

    // For simplicity, just collect lines from top to bottom
    // But note: in PDF coords, top has smaller y, bottom has bigger y.
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
        // finalize the previous line's height
        prevLine.height = Math.max(...prevLine._height)
        lines.push(current)
      }
    }

    // finalize the last line
    lines[lines.length - 1].height = Math.max(
      ...lines[lines.length - 1]._height
    )
    return lines
  }

  /**
   * Merge lines that share the same reference type (based on refRegex)
   * into a single “reference” line.
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
        // Start new reference
        currentRef = { ...line }
        currentRefType = lineType
        continue
      }

      // if line also appears to be a new reference (same ref type):
      if (lineType !== -1 && lineType === currentRefType) {
        out.push(currentRef)
        currentRef = { ...line }
      } else {
        // otherwise treat as continuation
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
   * Decide which “type” of reference line it is (based on refRegex sets).
   */
  private getRefType(text: string): number {
    for (let i = 0; i < this.refRegex.length; i++) {
      const patternSet = this.refRegex[i]
      const matches = patternSet.some((regex) => {
        const raw = text.trim()
        return regex.test(raw) || regex.test(raw.replace(/\s+/g, ''))
      })
      if (matches) {
        return i
      }
    }
    return -1
  }
}

export default PDFParser
