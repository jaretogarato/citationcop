/// <reference lib="webworker" />

import { WorkerMessage } from '../types'
import { GrobidReferenceService } from '../grobid-reference-service'
import { PDFParseAndExtractReferenceService } from '@/app/services/pdf-parse-and-extract-references'
import { SearchReferenceService } from '@/app/services/search-reference-service'
import { VerifyReferenceService } from '../verify-reference-service'
import { URLContentVerifyService } from '../url-content-verify-service'
//import { logReferences } from '@/app/utils/log-references'
import type { Reference } from '@/app/types/reference'
import { logReferences } from '@/app/utils/log-references'

declare const self: DedicatedWorkerGlobalScope

// Initialize services
const referenceService = new GrobidReferenceService('/api/grobid/references')
const pdfReferenceService = new PDFParseAndExtractReferenceService(
  '/api/references/extract',
  '/api/parse-pdf'
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

      let parsedRefernces: Reference[] = references

      // STEP 1.5: IF NO REFERENCES FROM GROBID, FALLBACK TO PDF PARSING
      if (references.length === 0) {
        /*console.log(
          'No references found via GROBID, falling back to PDF parsing...'
        )*/
        parsedRefernces =
          await pdfReferenceService.parseAndExtractReferences(file)
        //console.log('📥 Received references from OpenAI:', parsedRefernces)
      } else if (highAccuracy) {
        // if HIGH-ACCURACY THEN DOUBLE-CHECK REFERENCES
        console.log('🔍 High Accuracy mode enabled. Verifying references...')
        const checkedReferences: Reference[] = []
        
        // TO DO -- MAKE THIS BE BATCHED !!! PARALLEL PLEASE !!
        // CRITICAL
        // ITS TOO SLOW OTHERWISE

        for (const reference of parsedRefernces) {
            console.log('Checking reference:', {
                id: reference.id,
                title: reference.title
            })
            
            const response = await fetch('/api/high-accuracy-check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reference })
            })
        
            if (!response.ok) {
                console.error('Error verifying reference:', reference)
                reference.status = 'error'
                reference.message = 'Verification failed'
                checkedReferences.push(reference)
                continue
            }
        
            const result = await response.json()
            
            // Handle the different possible responses:
            if (Array.isArray(result)) {
                if (result.length === 1 && result[0].ok === true) {
                    // Reference is verified correct
                    checkedReferences.push({
                        ...reference,
                        status: 'verified',
                        message: 'Reference verified correct'
                    })
                } else {
                    // We got corrected/multiple references
                    result.forEach((correctedRef, index) => {
                        checkedReferences.push({
                            ...correctedRef,
                            id: correctedRef.id || `${reference.id}-${index + 1}`,
                            status: 'verified',
                            message: 'Reference corrected/expanded'
                        })
                    })
                }
            } else {
                // Unexpected response format
                console.error('Unexpected response format:', result)
                reference.status = 'error'
                reference.message = 'Invalid verification response'
                checkedReferences.push(reference)
            }
        }

        parsedRefernces = checkedReferences
      }

      // STEP 2: REMOVE DUPLICATES
      parsedRefernces = removeDuplicates(parsedRefernces)

      // STEP 3: BATCH PROCESS SEARCH CALLS
      //console.log('🔍 Starting batch processing for search...')

      // this is the model for sending an update back to UI through the postMessage and into the queue...
      const referencesWithSearch = await searchReferenceService.processBatch(
        parsedRefernces,
        (batchResults) => {
          //logReferences(batchResults)

          // Send batch results to the main thread
          self.postMessage({
            type: 'search-update',
            pdfId,
            message: 'google searching...'
          })
        }
      )
      //console.log('✅ search complete.')
      //logReferences(referencesWithSearch)

      // STEP 4: Verify references with URLs only
      //console.log('🌐 Verifying references with URLs...')
      const urlVerifiedreferences =
        await urlVerificationCheck.verifyReferencesWithUrls(
          referencesWithSearch
        )
      //console.log('✅ URL verification complete.')
      //logReferences(urlVerifiedreferences)

      // STEP 5: FINAL VERIFICATION
      //console.log('*** final verification ***')
      const verifiedReferences: Reference[] =
        await verifyReferenceService.processBatch(
          urlVerifiedreferences,
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
