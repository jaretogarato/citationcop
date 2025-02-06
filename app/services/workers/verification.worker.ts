/// <reference lib="webworker" />

import { WorkerMessage } from '../types'
import { SearchReferenceService } from '@/app/services/search-reference-service'
import { VerifyReferenceService } from '../verify-reference-service'

import { PdfSlicerService } from '../pdf-slicer-service'
import type { Reference } from '@/app/types/reference'
import { PDFDocument } from 'pdf-lib'

declare const self: DedicatedWorkerGlobalScope

const searchReferenceService = new SearchReferenceService()
const verifyReferenceService = new VerifyReferenceService()
const pdfSlicer = new PdfSlicerService()

interface PageAnalysis {
  pageNumber: number
  isReferencesStart: boolean
  isNewSectionStart: boolean
  containsReferences: boolean
}

interface PageResult {
  pageNumber: number
  markdown: string
  isStartOfSection?: boolean
  isNewSectionStart?: boolean
}

// Listen for messages
self.onmessage = async (e: MessageEvent) => {
  const { type, pdfId, file } = e.data

  if (type === 'process') {
    try {
      self.postMessage({
        type: 'update',
        pdfId: pdfId,
        message: `Worker launched for : ${pdfId}`
      })

      // Get total number of pages first
      const arrayBuffer = await file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer)
      const totalPages = pdfDoc.getPageCount()

      // STEP 1: Iteratively search for references section from the end
      let chunkSize = 3
      let referencesSectionStart: number | null = null
      let currentChunk = 0
      let lastProcessedImages: string[] = []
      let lastStartPage = 0

      while (referencesSectionStart === null) {
        // Calculate start page for current chunk from the end
        const startPage = Math.max(
          1,
          totalPages - (currentChunk + 1) * chunkSize
        )
        lastStartPage = startPage

        self.postMessage({
          type: 'update',
          pdfId,
          message: `Analyzing pages ${startPage + 1}-${startPage + chunkSize}`
        })
        // Slice current chunk
        const slicedPdf = await pdfSlicer.slicePdfPages(
          file,
          startPage,
          chunkSize
        )

        // Convert sliced PDF to images
        const formData = new FormData()
        formData.append(
          'pdf',
          new File([slicedPdf], 'chunk.pdf', { type: 'application/pdf' })
        )
        formData.append('range', '1-')

        const pdfResponse = await fetch('/api/pdf2images', {
          method: 'POST',
          body: formData
        })

        if (!pdfResponse.ok) {
          throw new Error('Failed to convert PDF chunk to images')
        }

        const { images } = await pdfResponse.json()
        lastProcessedImages = images.map(
          (img: string) => `data:image/jpeg;base64,${img}`
        )

        // Analyze each page in the chunk
        for (let i = images.length - 1; i >= 0; i--) {
          const currentPage = startPage + i
          const analysis = await analyzePage(lastProcessedImages[i])

          if (analysis.isReferencesStart) {
            referencesSectionStart = i
            self.postMessage({
              type: 'update',
              pdfId,
              message: `Found references section starting on page ${currentPage}`
            })
            break
          }
        }

        if (referencesSectionStart === null) {
          currentChunk++
          if (startPage <= 1) {
            throw new Error('Could not find references section in the document')
          }
        }
      }

      // STEP 2: Process references section and get markdown content
      self.postMessage({
        type: 'update',
        pdfId,
        message: 'Processing references section'
      })

      const collectedResults: PageResult[] = []
      let referencesSectionEnd: number | null = null

      // Start from the references section and continue until we find the end
      let currentPage = lastStartPage + referencesSectionStart
      let reachedEnd = false

      while (!reachedEnd && currentPage <= totalPages) {
        // Slice and process current page
        const slicedPdf = await pdfSlicer.slicePdfPages(file, currentPage, 1)
        const formData = new FormData()
        formData.append(
          'pdf',
          new File([slicedPdf], 'chunk.pdf', { type: 'application/pdf' })
        )
        formData.append('range', '1-')

        const pdfResponse = await fetch('/api/pdf2images', {
          method: 'POST',
          body: formData
        })

        if (!pdfResponse.ok) {
          throw new Error('Failed to convert PDF page to image')
        }

        const { images } = await pdfResponse.json()
        const imageData = `data:image/jpeg;base64,${images[0]}`

        // Get page analysis
        const analysis = await analyzePage(imageData)

        // Check if we've reached the end of references section
        if (
          (analysis.isNewSectionStart && !analysis.isReferencesStart) ||
          !analysis.containsReferences
        ) {
          referencesSectionEnd = currentPage - 1
          self.postMessage({
            type: 'update',
            pdfId,
            message: 'Reached end of references section'
          })
          reachedEnd = true
        }

        // Get markdown content
        const markdownResponse = await fetch('/api/llama-vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filePath: imageData,
            mode: 'free'
          })
        })

        if (!markdownResponse.ok) {
          throw new Error('Failed to extract references content')
        }

        const { markdown: pageMarkdown } = await markdownResponse.json()

        collectedResults.push({
          pageNumber: currentPage,
          markdown: pageMarkdown,
          isStartOfSection:
            currentPage === lastStartPage + referencesSectionStart,
          isNewSectionStart: analysis.isNewSectionStart
        })

        self.postMessage({
          type: 'update',
          pdfId,
          message: `Processed page ${currentPage}`
        })

        if (!reachedEnd) {
          currentPage++
        }
      }

      if (collectedResults.length === 0) {
        throw new Error('No references content extracted')
      }

      // STEP 3: Extract structured references from markdown
      self.postMessage({
        type: 'update',
        pdfId,
        message: 'Extracting structured references'
      })

      const referencePagesMarkdown = collectedResults
        .map((r) => r.markdown)
        .join('\n\n')

      const extractResponse = await fetch('/api/references/extract/chunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: referencePagesMarkdown })
      })

      if (!extractResponse.ok) {
        throw new Error('Failed to extract references')
      }

      const { references: extractedReferences } = await extractResponse.json()

      if (!extractedReferences) {
        throw new Error('No references extracted from markdown')
      }

      self.postMessage({
        type: 'references',
        pdfId: pdfId,
        noReferences: extractedReferences.length,
        message: `Found ${extractedReferences.length} references for ${pdfId}`
      })

      // STEP 4: Process through search and verification
      const referencesWithSearch: Reference[] =
        await searchReferenceService.processBatch(
          extractedReferences,
          (batchResults) => {
            self.postMessage({
              type: 'update',
              pdfId,
              message: `✅ search batch complete for ${pdfId}`
            })
          }
        )

      const verifiedReferences: Reference[] =
        await verifyReferenceService.processBatch(
          referencesWithSearch,
          (batchResults) => {
            self.postMessage({
              type: 'verification-update',
              pdfId,
              message: 'Verifying references...',
              batchResults
            })
          }
        )

      self.postMessage({
        type: 'complete',
        pdfId,
        references: verifiedReferences
      } as WorkerMessage)
    } catch (error) {
      console.error('❌ Error processing PDF:', error)
      self.postMessage({
        type: 'error',
        pdfId,
        error: error instanceof Error ? error.message : 'Unknown error'
      } as WorkerMessage)
    }
  }
}

