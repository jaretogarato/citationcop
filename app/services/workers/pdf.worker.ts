/// <reference lib="webworker" />

import { WorkerMessage } from '../types'
import { GrobidReferenceService } from '../grobid-reference-service'
import { PDFParseAndExtractReferenceService } from '@/app/services/pdf-parse-and-extract-references'
import { SearchReferenceService } from '@/app/services/search-reference-service'

declare const self: DedicatedWorkerGlobalScope

// Initialize services
const referenceService = new GrobidReferenceService('/api/grobid/references')
const pdfReferenceService = new PDFParseAndExtractReferenceService(
  '/api/references/extract',
  '/api/parse-pdf'
)
const searchReferenceService = new SearchReferenceService()

// Listen for messages
self.onmessage = async (e: MessageEvent) => {
  const { type, pdfId, file, highAccuracy } = e.data

  if (type === 'process') {
    console.log(`🚀 Worker starting to process PDF ${pdfId}`)
    try {
      // STEP 1: TRY TO GET REFERENCES FROM GROBID
      console.log('📤 Sending to GROBID...')
      const references = await referenceService.extractReferences(file)

      let finalReferences = references

      // STEP 1.5: IF NO REFERENCES FROM GROBID, FALLBACK TO PDF PARSING
      if (references.length === 0) {
        console.log(
          'No references found via GROBID, falling back to PDF parsing...'
        )
        finalReferences =
          await pdfReferenceService.parseAndExtractReferences(file)
        console.log('📥 Received references from OpenAI:', finalReferences)
      } else if (highAccuracy) {
        // if HIGH-ACCURACY THEN DOUBLE-CHECK REFERENCES
        console.log('🔍 High Accuracy mode enabled. Verifying references...')
        const verifiedReferences = []
        for (const reference of finalReferences) {
          const response = await fetch('/api/high-accuracy-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reference })
          })

          if (!response.ok) {
            console.error('Error verifying reference:', reference)
            continue
          }

          const result = await response.json()
          console.log('🔍 Verification result:', result)
          verifiedReferences.push(...result)
        }

        finalReferences = verifiedReferences
      }

      // STEP 2: REMOVE DUPLICATES
      console.log('🧹 Removing duplicate references...')
      finalReferences = removeDuplicates(finalReferences)
      console.log('✅ Unique references:', finalReferences)

      // STEP 3: BATCH PROCESS SEARCH CALLS
      console.log('🔍 Starting batch processing for search...')
      await searchReferenceService.processBatch(
        finalReferences,
        (batchResults) => {
          console.log('🔍 Batch results:', batchResults)
        }
      )
      
      // Send completion message with references back to the main thread
      self.postMessage({
        type: 'complete',
        pdfId,
        references: finalReferences
      } as WorkerMessage)

      console.log(`✅ Successfully processed PDF ${pdfId}`)
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

// Utility function to remove duplicates
const removeDuplicates = (references: any[]): any[] => {
  const uniqueSet = new Map<string, any>()

  references.forEach((ref) => {
    const key = `${ref.authors?.join(',')}|${ref.title}`
    if (!uniqueSet.has(key)) {
      uniqueSet.set(key, ref)
    }
  })

  return Array.from(uniqueSet.values())
}
