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

export class ReferencePageDetectionService {
  private readonly CHUNK_SIZE = 3
  private pdfDoc: PDFDocumentProxy | null = null
  private currentFile: File | null = null
  private imageCache: Map<number, string> = new Map()

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

  async cleanup(): Promise<void> {
    if (this.pdfDoc) {
      await this.pdfDoc.destroy()
      this.pdfDoc = null
      this.currentFile = null
    }
    this.imageCache.clear()
  }

  // Fetch the previous page’s image.
  async earlierPage(current_page: number): Promise<any> {
    try {
      if (!this.currentFile) throw new Error('No file available')
      const requestedPage = Math.max(1, current_page - 1) // Move backwards
      const pdfSlicer = new PdfSlicerService()
      const pdfSlice = await pdfSlicer.slicePdfPages(
        this.currentFile,
        requestedPage,
        1
      )
      const sliceArrayBuffer = await pdfSlice.arrayBuffer()
      const images = await this.convertPdfToImages(sliceArrayBuffer)
      if (images && images.length > 0) {
        return {
          success: true,
          page: requestedPage,
          is_first_page: requestedPage === 1,
          image: images[0],
          message: `Successfully retrieved page ${requestedPage}`
        }
      } else {
        throw new Error('Failed to convert page to image')
      }
    } catch (error) {
      console.error('Error in nextPage function:', error)
      return {
        success: false,
        error: `Failed to fetch next page: ${error instanceof Error ? error.message : String(error)}`,
        suggestion:
          'There was an error retrieving the next page of the document.'
      }
    }
  }

  // Call the reference detection API and handle any tool calls recursively.
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
      // If a tool call is requested (e.g. "next_page"), execute it and re-call recursively.
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

  // This method finds the reference pages, returning an array of ProcessedPageResult objects.
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

      // Process pages (one at a time) until the LLM returns a valid final response.
      while (currentPage >= 1 && referencePages === null) {
        const pdfSlicer = new PdfSlicerService()
        const pdfSlice = await pdfSlicer.slicePdfPages(
          this.currentFile,
          currentPage,
          1
        )
        const arrayBuffer = await pdfSlice.arrayBuffer()

        // Check the cache first.
        let images = this.imageCache.has(currentPage)
          ? [this.imageCache.get(currentPage)!]
          : await this.convertPdfToImages(arrayBuffer)

        if (!this.imageCache.has(currentPage) && images.length > 0) {
          this.imageCache.set(currentPage, images[0])
        }

        if (images.length === 0) {
          throw new Error(`Could not retrieve image for page ${currentPage}`)
        }
        const imageData = images[0]

        // Call the reference detection API for the current page.
        const finalResult = await this.callReferenceDetectionWithTools(
          imageData,
          currentPage,
          totalPages
        )

        // Check for a complete result with valid content.
        if (finalResult.status === 'complete') {
          if (finalResult.response && finalResult.response.content) {
            try {
              const parsedResult = JSON.parse(finalResult.response.content)
              if (parsedResult.references != null) {
                referencePages = parsedResult.references
                console.log('Final reference pages:', referencePages)
                break
              } else {
                console.error(
                  'JSON parsed but "references" key is null. Continuing search...'
                )
              }
            } catch (parseError) {
              console.error(
                'Failed to parse final response as JSON with a "references" key:',
                parseError
              )
            }
          } else {
            console.error(
              'Final response content is null. Continuing search...'
            )
          }
        }
        // If not complete, move to the previous page.
        currentPage--
      }

      if (!referencePages || referencePages.length === 0) {
        throw new Error('No reference pages found in the document')
      }

      // For each reference page, retrieve imageData and extract text from cache if available.
      const finalResults: ProcessedPageResult[] = await Promise.all(
        referencePages.map(async (pageNum) => {
          let imageData = this.imageCache.get(pageNum) || ''
          if (!imageData) {
            const pdfSlicer = new PdfSlicerService()
            const pdfSlice = await pdfSlicer.slicePdfPages(
              this.currentFile!,
              pageNum,
              1
            )
            const arrayBuffer = await pdfSlice.arrayBuffer()
            const images = await this.convertPdfToImages(arrayBuffer)
            if (images.length > 0) {
              imageData = images[0]
              this.imageCache.set(pageNum, imageData)
            }
          }
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

  // Extract text content from a page using pdfjs-dist.
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

  // Merge text items that are on the same line.
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
