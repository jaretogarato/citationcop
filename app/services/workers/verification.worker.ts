/// <reference lib="webworker" />

import { WorkerMessage } from '../types'
import { SearchReferenceService } from '@/app/services/search-reference-service'
import { VerifyReferenceService } from '../verify-reference-service'
import type { Reference } from '@/app/types/reference'

declare const self: DedicatedWorkerGlobalScope

const searchReferenceService = new SearchReferenceService()
const verifyReferenceService = new VerifyReferenceService()

// Function to convert PDF to images using the existing endpoint
async function convertPdfToImages(file: File): Promise<string[]> {
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
      console.error('PDF to images response not OK:', response.status, response.statusText)
      throw new Error(`Failed to convert PDF to images: ${response.statusText}`)
    }

    const data = await response.json()
    
    if (!data.images || !Array.isArray(data.images)) {
      console.error('Invalid images data received:', data)
      throw new Error('Invalid image data received from conversion')
    }

    // Format the images with the required prefix
    const formattedImages = data.images.map((img: string) => `data:image/png;base64,${img}`)
    
    // Log the first image data to check format
    if (formattedImages.length > 0) {
      console.log('First image data preview (after formatting):', 
        formattedImages[0].substring(0, 100) + '...')
    }

    return formattedImages
  } catch (error) {
    console.error('Error in convertPdfToImages:', error)
    throw error
  }
}

// Function to extract references from a single image
async function extractReferencesFromImage(imageData: string): Promise<Reference[]> {
  try {
    const response = await fetch('/api/open-ai-vision', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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

      // STEP 1: Convert PDF to images
      self.postMessage({
        type: 'update',
        pdfId,
        message: `Converting PDF to images: ${pdfId}`
      })
      
      const images = await convertPdfToImages(file)
      
      if (images.length === 0) {
        throw new Error('No images extracted from PDF')
      }

      // STEP 2: Process each image through Vision API
      self.postMessage({
        type: 'update',
        pdfId,
        message: `Extracting references from ${images.length} pages`
      })

      const allReferences: Reference[] = []
      for (let i = 0; i < images.length; i++) {
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
            message: `✅ search complete for ${pdfId}`
          })
        }
      )

      const verifiedReferences: Reference[] = await verifyReferenceService.processBatch(
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