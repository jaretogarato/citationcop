/// <reference lib="webworker" />

import { WorkerMessage } from '../types'
import { SearchReferenceService } from '@/app/services/search-reference-service'
import { VerifyReferenceService } from '../verify-reference-service'
import { ReferencePageDetectionService } from '../reference-page-detection-service'
import type { Reference } from '@/app/types/reference'

declare const self: DedicatedWorkerGlobalScope

const searchReferenceService = new SearchReferenceService()
const verifyReferenceService = new VerifyReferenceService()
const referenceDetectionService = new ReferencePageDetectionService()

// Listen for messages
self.onmessage = async (e: MessageEvent) => {
  const { type, pdfId, file } = e.data

  if (type === 'process') {
    try {
      self.postMessage({
        type: 'update',
        pdfId: pdfId,
        message: `Worker launched for: ${pdfId}`
      })

      // STEP 1: Find reference pages
      self.postMessage({
        type: 'update',
        pdfId,
        message: 'Searching for references section...'
      })

      const referencePages = 
        await referenceDetectionService.findReferencePages(file)
      
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
        message: 'Processing references section'
      })

      const markdownContents = await Promise.all(
        referencePages.map(async (page) => {
          const markdownResponse = await fetch('/api/llama-vision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filePath: page.imageData,
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

      // STEP 4: DOI verification
      self.postMessage({
        type: 'update',
        pdfId,
        message: 'Checking DOIs...'
      })

      const doiResponse = await fetch('/api/references/verify-doi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ references: extractedReferences })
      })

      if (!doiResponse.ok) {
        throw new Error('DOI verification failed')
      }

      const { references: referencesWithDOI } = await doiResponse.json()

      // STEP 5: Search and verification
      const referencesWithSearch: Reference[] = await searchReferenceService.processBatch(
        referencesWithDOI,
        (batchResults) => {
          self.postMessage({
            type: 'update',
            pdfId,
            message: `✅ search batch complete for ${pdfId}`
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