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
    
    // Copy pages
    for (let i = startPage - 1; i < endPage; i++) {
      const [page] = await newPdf.copyPages(pdfDoc, [i])
      newPdf.addPage(page)
    }
    
    // Save and create blob
    const newPdfBytes = await newPdf.save({
      useObjectStreams: false,  // Try without object streams
      addDefaultPage: false,    // Don't add extra pages
      objectsPerTick: 50       // Limit objects per operation
    })
    
    console.log(`New PDF bytes size: ${(newPdfBytes.length / (1024 * 1024)).toFixed(2)} MB`)
    
    const finalBlob = new Blob([newPdfBytes], { type: 'application/pdf' })
    console.log(`Final blob size: ${(finalBlob.size / (1024 * 1024)).toFixed(2)} MB`)
    
    // Clean up
    pdfDoc.setModificationDate(new Date())
    
    return finalBlob
  }
}