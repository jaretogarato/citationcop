/// <reference lib="webworker" />

import { WorkerMessage } from '../types'
import { SearchReferenceService } from '@/app/services/search-reference-service'
import { VerifyReferenceService } from '../verify-reference-service'
import { ReferencesPageFinder } from '@/app/services/references-page-finder-service'
import { PdfSlicerService } from '../pdf-slicer-service'
import type { Reference } from '@/app/types/reference'

declare const self: DedicatedWorkerGlobalScope

const referencePageFinderService = new ReferencesPageFinder()
const searchReferenceService = new SearchReferenceService()
const verifyReferenceService = new VerifyReferenceService()
const pdfSlicer = new PdfSlicerService()

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

      // STEP 1: Identify pages
      const pageNo: number =
        await referencePageFinderService.findReferencesPage(file)

      self.postMessage({
        type: 'update',
        pdfId,
        message: `References are on page: ${pageNo}`
      })

      // STEP 2: Slice Pages starting from pageNo

      const slicedPdf = await pdfSlicer.slicePdfPages(file, pageNo, 4)

      // Update file reference to use sliced PDF
      const slicedFile = new File([slicedPdf], 'sliced.pdf', {
        type: 'application/pdf'
      })

      // STEP 3: Convert PDF to images
      self.postMessage({
        type: 'update',
        pdfId,
        message: `Converting PDF to images: ${pdfId}`
      })

      const images = await convertPdfToImagesSequential(slicedFile)

      if (images.length === 0) {
        throw new Error('No images extracted from PDF')
      }

      // STEP 4: Process each image through Vision API

      self.postMessage({
        type: 'update',
        pdfId,
        message: `Extracting references from ${images.length} pages`
      })

      const BATCH_SIZE = 5

      const allReferences: Reference[] = []

      // Process in batches of BATCH_SIZE
      for (let i = 0; i < images.length; i += BATCH_SIZE) {
        const batch = images.slice(i, i + BATCH_SIZE)
        const extractionPromises = batch.map((image, batchIndex) =>
          extractReferencesFromImage(image).then((refs) => {
            self.postMessage({
              type: 'update',
              pdfId,
              message: `Processed page ${i + batchIndex + 1}/${images.length}`
            })
            return refs
          })
        )

        const batchResults = await Promise.all(extractionPromises)
        batchResults.forEach((refs) => allReferences.push(...refs))
      }

      const noReferences = allReferences.length

      self.postMessage({
        type: 'references',
        pdfId: pdfId,
        noReferences: noReferences,
        message: `Found ${noReferences} references for ${pdfId}`
      })

      // Continue with existing search and verification steps
      console.log('Starting batch processing for search...')

      const referencesWithSearch = await searchReferenceService.processBatch(
        allReferences,
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


// Function to convert PDF to images using the existing endpoint
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
}



// Function to convert PDF to images using the existing endpoint PARALLEL
async function convertPdfToImages(file: File): Promise<string[]> {
  const CHUNK_SIZE = 5
  const chunks: string[] = []

  for (let i = 1; i <= CHUNK_SIZE; i++) {
    chunks.push(`${i}`)
  }

  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms))
  const fetchWithRetry = async (
    formData: FormData,
    pageNum: string,
    retries = 3
  ) => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch('/api/pdf2images', {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          throw new Error(`Failed to convert page ${pageNum}`)
        }

        const data = await response.json()
        return data.images?.[0]
          ? `data:image/png;base64,${data.images[0]}`
          : null
      } catch (error) {
        if (i === retries - 1) throw error
        await delay(1000 * (i + 1)) // Exponential backoff
      }
    }
  }

  const formDataPromises = chunks.map((pageNum) => {
    const formData = new FormData()
    formData.append('pdf', file)
    formData.append('range', pageNum)
    return fetchWithRetry(formData, pageNum)
  })

  const results = await Promise.all(formDataPromises)
  return results.filter(
    (result): result is string => result !== null && result !== undefined
  )
}

// Function to extract references from a single image
async function extractReferencesFromImage(
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
