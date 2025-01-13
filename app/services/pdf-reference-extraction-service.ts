// pdf-text-extraction-service.ts
import PDFParser from '@/app/utils/reference-helpers/pdf-parser'

import { GlobalWorkerOptions } from 'pdfjs-dist'
GlobalWorkerOptions.workerSrc = '/pdf.worker.js'

export class PDFReferenceExtractionService {
  // pdf-reference-service.ts

  private parser: PDFParser

  constructor() {
    // Instantiate your PDFParser (which has all the merging + regex logic).
    this.parser = new PDFParser()
  }

  /**
   * If you're in a browser context where you have a `File` from an <input> element,
   * call this method with that File to parse references.
   */
  public async parseReferencesFromFile(file: File): Promise<String> {
    // 1. Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()

    // 2. Call the parser
    console.log('calling parser')
    return this.parser.parseReferencesFromPdfBuffer(arrayBuffer as ArrayBuffer)
  }
}
