//// types/pdf-worker.d.ts
//declare module 'pdfjs-dist/build/pdf.worker.mjs' {
//    const content: any
//    export default content
//  }

//  // While we're at it, let's also declare the URL module for the worker
//  declare module '*.worker.ts' {
//    const content: new () => Worker
//    export default content
//  }

// Declare module for pdf.js worker
declare module 'pdfjs-dist/build/pdf.worker.mjs' {
  const workerSrc: string;
  export default workerSrc;
}

// Declare module for pdf.js worker in CommonJS environments
declare module 'pdfjs-dist/build/pdf.worker.min.js' {
  const workerSrc: string;
  export default workerSrc;
}

// Declare module for custom worker files (like verification-worker.js)
declare module '*.worker.ts' {
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}

