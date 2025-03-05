import { getDocument, PDFDocumentProxy, GlobalWorkerOptions } from 'pdfjs-dist'
import { PdfSlicerService } from './pdf-slicer-service'

// Ensure the correct worker is used
GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

// Types used for text extraction
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

interface ProcessedPageResult {
  pageNumber: number
  imageData: string
  parsedContent: {
    lines: PDFLine[]
    rawText: string
  }
  analysis: {
    // Minimal flags for compatibility.
    hasReferencesHeader: boolean
    hasNewSectionStart: boolean
    hasReferences: boolean
    pageNumber: number
  }
}

interface PageAnalysisResult {
  pageNumber: number
  imageData: string
  result: any
}

export class ReferencePageDetectionService {
  private pdfDoc: PDFDocumentProxy | null = null
  private currentFile: File | null = null
  private imageCache: Map<number, string> = new Map()

  /**
   * Initialize the service with a PDF file
   */
  async initialize(file: File | ArrayBuffer | Blob): Promise<void> {
    try {
      let arrayBuffer: ArrayBuffer
      if (file instanceof File) {
        this.currentFile = file
        arrayBuffer = await file.arrayBuffer()
      } else if (file instanceof Blob) {
        this.currentFile = new File([file], 'document.pdf', {
          type: 'application/pdf'
        })
        arrayBuffer = await file.arrayBuffer()
      } else {
        this.currentFile = new File([file], 'document.pdf', {
          type: 'application/pdf'
        })
        arrayBuffer = file
      }
      this.pdfDoc = await getDocument({ data: arrayBuffer }).promise
      console.log(`Initialized PDF with ${this.pdfDoc.numPages} pages`)
    } catch (error) {
      console.error('Error initializing PDF document:', error)
      throw error
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.pdfDoc) {
      await this.pdfDoc.destroy()
      this.pdfDoc = null
      this.currentFile = null
    }
    this.imageCache.clear()
  }

  /**
   * Get the image data for a specific page
   */
  async getPageImage(pageNumber: number): Promise<string> {
    try {
      if (!this.currentFile) throw new Error('No file available')

      // Check cache first
      if (this.imageCache.has(pageNumber)) {
        return this.imageCache.get(pageNumber)!
      }

      const pdfSlicer = new PdfSlicerService()
      const pdfSlice = await pdfSlicer.slicePdfPages(
        this.currentFile,
        pageNumber,
        1
      )
      const sliceArrayBuffer = await pdfSlice.arrayBuffer()
      const images = await this.convertPdfToImages(sliceArrayBuffer)

      if (images && images.length > 0) {
        this.imageCache.set(pageNumber, images[0])
        return images[0]
      } else {
        throw new Error(`Failed to convert page ${pageNumber} to image`)
      }
    } catch (error) {
      console.error(`Error fetching page ${pageNumber}:`, error)
      throw error
    }
  }

  /**
   * Fetch the previous page's image for the API tool
   */
  async earlierPage(current_page: number): Promise<any> {
    try {
      const requestedPage = Math.max(1, current_page - 1) // Move backwards
      const imageData = await this.getPageImage(requestedPage)

      return {
        success: true,
        page: requestedPage,
        is_first_page: requestedPage === 1,
        image: imageData,
        message: `Successfully retrieved page ${requestedPage}`
      }
    } catch (error) {
      console.error('Error in earlierPage function:', error)
      return {
        success: false,
        error: `Failed to fetch earlier page: ${error instanceof Error ? error.message : String(error)}`,
        suggestion:
          'There was an error retrieving the previous page of the document.'
      }
    }
  }

  /**
   * Process a single page for reference detection
   */
  private async processPage(
    pageNumber: number,
    totalPages: number
  ): Promise<PageAnalysisResult> {
    try {
      const imageData = await this.getPageImage(pageNumber)

      // Call the reference detection API for the current page
      const result = await this.callReferenceDetectionWithTools(
        imageData,
        pageNumber,
        totalPages
      )

      return {
        pageNumber,
        imageData,
        result
      }
    } catch (error) {
      console.error(`Error processing page ${pageNumber}:`, error)
      throw error
    }
  }

