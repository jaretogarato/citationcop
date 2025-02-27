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

GlobalWorkerOptions.workerSrc = '/workers/pdf.worker.js'

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
  isReferencesStart: boolean
  isNewSectionStart: boolean
  containsReferences: boolean
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
    let foundReferenceStart = false
    let reachedEnd = false

    while (currentPage >= 1 && !reachedEnd) {
      const batchEnd = currentPage
      const batchStart = Math.max(1, currentPage - this.CHUNK_SIZE + 1)
      const batchSize = batchEnd - batchStart + 1

      //console.log(`Processing pages ${batchStart}-${batchEnd}`)

      const pdfSlicer = new PdfSlicerService()
      // Process batch of pages
      const pdfSlice = await pdfSlicer.slicePdfPages(
        file,
        batchStart,
        batchSize
      )
      const arrayBuffer = await pdfSlice.arrayBuffer()

      const images = await this.convertPdfToImages(arrayBuffer)

      // Process each page in the batch
      for (let i = images.length - 1; i >= 0; i--) {
        const pageNumber = batchStart + i
        const imageData = images[i]

        // Get structured content for the page
        const parsedContent = await this.extractPageContent(pageNumber)

        // Analyze page using both image and text
        const analysis = await this.analyzePage(
          imageData,
          parsedContent.rawText
        )

        const pageResult: ProcessedPageResult = {
          pageNumber,
          imageData,
          parsedContent,
          analysis: {
            ...analysis,
            pageNumber
          }
        }

        if (!foundReferenceStart) {
          if (analysis.isReferencesStart) {
            foundReferenceStart = true
            results.push(pageResult)
          }
        } else {
          if (analysis.isNewSectionStart && !analysis.isReferencesStart) {
            reachedEnd = true
            break
          }

          if (analysis.containsReferences) {
            results.push(pageResult)
          } else {
            reachedEnd = true
            break
          }
        }
      }

      currentPage = batchStart - 1
    }

    if (!foundReferenceStart) {
      throw new Error('Could not find references section in the document')
    }

    return results
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
