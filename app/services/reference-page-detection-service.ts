// service to find reference pages in a PDF document
// This service uses the Llama Vision API to analyze PDF pages
// and determine if they contain references
// It also uses the PDF.js library to extract text content from PDF pages
// and convert PDF pages to images
// The service returns an array of ProcessedPageResult objects
// which contain the page number, image data, parsed content, and analysis results
// for each page in the document
// The service also provides a method to initialize and cleanup the PDF document

import { PDFDocument } from 'pdf-lib'
import { getDocument, PDFDocumentProxy, GlobalWorkerOptions } from 'pdfjs-dist'
import { PdfSlicerService } from './pdf-slicer-service'

//GlobalWorkerOptions.workerSrc = '/workers/pdf.worker.js'

// Ensure the correct worker is used
GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

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

interface PageAnalysis {
  pageNumber: number
  hasReferencesHeader: boolean
  hasNewSectionStart: boolean
  hasReferences: boolean
  error?: string
}

interface ProcessedPageResult {
  pageNumber: number
  imageData: string
  parsedContent: {
    lines: PDFLine[]
    rawText: string
  }
  analysis: PageAnalysis
}

export class ReferencePageDetectionService {
  private readonly CHUNK_SIZE = 3
  private pdfDoc: PDFDocumentProxy | null = null
  //private pdfSlicer = new PdfSlicerService()

  async initialize(file: File) {
    const arrayBuffer = await file.arrayBuffer()
    this.pdfDoc = await getDocument({ data: arrayBuffer }).promise
  }

  async cleanup() {
    if (this.pdfDoc) {
      await this.pdfDoc.destroy()
      this.pdfDoc = null
    }
  }

  async findReferencePages(file: File): Promise<ProcessedPageResult[]> {
    try {
      const fileSizeMB = file.size / (1024 * 1024)
      //console.log(`Original PDF size: ${fileSizeMB.toFixed(2)} MB`)
      const arrayBuffer = await file.arrayBuffer()
      const pdfLibDoc = await PDFDocument.load(arrayBuffer)
      const totalPages = pdfLibDoc.getPageCount()

      // Process pages in batches from the end
      const results = await this.processPages(file, totalPages)
      return results.sort((a, b) => a.pageNumber - b.pageNumber)
    } catch (error) {
      console.error('Error finding reference pages:', error)
      throw error
    }
  }

