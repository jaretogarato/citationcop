import type { Reference } from '@/app/types/reference'
import { filterInvalidReferences } from '../../utils/reference-helpers/reference-helpers'
import { getDocument, PDFWorker, GlobalWorkerOptions } from 'pdfjs-dist'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
GlobalWorkerOptions.workerSrc = '/pdf.worker.js'

const pdfWorker = new PDFWorker()

export class PDFParseAndExtractReferenceService {
  private openAIEndpoint: string

  constructor(openAIEndpoint: string) {
    this.openAIEndpoint = openAIEndpoint
  }

  private async parsePDF(arrayBuffer: ArrayBuffer): Promise<string> {
    try {
      const uint8Array = new Uint8Array(arrayBuffer)
      const pdf = await getDocument({
        data: uint8Array,
        worker: pdfWorker
      }).promise
      //const pdf = await getDocument({ data: uint8Array }).promise

      let extractedText: {
        text: string
        x: number
        y: number
        fontSize: number
      }[] = []

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber)
        const textContent = await page.getTextContent()

        const pageText = textContent.items
          .filter((item): item is TextItem => 'transform' in item)
          .map((item) => ({
            text: item.str,
            x: item.transform[4],
            y: item.transform[5],
            fontSize: item.height
          }))

        extractedText.push(...pageText)
      }

      return this.cleanText(extractedText)
    } catch (error) {
      console.error('Error parsing PDF:', error)
      throw new Error('Failed to parse PDF')
    }
  }

  private cleanText(
    extractedText: Array<{
      text: string
      x: number
      y: number
      fontSize: number
    }>
  ): string {
    let lines = extractedText
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((item) => item.text)

    lines = lines.filter((line) => !this.isBoilerplateText(line))
    lines = lines.filter(
      (line) => this.isPotentialReference(line) || this.isAmbiguous(line)
    )

    return lines.join('\n')
  }

  private isBoilerplateText(line: string): boolean {
    const boilerplatePatterns = [
      /^Abstract$/i,
      /^Introduction$/i,
      /^Methodology$/i,
      /^Results$/i,
      /^Discussion$/i,
      /^Conclusion$/i,
      /^Table of Contents$/i,
      /^Appendix$/i,
      /^Page \d+$/i,
      /^\d+$/,
      /^\s*Figure \d+/i,
      /^\s*Table \d+/i
    ]

    return boilerplatePatterns.some((pattern) => pattern.test(line.trim()))
  }

  private isPotentialReference(line: string): boolean {
    const hasYear = /\b(19|20)\d{2}\b/.test(line)
    const hasAuthors =
      /([A-Z][a-z]+[\s,]+){1,}/.test(line) ||
      /[A-Z][a-z]+\s+and\s+[A-Z][a-z]+/.test(line)
    const hasDOI = /doi\.org|DOI:/i.test(line)
    const hasURL = /http|www\./i.test(line)
    const hasVolume = /Vol\.|Volume|\b\d+\(\d+\)/.test(line)
    const hasPages = /pp\.|pages|[\d]+[-–]\d+/.test(line)
    const hasJournal = /Journal|Proceedings|Conference|Trans\.|Symposium/i.test(
      line
    )
    const hasCitation = /^\[\d+\]/.test(line) || /\(\d{4}\)/.test(line)

    const referenceIndicators = [
      hasYear,
      hasAuthors,
      hasDOI,
      hasURL,
      hasVolume,
      hasPages,
      hasJournal,
      hasCitation
    ].filter(Boolean).length

    return referenceIndicators >= 2
  }

  private isAmbiguous(line: string): boolean {
    return line.trim().length > 30 && !this.isBoilerplateText(line)
  }

  public async parseAndExtractReferences(file: File): Promise<Reference[]> {
    try {
      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer()

      // Parse PDF directly
      const parsedText = await this.parsePDF(arrayBuffer)

      // Send the extracted text to OpenAI for reference extraction
      const response = await fetch(this.openAIEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: parsedText })
      })

      if (!response.ok) {
        throw new Error(`OpenAI API failed: ${response.statusText}`)
      }

      const { references }: { references: Reference[] } = await response.json()
      console.log('📥 Received references from OpenAI:', references)

      const filteredReferences: Reference[] =
        filterInvalidReferences(references)

      return filteredReferences
    } catch (error) {
      console.error('Error in parseAndExtractReferences:', error)
      throw error
    }
  }
}
