import { PDFDocument } from 'pdf-lib'
import { getDocument, PDFDocumentProxy } from 'pdfjs-dist'
import { GlobalWorkerOptions } from 'pdfjs-dist'
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
      console.log(`Original PDF size: ${fileSizeMB.toFixed(2)} MB`)
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

      const pdfSlicer = new PdfSlicerService()
      // Process batch of pages
      const pdfSlice = await pdfSlicer.slicePdfPages(
        file,
        batchStart,
        batchSize
      )
      const arrayBuffer = await pdfSlice.arrayBuffer()

      // Calculate size in MB
      const sizeInMB = arrayBuffer.byteLength / (1024 * 1024)
      const isOverLimit = sizeInMB > 4

      console.log(
        `Chunk pages ${batchStart}-${batchEnd} (${batchSize} pages): ` +
          `${sizeInMB.toFixed(2)} MB ${isOverLimit ? '⚠️ OVER 4MB LIMIT!' : ''}`
      )

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
    const rawText = items
      .map((item) => item.str)
      .join(' ')
      .trim()

    return { lines, rawText }
  }

  private async convertPdfToImages(pdfData: ArrayBuffer): Promise<string[]> {
    const chunkSizeMB = pdfData.byteLength / (1024 * 1024)
    console.log(`About to send chunk of size: ${chunkSizeMB.toFixed(2)} MB`)


    const newPDF = new File([pdfData], 'chunk.pdf', { type: 'application/pdf' })
    const fileSizeMB2 = newPDF.size / (1024 * 1024)
    console.log(`New PDF size: ${fileSizeMB2.toFixed(2)} MB`)

    const formData = new FormData()
    formData.append(
      'pdf',
      newPDF
      //new File([pdfData], 'chunk.pdf', { type: 'application/pdf' })
    )
    formData.append('range', '1-')


    const formDataFile = formData.get('pdf') as File
    console.log(`FormData file size before fetch: ${(formDataFile.size / (1024 * 1024)).toFixed(2)} MB`)


    const response = await fetch('/api/pdf2images', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error('Failed to convert PDF page to images')
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
