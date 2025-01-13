/// <reference lib="webworker" />

import { WorkerMessage } from '../types'
//import { GrobidReferenceService } from '../grobid-reference-service'
import { PDFParseAndExtractReferenceService } from '@/app/services/pdf-parse-and-extract-references'
import { SearchReferenceService } from '@/app/services/search-reference-service'
import { VerifyReferenceService } from '../verify-reference-service'
//import { URLContentVerifyService } from '../url-content-verify-service'
//import { HighAccuracyCheckService } from '@/app/services/high-accuracy-service'
import type { Reference } from '@/app/types/reference'
import { logSimpleReferences } from '@/app/utils/reference-helpers/log-references'

declare const self: DedicatedWorkerGlobalScope

// Initialize services
//const referenceService = new GrobidReferenceService('/api/grobid/references')
const pdfReferenceService = new PDFParseAndExtractReferenceService(
  '/api/references/extract'
)

//const highAccuracyService = new HighAccuracyCheckService(
//  '/api/high-accuracy-check'
//)

const searchReferenceService = new SearchReferenceService()
const verifyReferenceService = new VerifyReferenceService()
//const urlVerificationCheck = new URLContentVerifyService()

// Listen for messages
self.onmessage = async (e: MessageEvent) => {
  const { type, pdfId, file } = e.data

  if (type === 'process') {
    //console.log(`🚀 Worker starting to process PDF ${pdfId}`)
    try {
      self.postMessage({
        type: 'update',
        pdfId: pdfId,
        message: `Worker launched for : ${pdfId}`
      })
      // No Grobid, no problem
      // STEP 1
      let parsedReferences =
        await pdfReferenceService.parseAndExtractReferences(file)
      //console.log('📥 Received references from OpenAI:', parsedReferences)
      let noReferences = parsedReferences.length

      self.postMessage({
        type: 'references',
        pdfId: pdfId,
        noReferences: parsedReferences.length,
        message: `SV found ${noReferences} for ${pdfId}`
      })

      // STEP 2: BATCH PROCESS SEARCH CALLS
      //console.log('🔍 Starting batch processing for search...')

      //console.log("before search")
      //logSimpleReferences(parsedReferences)
      // this is the model for sending an update back to UI through the postMessage and into the queue...
      const referencesWithSearch = await searchReferenceService.processBatch(
        parsedReferences,
        (batchResults) => {
          //logReferences(batchResults)

          self.postMessage({
            type: 'update',
            pdfId,
            message: `✅ search complete. for ${pdfId} `
          })
        }
      )

      console.log('***** AFTER search ******')
      logSimpleReferences(referencesWithSearch)

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
      console.log('****   MESSAGES After verification  ***')
      logSimpleReferences(verifiedReferences)

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
