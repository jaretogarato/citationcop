import { PDFDocument } from 'pdf-lib'

export class PdfSlicerService {
  async slicePdfPages(
    file: File,
    startPage: number,
    numPages: number = 4
  ): Promise<Blob> {
    
    const arrayBuffer = await file.arrayBuffer()
    const pdfDoc = await PDFDocument.load(arrayBuffer)
    
    const totalPages = pdfDoc.getPageCount()
    const endPage = Math.min(startPage + numPages - 1, totalPages)
    const newPdf = await PDFDocument.create()
    
    console.log(`Original PDF pages: ${totalPages}`)
    console.log(`Slicing from page ${startPage} to ${endPage}`)
    
    for (let i = startPage - 1; i < endPage; i++) {
      const [page] = await newPdf.copyPages(pdfDoc, [i])
      newPdf.addPage(page)
    }
    
    const newPdfBytes = await newPdf.save()
    const finalBlob = new Blob([newPdfBytes], { type: 'application/pdf' })
    
    // Load again to check final page count
    const finalPdf = await PDFDocument.load(await finalBlob.arrayBuffer())
    console.log(`Final PDF pages: ${finalPdf.getPageCount()}`)
    
    return finalBlob
  }
}