/// <reference lib="webworker" />

import { WorkerMessage } from '../types'
import { ReferencePageDetectionService } from '../reference-page-detection-service'
import { ReferenceExtractFromTextService } from '../reference-extract-from-text-service'
import { o3ReferenceVerificationService } from '../o3-reference-verification-service'

import type { Reference } from '@/app/types/reference'

declare const self: DedicatedWorkerGlobalScope

const refPageDetectionService = new ReferencePageDetectionService()
const extractionService = new ReferenceExtractFromTextService()
const o3VerificationService = new o3ReferenceVerificationService()

self.onmessage = async (e: MessageEvent) => {
  const { type, pdfId, file } = e.data

  if (type === 'process') {
    try {
      self.postMessage({
        type: 'update',
        pdfId: pdfId,
        message: `Worker launched for: ${pdfId}`
      })

      // Initialize the detection service
      await refPageDetectionService.initialize(file)

      // STEP 1: Find reference pages with vision and parsed text
      self.postMessage({
        type: 'update',
        pdfId,
        message: 'Searching for references section...'
      })

      const referencePages =
        await refPageDetectionService.findReferencePages(file)

      const referencesSectionStart = referencePages[0].pageNumber
      self.postMessage({
        type: 'update',
        pdfId,
        message: `Found references section starting on page ${referencesSectionStart}`
      })

      // STEP 2: Extract markdown content from reference pages
      self.postMessage({
        type: 'update',
        pdfId,
        message: 'Extracting content from pages with references'
      })

      const markdownContents = await Promise.all(
        referencePages.map(async (page) => {
          const markdownResponse = await fetch('/api/llama-vision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filePath: page.imageData,
              parsedText: page.parsedContent.rawText,
              mode: 'free'
            })
          })

          if (!markdownResponse.ok) {
            throw new Error('Failed to extract references content')
          }

          const { markdown } = await markdownResponse.json()
          return {
            pageNumber: page.pageNumber,
            markdown,
            isStartOfSection: page.pageNumber === referencesSectionStart,
            isNewSectionStart: page.analysis.isNewSectionStart
          }
        })
      )

      // STEP 3: Extract structured references from markdown
      self.postMessage({
        type: 'update',
        pdfId,
        message: 'Extracting structured references'
      })

      const referencePagesMarkdown = markdownContents
        .map((content) => content.markdown)
        .join('\n\n')

      //console.log('📄 Extracted markdown contents:', referencePagesMarkdown)

      const extractedReferences =
        await extractionService.processTextWithProgress(
          referencePagesMarkdown,
          (processed: number, total: number) => {
            self.postMessage({
              type: 'update',
              pdfId,
              message: `Processing references ${processed}/${total}`
            })
          }
        )

      //console.log('📚 Extracted references:', extractedReferences)

      self.postMessage({
        type: 'references',
        pdfId: pdfId,
        noReferences: extractedReferences.length,
        message: `Found ${extractedReferences.length} references for ${pdfId}`
      })

      // STEP 4: DOI VERIFICATION Check if any references have DOIs
      let referencesWithDOI = extractedReferences
      if (extractedReferences.some((ref: Reference) => ref.DOI)) {
        self.postMessage({
          type: 'update',
          pdfId,
          message: 'Found DOIs, verifying...'
        })

        const doiResponse = await fetch('/api/references/verify-doi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ references: extractedReferences })
        })

        if (!doiResponse.ok) {
          throw new Error('DOI verification failed')
        }

        const { references } = await doiResponse.json()
        referencesWithDOI = references
      } else {
        self.postMessage({
          type: 'update',
          pdfId,
          message: 'No DOIs found, skipping verification'
        })
      }

      //('📚 References with DOIs:', referencesWithDOI)

      // STEP 5: Search and verification

      const verificationResults = await o3VerificationService.processBatch(
        referencesWithDOI,
        (batchResults) => {
          self.postMessage({
            type: 'verification-update',
            pdfId,
            message: 'Verifying references...',
            batchResults
          })
        }
      )

      /*const referencesWithSearch: Reference[] =
        await searchReferenceService.processBatch(
          referencesWithDOI,
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
        )*/
      const processedReferences = verificationResults.map((result) => ({
        ...result.reference,
        message: result.result?.message,
        verificationDetails: result.result
      }))

      self.postMessage({
        type: 'complete',
        pdfId,
        references: processedReferences,
        message: `Completed verification of ${processedReferences.length} references`
      } as WorkerMessage)
    } catch (error) {
      console.error('❌ Error processing PDF:', error)
      self.postMessage({
        type: 'error',
        pdfId,
        error: error instanceof Error ? error.message : 'Unknown error'
      } as WorkerMessage)
    } finally {
      // Cleanup
      await refPageDetectionService.cleanup()
    }
  }
}
