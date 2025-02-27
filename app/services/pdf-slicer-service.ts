
import { PDFDocument } from 'pdf-lib'

export class PdfSlicerService {
  async slicePdfPages(
    file: File,
    startPage: number,
    numPages: number = 4
  ): Promise<Blob> {
    
    const arrayBuffer = await file.arrayBuffer()
    console.log(`Original arrayBuffer size: ${(arrayBuffer.byteLength / (1024 * 1024)).toFixed(2)} MB`)
    
    const pdfDoc = await PDFDocument.load(arrayBuffer)
    const totalPages = pdfDoc.getPageCount()
    const endPage = Math.min(startPage + numPages - 1, totalPages)
    
    // Create new PDF
    const newPdf = await PDFDocument.create()
    
    console.log(`Copying pages ${startPage} to ${endPage}`)
    
    // Create array of page indices to copy
    const pageIndices = []
    for (let i = startPage - 1; i < endPage; i++) {
      pageIndices.push(i)
    }
    
    // Copy all pages at once to preserve shared resources
    const pages = await newPdf.copyPages(pdfDoc, pageIndices)
    pages.forEach(page => newPdf.addPage(page))
    
    // Save with minimal options
    const newPdfBytes = await newPdf.save({
      useObjectStreams: false,
      addDefaultPage: false,
      objectsPerTick: 50
    })
    
    console.log(`New PDF bytes size: ${(newPdfBytes.length / (1024 * 1024)).toFixed(2)} MB`)
    
    const finalBlob = new Blob([newPdfBytes], { type: 'application/pdf' })
    console.log(`Final blob size: ${(finalBlob.size / (1024 * 1024)).toFixed(2)} MB`)
    
    return finalBlob
  }
}