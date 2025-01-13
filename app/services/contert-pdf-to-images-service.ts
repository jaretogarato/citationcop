// services/convert-pdf-to-images-service.ts
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import { PDFPageProxy } from 'pdfjs-dist/types/src/display/api'

GlobalWorkerOptions.workerSrc = '/pdf.worker.js'

// Utility function to convert a PDF page to an image
async function convertPageToImage(page: PDFPageProxy, scale = 1.5): Promise<string> {
  try {
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    // Set canvas size
    canvas.height = viewport.height
    canvas.width = viewport.width

    // Render the page into the canvas context
    if (!context) {
      throw new Error('Failed to get canvas context')
    }
    await page.render({ canvasContext: context, viewport }).promise

    // Convert the canvas to an image (base64 encoded PNG)
    return canvas.toDataURL('image/png')
  } catch (error) {
    console.error(`Error converting PDF page ${page.pageNumber} to image:`, error)
    throw new Error(`Failed to convert PDF page ${page.pageNumber} to image`)
  }
}

// Function to convert PDF to images and send each one sequentially starting from a given page
export async function convertPdfToImages(
  pdfUrl: string,
  scale = 1.5,
  startPage = 1,
  sendImage: (imageData: string, pageNum: number) => Promise<void>
) {
  try {
    const pdf = await getDocument(pdfUrl).promise

    // Ensure that startPage is within valid bounds
    if (startPage < 1 || startPage > pdf.numPages) {
      throw new Error(`Invalid start page: ${startPage}. It should be between 1 and ${pdf.numPages}.`)
    }

    // Process pages starting from startPage
    for (let pageNum = startPage; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)

      // Convert page to image (base64)
      const imageData = await convertPageToImage(page, scale)

      // Send the image to your endpoint (e.g., OpenAI)
      await sendImage(imageData, pageNum)

      // Optional: clear memory between pages if necessary
      // canvas and page data can be garbage collected after sending
    }
  } catch (error) {
    console.error('Error processing PDF:', error)
    throw new Error('Failed to convert PDF to images')
  }
}
