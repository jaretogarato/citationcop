import { GlobalWorkerOptions } from 'pdfjs-dist'

// Configure the worker source
GlobalWorkerOptions.workerSrc = '/workers/pdf.worker.js'

// Export the configured GlobalWorkerOptions
export { GlobalWorkerOptions }
