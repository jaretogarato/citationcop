// app/services/workers/pdf.worker.ts

/// <reference lib="webworker" />

import { WorkerMessage } from '../types';

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = async (e: MessageEvent) => {
  const { type, pdfId, file } = e.data;

  if (type === 'process') {
    try {
      // Simulated processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Send completion message back to main thread
      self.postMessage({
        type: 'complete',
        pdfId
      } as WorkerMessage);
    } catch (error) {
      self.postMessage({
        type: 'error',
        pdfId,
        error: (error as Error).message
      } as WorkerMessage);
    }
  }
};
