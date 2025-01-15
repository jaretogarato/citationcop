//app/services/pdf2image.ts

import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocumentProxy } from 'pdfjs-dist'


pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

export async function extractPDFPageAsImage(
  file: string | Uint8Array | PDFDocumentProxy,
  pageNumber = 1
) {
  let pdf: PDFDocumentProxy
  if (file instanceof Uint8Array || typeof file === 'string') {
    pdf = await pdfjsLib.getDocument(file).promise
  } else if (file instanceof PDFDocumentProxy) {
    pdf = file
  } else {
    throw new Error('Invalid file type')
  }
  const page = await pdf.getPage(pageNumber)

  const viewport = page.getViewport({ scale: 2.0 }) // Adjust scale for quality
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Failed to get 2D context')
  }

  canvas.height = viewport.height
  canvas.width = viewport.width

  await page.render({
    canvasContext: context,
    viewport: viewport
  }).promise

  return canvas.toDataURL('image/png')
}
