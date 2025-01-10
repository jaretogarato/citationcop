/// <reference lib="webworker" />

import { WorkerMessage } from '../types';
import { GrobidReferenceService } from '../grobid-reference-service';
import { PDFParseAndExtractReferenceService } from '@/app/services/pdf-parse-and-extract-references';

declare const self: DedicatedWorkerGlobalScope;

// Initialize services
const referenceService = new GrobidReferenceService('/api/grobid/references');
const pdfReferenceService = new PDFParseAndExtractReferenceService(
  '/api/references/extract',
  '/api/parse-pdf'
);

// Listen for messages
self.onmessage = async (e: MessageEvent) => {
  const { type, pdfId, file } = e.data;

  if (type === 'process') {
    console.log(`🚀 Worker starting to process PDF ${pdfId}`);

    try {
      // Attempt to extract references using GROBID
      console.log('📤 Sending to GROBID...');
      const references = await referenceService.extractReferences(file);

      let finalReferences = references;

      // If no references are found, parse and extract references
      if (references.length === 0) {
        console.log(
          'No references found via GROBID, falling back to PDF parsing...'
        );
        finalReferences =
          await pdfReferenceService.parseAndExtractReferences(file);

        console.log('📥 Received references from OpenAI:', finalReferences);
      }

      // Send completion message with references back to the main thread
      self.postMessage({
        type: 'complete',
        pdfId,
        references: finalReferences
      } as WorkerMessage);

      console.log(`✅ Successfully processed PDF ${pdfId}`);
    } catch (error) {
      console.error('❌ Error processing PDF:', error);
      self.postMessage({
        type: 'error',
        pdfId,
        error: error instanceof Error ? error.message : 'Unknown error'
      } as WorkerMessage);
    }
  }
};
