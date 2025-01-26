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

      const images = await convertPdfToImages(slicedFile)

      if (images.length === 0) {
        throw new Error('No images extracted from PDF')
      }

      // STEP 4: Process each image through Vision API

      self.postMessage({
        type: 'update',
        pdfId,
        message: `Extracting references from ${images.length} pages`
      })

      // make this just from pageNo to pageNo+4

      const allReferences: Reference[] = []
      for (let i = 0; i <= images.length; i++) {
        const pageReferences = await extractReferencesFromImage(images[i])
        allReferences.push(...pageReferences)

        self.postMessage({
          type: 'update',
          pdfId,
          message: `Processed page ${i + 1}/${images.length}`
        })
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
async function convertPdfToImages(file: File): Promise<string[]> {
  // Split into chunks of 5 pages each
  const CHUNK_SIZE = 5
  const chunks: string[] = []

  for (let i = 1; i <= CHUNK_SIZE; i++) {
    chunks.push(`${i}`)
  }

  const formDataPromises = chunks.map((pageNum) => {
    const formData = new FormData()
    formData.append('pdf', file)
    formData.append('range', pageNum)

    return fetch('/api/pdf2images', {
      method: 'POST',
      body: formData
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to convert page ${pageNum}`)
      }
      const data = await response.json()
      return data.images?.[0] ? `data:image/png;base64,${data.images[0]}` : null
    })
  })

  const results = await Promise.all(formDataPromises)
  return results.filter((result) => result !== null)
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
