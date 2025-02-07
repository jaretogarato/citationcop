import { PDFDocument } from 'pdf-lib'
import { getDocument, PDFDocumentProxy } from 'pdfjs-dist'
import { GlobalWorkerOptions } from 'pdfjs-dist'
import { PdfSlicerService } from './pdf-slicer-service'

GlobalWorkerOptions.workerSrc = '/workers/pdf.worker.js'

interface PageAnalysis {
  pageNumber: number
  isReferencesStart: boolean
  isNewSectionStart: boolean
  containsReferences: boolean
}

interface ProcessedPageResult {
  pageNumber: number
  imageData: string
  parsedText: string
  analysis: PageAnalysis
}

export class ReferencePageDetectionService {
  private readonly CHUNK_SIZE = 3
  private pdfDoc: PDFDocumentProxy | null = null

  async findReferencePages(file: File): Promise<ProcessedPageResult[]> {
    try {
      const arrayBuffer = await file.arrayBuffer()
      
      // Initialize both PDF libraries
      const pdfLibDoc = await PDFDocument.load(arrayBuffer)
      this.pdfDoc = await getDocument({ data: arrayBuffer }).promise
      
      const totalPages = pdfLibDoc.getPageCount()
      const results = await this.processPages(file, totalPages)
      return results.sort((a, b) => a.pageNumber - b.pageNumber)
    } finally {
      // Cleanup
      if (this.pdfDoc) {
        await this.pdfDoc.destroy()
        this.pdfDoc = null
      }
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

      const batchResults = await this.processBatch(file, batchStart, batchSize)

      for (let i = batchResults.length - 1; i >= 0; i--) {
        const result = batchResults[i]

        if (!foundReferenceStart) {
          if (result.analysis.isReferencesStart) {
            foundReferenceStart = true
            results.push(result)
          }
        } else {
          if (
            result.analysis.isNewSectionStart &&
            !result.analysis.isReferencesStart
          ) {
            reachedEnd = true
            break
          }

          if (result.analysis.containsReferences) {
            results.push(result)
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

  private async processBatch(
    file: File,
    startPage: number,
    batchSize: number
  ): Promise<ProcessedPageResult[]> {
    // Slice the batch of pages
    const pdfSlice = await this.slicePdfPages(file, startPage, batchSize)

    // Convert to images
    const images = await this.convertPdfToImages(pdfSlice)

    // Process each page
    const results: ProcessedPageResult[] = []

    for (let i = 0; i < images.length; i++) {
      const pageNumber = startPage + i
      const imageData = images[i]
      
      // Extract text from the page
      const parsedText = await this.extractPageText(pageNumber)
      
      // Analyze with both image and text
      const analysis = await this.analyzePage(imageData, parsedText)

      results.push({
        pageNumber,
        imageData,
        parsedText,
        analysis: {
          ...analysis,
          pageNumber
        }
      })
    }

    return results
  }

  private async extractPageText(pageNumber: number): Promise<string> {
    if (!this.pdfDoc) {
      throw new Error('PDF document not initialized')
    }

    const page = await this.pdfDoc.getPage(pageNumber)
    const textContent = await page.getTextContent()
    console.log('Text content:', textContent.items
      .map((item: any) => item.str)
      .join(' ')
      .trim())
    return textContent.items
      .map((item: any) => item.str)
      .join(' ')
      .trim()
  }

  private async slicePdfPages(
    file: File,
    startPage: number,
    pageCount: number
  ): Promise<ArrayBuffer> {
    const slicedPdf = await new PdfSlicerService().slicePdfPages(
      file,
      startPage,
      pageCount
    )
    return slicedPdf.arrayBuffer()
  }

  private async convertPdfToImages(pdfData: ArrayBuffer): Promise<string[]> {
    const formData = new FormData()
    formData.append(
      'pdf',
      new File([pdfData], 'chunk.pdf', { type: 'application/pdf' })
    )
    formData.append('range', '1-')

    const response = await fetch('/api/pdf2images', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error('Failed to convert PDF chunk to images')
    }

    const { images } = await response.json()
    return images.map((img: string) => `data:image/jpeg;base64,${img}`)
  }

  private async analyzePage(
    imageData: string,
    parsedText: string
  ): Promise<PageAnalysis> {
    const response = await fetch('/api/llama-vision/analyze-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath: imageData,
        parsedText,
        mode: 'free'
      })
    })

    if (!response.ok) {
      throw new Error('Failed to analyze page')
    }

    return await response.json()
  }
}