async function analyzePage(imageData: string): Promise<PageAnalysis> {
  const response = await fetch('/api/llama-vision/analyze-page', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filePath: imageData,
      mode: 'free'
    })
  })

  if (!response.ok) {
    throw new Error('Failed to analyze page')
  }

  const analysis = await response.json()
  return analysis
}

/* Function to convert PDF to images using the existing endpoint
async function convertPdfToImagesSequential(file: File): Promise<string[]> {
  const formData = new FormData()
  formData.append('pdf', file)
  formData.append('range', '1-') // Convert all pages

  try {
    console.log('Making request to pdf2images endpoint...')
    const response = await fetch('/api/pdf2images', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      console.error(
        'PDF to images response not OK:',
        response.status,
        response.statusText
      )
      throw new Error(`Failed to convert PDF to images: ${response.statusText}`)
    }

    const data = await response.json()

    if (!data.images || !Array.isArray(data.images)) {
      console.error('Invalid images data received:', data)
      throw new Error('Invalid image data received from conversion')
    }

    // Format the images with the required prefix
    const formattedImages = data.images.map(
      (img: string) => `data:image/png;base64,${img}`
    )

    // Log the first image data to check format
    if (formattedImages.length > 0) {
      console.log(
        'First image data preview (after formatting):',
        formattedImages[0].substring(0, 100) + '...'
      )
    }

    return formattedImages
  } catch (error) {
    console.error('Error in convertPdfToImages:', error)
    throw error
  }
}*/

// Function to extract references from a single image
/*async function extractReferencesFromImage(
  imageData: string
): Promise<Reference[]> {
  try {
    const response = await fetch('/api/open-ai-vision', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ imageData })
    })

    if (!response.ok) {
      throw new Error('Failed to extract references from image')
    }

    const data = await response.json()
    return data.references || []
  } catch (error) {
    console.error('Error extracting references from image:', error)
    return []
  }
}
*/