  private async processPages(
    file: File,
    totalPages: number
  ): Promise<ProcessedPageResult[]> {
    const results: ProcessedPageResult[] = []
    let currentPage = totalPages
    let referenceStartPage = -1
    let foundReferenceHeader = false
    let tempResults: ProcessedPageResult[] = [] // To store pages with references before finding header

    // Search backward for reference header
    while (currentPage >= 1 && !foundReferenceHeader) {
      const batchEnd = currentPage
      const batchStart = Math.max(1, currentPage - this.CHUNK_SIZE + 1)
      const batchSize = batchEnd - batchStart + 1

      const pdfSlicer = new PdfSlicerService()
      const pdfSlice = await pdfSlicer.slicePdfPages(
        file,
        batchStart,
        batchSize
      )
      const arrayBuffer = await pdfSlice.arrayBuffer()
      const images = await this.convertPdfToImages(arrayBuffer)

      // Process each page in the batch in reverse order
      for (let i = images.length - 1; i >= 0; i--) {
        const pageNumber = batchStart + i
        const imageData = images[i]
        const parsedContent = await this.extractPageContent(pageNumber)
        const analysis = await this.analyzePage(
          imageData,
          parsedContent.rawText
        )

        console.log('📄 Page:', pageNumber)
        console.log('🔍 Analysis:', analysis)

        const pageResult: ProcessedPageResult = {
          pageNumber,
          imageData,
          parsedContent,
          analysis: {
            ...analysis,
            pageNumber
          }
        }

        // Check if this page has a reference header
        if (analysis.hasReferencesHeader) {
          console.log(
            'Found reference header on page',
            pageNumber,
            '- stopping backward search'
          )
          foundReferenceHeader = true
          referenceStartPage = pageNumber
          results.push(pageResult)

          // Add all previously found pages that contain references and come after the reference header
          if (tempResults.length > 0) {
            const validTempResults = tempResults.filter(
              (r) =>
                r.pageNumber > pageNumber &&
                r.analysis.hasReferences &&
                !r.analysis.hasNewSectionStart
            )
            // Process valid results in order to properly detect the end of references
            validTempResults.sort((a, b) => a.pageNumber - b.pageNumber)

            // Add pages until we hit a non-reference page or a new section start
            for (const result of validTempResults) {
              if (
                !result.analysis.hasReferences ||
                (result.analysis.hasNewSectionStart &&
                  !result.analysis.hasReferencesHeader)
              ) {
                break
              }
              results.push(result)
            }
          }

          // Exit both loops immediately
          currentPage = 0
          break
        }
        // If no header but has references, store it temporarily
        else if (analysis.hasReferences) {
          tempResults.push(pageResult)
        }
      }

      // Move to earlier pages if we haven't found a header yet
      if (!foundReferenceHeader) {
        currentPage = batchStart - 1
      }
    }

    // If we've searched the entire document and found no reference header
    // but found pages with references, use the first page with references as the start
    if (!foundReferenceHeader && tempResults.length > 0) {
      console.log(
        'No explicit reference header found, using first page with references'
      )
      // Sort by page number and use the earliest page with references
      tempResults.sort((a, b) => a.pageNumber - b.pageNumber)

      // Find the sequence of consecutive reference pages
      const finalResults = []

      for (const result of tempResults) {
        if (
          !result.analysis.hasReferences ||
          (result.analysis.hasNewSectionStart &&
            !result.analysis.hasReferencesHeader)
        ) {
          break
        }
        finalResults.push(result)
      }

      if (finalResults.length > 0) {
        results.push(...finalResults)
        referenceStartPage = finalResults[0].pageNumber
        foundReferenceHeader = true // Treat it as if we found a header
      }
    }

    // If we still haven't found anything, throw an error
    if (!foundReferenceHeader) {
      throw new Error('Could not find references section in the document')
    }

    return results.sort((a, b) => a.pageNumber - b.pageNumber)
  }

  private async extractPageContent(pageNumber: number): Promise<{
    lines: PDFLine[]
    rawText: string
  }> {
    if (!this.pdfDoc) {
      throw new Error('PDF document not initialized')
    }

    const page = await this.pdfDoc.getPage(pageNumber)
    const textContent = await page.getTextContent()

    const items: PDFItem[] = textContent.items.map((item: any) => ({
      str: item.str,
      height: item.transform[3],
      width: item.width,
      transform: item.transform
    }))

    const lines = this.mergeSameLine(items)
    /*const rawText = items
      .map((item) => item.str)
      .join(' ')
      .trim()*/
    const rawText = lines
      .map((line) => line.text)
      .join('\n')
      .trim()

    return { lines, rawText }
  }

  private async convertPdfToImages(pdfData: ArrayBuffer): Promise<string[]> {
    const formData = new FormData()
    formData.append(
      'pdf',
      new File([pdfData], 'chunk.pdf', { type: 'application/pdf' })
    )
    formData.append('range', '1-')

    /*console.log(
      '📄 Sending request to /api/pdf2images with FormData:',
      formData
    )*/

    const response = await fetch('/api/pdf2images', {
      method: 'POST',
      body: formData
    })

    //console.log('📥 Received API response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Error response from API:', errorText)
      throw new Error('Failed to convert PDF chunk to images')
    }

    const jsonResponse = await response.json()
    //console.log('📄 Parsed JSON Response from API:', jsonResponse)

    const { images } = jsonResponse

    if (!images || !Array.isArray(images)) {
      console.error('❌ API response does not contain images:', jsonResponse)
      throw new Error('Invalid response: missing images array')
    }

    return images.map((img: string) => `data:image/jpeg;base64,${img}`)
  }

  private async analyzePage(
    imageData: string,
    parsedText: string
  ): Promise<PageAnalysis> {
    //const response = await fetch('/api/llama-vision/analyze-page', {
    const response = await fetch('/api/open-ai-vision/analyze-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath: imageData,
        parsedText, // Include parsed text in the analysis
        mode: 'free'
      })
    })

    if (!response.ok) {
      throw new Error('Failed to analyze page')
    }

    return await response.json()
  }

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
}