  /**
   * Call the reference detection API and handle any tool calls recursively
   */
  private async callReferenceDetectionWithTools(
    pageImage: string,
    pageNumber: number,
    totalPages: number,
    iteration: number = 0,
    previousMessages: any[] = [],
    functionResult: any = null,
    lastToolCallId: string | null = null
  ): Promise<any> {
    try {
      const apiResponse: Response = await fetch(
        '/api/open-ai-vision/find-references-section',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pageImage,
            pageNumber,
            totalPages,
            iteration,
            previousMessages,
            functionResult,
            lastToolCallId
          })
        }
      )

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text()
        console.error('Error from reference detection API:', errorText)
        throw new Error('Failed to get response from reference detection API')
      }

      const result = await apiResponse.json()

      // If a tool call is requested (e.g. "next_page"), execute it and re-call recursively
      if (result.status === 'pending' && result.functionToCall) {
        console.log(`Executing tool: ${result.functionToCall.name}`)
        if (result.functionToCall.name === 'next_page') {
          const args = result.functionToCall.arguments
          const toolResult = await this.earlierPage(args.current_page)
          return this.callReferenceDetectionWithTools(
            pageImage,
            pageNumber,
            totalPages,
            result.iteration,
            result.messages,
            toolResult,
            result.lastToolCallId
          )
        } else {
          console.warn(
            `Unexpected function call: ${result.functionToCall.name}`
          )
          return result
        }
      }

      return result
    } catch (error) {
      console.error('Error in callReferenceDetectionWithTools:', error)
      throw error
    }
  }

  /**
   * Find reference pages in the PDF document
   */
  async findReferencePages(
    file?: File | ArrayBuffer | Blob
  ): Promise<ProcessedPageResult[]> {
    try {
      if (file) {
        await this.initialize(file)
      }

      if (!this.pdfDoc || !this.currentFile) {
        throw new Error('PDF document not initialized')
      }

      const totalPages = this.pdfDoc.numPages
      let currentPage = totalPages
      let referencePages: number[] | null = null

      // Process pages one at a time until the LLM returns a valid final response
      while (currentPage >= 1 && referencePages === null) {
        console.log(`Processing page ${currentPage}`)

        // Process the current page
        const pageResult = await this.processPage(currentPage, totalPages)

        // Check if this page contains a valid reference page result
        if (pageResult.result.status === 'complete') {
          if (
            pageResult.result.response &&
            pageResult.result.response.content
          ) {
            try {
              const parsedResult = JSON.parse(
                pageResult.result.response.content
              )
              if (parsedResult.references != null) {
                referencePages = parsedResult.references
                console.log('Found reference pages:', referencePages)
                break // Found reference pages, exit the loop
              } else {
                console.error(
                  'JSON parsed but "references" key is null. Continuing search...'
                )
              }
            } catch (parseError) {
              console.error(
                `Failed to parse response as JSON for page ${pageResult.pageNumber}:`,
                parseError
              )
            }
          }
        }

        // Move to the previous page
        currentPage--
      }

      if (!referencePages || referencePages.length === 0) {
        throw new Error('No reference pages found in the document')
      }

      // For each reference page, prepare the final result
      const finalResults: ProcessedPageResult[] = await Promise.all(
        referencePages.map(async (pageNum) => {
          // Get image data (should already be cached from earlier processing)
          let imageData = this.imageCache.get(pageNum) || ''
          if (!imageData) {
            imageData = await this.getPageImage(pageNum)
          }

          // Extract text content
          const parsedContent = await this.extractPageContent(pageNum)

          return {
            pageNumber: pageNum,
            imageData,
            parsedContent,
            analysis: {
              hasReferencesHeader: true,
              hasNewSectionStart: false,
              hasReferences: true,
              pageNumber: pageNum
            }
          }
        })
      )

      return finalResults.sort((a, b) => a.pageNumber - b.pageNumber)
    } catch (error) {
      console.error('Error finding reference pages:', error)
      throw error
    }
  }

  /**
   * Convert PDF data to images
   */
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
      const errorText = await response.text()
      console.error('Error response from API:', errorText)
      throw new Error('Failed to convert PDF chunk to images')
    }
    const jsonResponse = await response.json()
    const { images } = jsonResponse
    if (!images || !Array.isArray(images)) {
      console.error('API response does not contain images:', jsonResponse)
      throw new Error('Invalid response: missing images array')
    }
    return images.map((img: string) => `data:image/jpeg;base64,${img}`)
  }

  /**
   * Extract text content from a page using pdfjs-dist
   */
  private async extractPageContent(
    pageNumber: number
  ): Promise<{ lines: PDFLine[]; rawText: string }> {
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
    const rawText = lines
      .map((line) => line.text)
      .join('\n')
      .trim()
    return { lines, rawText }
  }

  /**
   * Merge text items that are on the same line
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
}
