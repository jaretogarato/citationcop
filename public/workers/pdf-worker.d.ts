// types/pdf-worker.d.ts
declare module 'pdfjs-dist/build/pdf.worker.mjs' {
    const content: any
    export default content
  }
  
  // While we're at it, let's also declare the URL module for the worker
  declare module '*.worker.ts' {
    const content: new () => Worker
    export default content
  }