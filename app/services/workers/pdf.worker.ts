/// <reference lib="webworker" />

import { WorkerMessage } from '../types'
import { GrobidReferenceService } from '../grobid-reference-service'
import { PDFParseAndExtractReferenceService } from '@/app/services/pdf-parse-and-extract-references'
import { SearchReferenceService } from '@/app/services/search-reference-service'
import { VerifyReferenceService } from '../verify-reference-service'
import { URLContentVerifyService } from '../url-content-verify-service'
import { HighAccuracyCheckService } from '@/app/services/high-accuracy-service'

//import { logReferences } from '@/app/utils/log-references'
import type { Reference } from '@/app/types/reference'
//import { logReferences } from '@/app/utils/log-references'

declare const self: DedicatedWorkerGlobalScope

// Initialize services
const referenceService = new GrobidReferenceService('/api/grobid/references')
const pdfReferenceService = new PDFParseAndExtractReferenceService(
  '/api/references/extract',
  '/api/parse-pdf'
)
const highAccuracyService = new HighAccuracyCheckService(
  '/api/high-accuracy-check'
)
const searchReferenceService = new SearchReferenceService()
const verifyReferenceService = new VerifyReferenceService()
const urlVerificationCheck = new URLContentVerifyService()

// Listen for messages
self.onmessage = async (e: MessageEvent) => {
  const { type, pdfId, file, highAccuracy } = e.data

  if (type === 'process') {
    //console.log(`🚀 Worker starting to process PDF ${pdfId}`)
    try {
      // STEP 1: TRY TO GET REFERENCES FROM GROBID

      const references: Reference[] =
        await referenceService.extractReferences(file)

      let parsedReferences: Reference[] = references

      // need a new service to check references. if they don't have a title and an author, then remove them

      // STEP 2: REMOVE DUPLICATES
      parsedReferences = removeDuplicates(parsedReferences)

      let noReferences: number = parsedReferences.length
      self.postMessage({
        type: 'references',
        pdfId: pdfId,
        noRferences: noReferences,
        message: `${noReferences} found for ${pdfId}`
      })

      // as a test remove all the references in the references array
      const testRef: Reference[] = []

      // STEP 1.5: IF NO REFERENCES FROM GROBID, Let the front end know.
      if (testRef.length === 0) {
        parsedReferences =
          await pdfReferenceService.parseAndExtractReferences(file)
        //console.log('📥 Received references from OpenAI:', parsedReferences)
        noReferences = parsedReferences.length

        self.postMessage({
          type: 'references',
          pdfId: pdfId,
          noReferences: parsedReferences.length,
          message: `After second reference check, ${noReferences} found for ${pdfId}`
        })
      } else if (highAccuracy) {
        // if HIGH-ACCURACY THEN DOUBLE-CHECK REFERENCES
        console.log('🔍 High Accuracy mode enabled. Verifying references...')

        parsedReferences =
          await highAccuracyService.processBatch(parsedReferences)

        let noReferences = parsedReferences.length
        self.postMessage({
          type: 'references',
          pdfId: pdfId,
          noReferences: parsedReferences.length,
          message: `After high-accuracy, ${noReferences} found for ${pdfId}`
        })
      }

      // STEP 3: BATCH PROCESS SEARCH CALLS
      //console.log('🔍 Starting batch processing for search...')

      // this is the model for sending an update back to UI through the postMessage and into the queue...
      const referencesWithSearch = await searchReferenceService.processBatch(
        parsedReferences,
        (batchResults) => {
          //logReferences(batchResults)
          // Send batch results to the main thread
          self.postMessage({
            type: 'update',
            pdfId,
            message: `✅ search complete. for ${pdfId} `
          })
        }
      )

      // STEP 4: Verify references with URLs only
      //console.log('🌐 Verifying references with URLs...')
      /*const urlVerifiedreferences =
        await urlVerificationCheck.verifyReferencesWithUrls(
          referencesWithSearch
        )*/
      //console.log('✅ URL verification complete.')
      //logReferences(urlVerifiedreferences)

      // STEP 5: FINAL VERIFICATION
      //console.log('*** final verification ***')
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

      // print them out for a check
      //logReferences(verifiedReferences)

      // Send completion message with references back to the main thread
      self.postMessage({
        type: 'complete',
        pdfId,
        references: verifiedReferences
      } as WorkerMessage)

      //console.log(`✅ Successfully processed PDF ${pdfId}`)
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

const filterInvalidReferences = (references: Reference[]): Reference[] => {
  return references.filter((ref) => {
    const hasValidAuthors = Array.isArray(ref.authors) && ref.authors.length > 0
    const hasValidTitle =
      typeof ref.title === 'string' && ref.title.trim() !== ''
    return hasValidAuthors && hasValidTitle
  })
}
