/// <reference lib="webworker" />

import { WorkerMessage } from '../types'
import { DocumentParsingService } from '../document-parsing-service'
import { ReferencePageDetectionService } from '../o;d/reference-page-detection-service'
import { ReferencePageImageService } from '../ref-page-image-service'
import { ReferenceMarkdownService } from '../image-to-markdown-extraction-service'
import { ReferenceExtractFromTextService } from '../reference-extract-from-text-service'
import { o3ReferenceVerificationService } from '../o3-reference-verification-service'
import { RefPagesResult } from '@/app/types/reference'

import type { Reference } from '@/app/types/reference'
interface ExtractedReferenceWithIndex extends Reference {
  index: number
}

declare const self: DedicatedWorkerGlobalScope

// parses document
const documentParsingService = new DocumentParsingService()

// detects reference pages
const refPageDetectionService = new ReferencePageDetectionService()

// gets images for those pages
const refPageImageService = new ReferencePageImageService()

// extract markdown referneces from images
const refPageMarkdownService = new ReferenceMarkdownService()

// extract json references from markdown
const extractionService = new ReferenceExtractFromTextService()

// verify finally the references
const o3VerificationService = new o3ReferenceVerificationService()

self.onmessage = async (e: MessageEvent) => {
  const { type, pdfId, file } = e.data

  if (type === 'process') {
    try {
      self.postMessage({
        type: 'update',
        pdfId,
        message: `Searching for references`
      })

      // STEP 1: First we use text parsing to find the pages of the references.
      await documentParsingService.initialize(file)
      const parsingResponse = await documentParsingService.parseDocument()

      await documentParsingService.cleanup()

      const documentText = parsingResponse
        .map((page) => `Page ${page.pageNumber}:\n${page.rawText}`)
        .join('\n\n')

      const response = await fetch('/api/references/detect-pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: documentText
        })
      })

      // Type the response as an object with a "references" property of type number[]
      const result: RefPagesResult = await response.json()

      //const result = await response.json()
      console.log('REFERENCES ARE ON PAGES: ', result.pages)

      // now mape the raw text onto the pages. 
      const updatedRawText = result.pages.map((refPageNumber) => {
        const matchingPage = parsingResponse.find(
          (page) => page.pageNumber === refPageNumber
        )
        return matchingPage ? matchingPage.rawText : ''
      })
      
      // Now update the result with the mapped raw text.
      result.rawText = updatedRawText
      
      //console.log('Updated raw text for reference pages:', result)


      self.postMessage({
        type: 'update',
        pdfId,
        message: `Found references on pages ${result.pages.join(', ')}`
      })
      
      // STEP 2: Get the image data for each reference page
    
      await refPageImageService.initialize(file) // file is your PDF
      const updatedResult = await refPageImageService.addImageData(result)
      console.log('Updated result with image data:', updatedResult)

      // When finished, clean up resources
      await refPageImageService.cleanup()
  
      // STEP 3: Extract markdown content from reference pages
      console.log('ENTERING STEP 3 ***** ')

      const markdownResponse = await refPageMarkdownService.extractMarkdown(updatedResult)
  
      const markdownContents = markdownResponse.map((content) => ({
        pageNumber: content.pageNumber,
        markdown: content.markdown
      }))
      console.log('📄 Extracted markdown contents:', markdownContents)

      // STEP 4: Extract structured references from markdown
      self.postMessage({
        type: 'update',
        pdfId,
        message: `Preparing references for analysis`
      })

      const referencePagesMarkdown = markdownContents
        .map((content) => content.markdown)
        .join('\n')

      console.log('📄 Extracted markdown contents:', referencePagesMarkdown)

      const extractedReferences =
        await extractionService.processTextWithProgress(
          referencePagesMarkdown,
          (processed: number, total: number) => {
            self.postMessage({
              type: 'update',
              pdfId,
              message: '.'.repeat(processed)
            })
          }
        )

      // Add an index property to each extracted reference
      const extractedReferencesWithIndex: ExtractedReferenceWithIndex[] =
        extractedReferences.map((ref, index) => ({
          ...ref,
          index
        }))
      //console.log('📚 Extracted references:', extractedReferences)

      self.postMessage({
        type: 'references',
        pdfId: pdfId,
        noReferences: extractedReferencesWithIndex.length,
        message: `Found ${extractedReferencesWithIndex.length} unique references: ${pdfId}`,
        references: extractedReferencesWithIndex
      })
      
      // STEP 5: Verification

      const verificationResults = await o3VerificationService.processBatch(
        extractedReferencesWithIndex,
        (batchResults) => {
          self.postMessage({
            type: 'verification-update',
            pdfId,
            message: `Verifying references`,
            batchResults
          })
        },
        // Add the new callback for individual reference updates
        (verifiedReference) => {
          const index = (
            verifiedReference.reference as ExtractedReferenceWithIndex
          ).index

          self.postMessage({
            type: 'reference-verified',
            pdfId,
            message: `Verified reference: ${verifiedReference.reference.title || 'Unknown'}`,
            verifiedReference: {
              ...verifiedReference.reference,
              id: `${pdfId}-${index}`,
              message: verifiedReference.result?.message,
              verificationDetails: verifiedReference.result,
              sourceDocument: pdfId
            }
          })
        }
      )

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
