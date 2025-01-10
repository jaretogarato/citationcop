import type { QueueItem, WorkerMessage } from './types'

export class PDFQueueService {
  private queue: QueueItem[] = []
  private workers: Worker[] = []
  private maxWorkers: number = 5
  private workerScript: string
  private activeJobs: Map<Worker, string> = new Map()

  constructor(workerScript: string) {
    this.workerScript = workerScript
  }

  public addPDFs(files: File[]) {
    const items: QueueItem[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: 'pending'
    }));

    this.queue.push(...items);
    this.processQueue();
  }

  private initializeWorkerPool() {
    const workerCount = Math.min(this.maxWorkers, this.queue.length);

    for (let i = 0; i < workerCount; i++) {
      const worker = new Worker(this.workerScript);
      worker.onmessage = (e: MessageEvent<WorkerMessage>) =>
        this.handleWorkerMessage(worker, e.data);
      this.workers.push(worker);
    }
  }

  private handleWorkerMessage(worker: Worker, message: WorkerMessage) {
    switch (message.type) {
      case 'ready':
        // Worker is ready for next job
        this.processNextItem(worker);
        break;

      case 'complete':
        if (message.pdfId) {
          const item = this.queue.find((i) => i.id === message.pdfId);
          if (item) {
            item.status = 'complete';
          }
          this.activeJobs.delete(worker);
          this.processNextItem(worker);
        }
        break;

      case 'error':
        if (message.pdfId) {
          const item = this.queue.find((i) => i.id === message.pdfId);
          if (item) {
            item.status = 'error';
          }
          this.activeJobs.delete(worker);
          this.processNextItem(worker);
        }
        break;
    }
  }

  private processNextItem(worker: Worker) {
    const nextItem = this.queue.find((item) => item.status === 'pending');

    if (nextItem) {
      nextItem.status = 'processing';
      this.activeJobs.set(worker, nextItem.id);
      worker.postMessage({
        type: 'process',
        pdfId: nextItem.id,
        file: nextItem.file
      });
    } else {
      // No more items to process
      worker.terminate();
      this.workers = this.workers.filter((w) => w !== worker);

      if (this.workers.length === 0) {
        this.onComplete();
      }
    }
  }

  private processQueue() {
    if (this.workers.length === 0) {
      this.initializeWorkerPool();

      // Start initial processing
      this.workers.forEach((worker) => {
        this.processNextItem(worker);
      });
    }
  }

  private onComplete() {
    console.log('All PDFs processed');
    // Add any completion callbacks here
  }

  public getStatus() {
    return {
      pending: this.queue.filter((i) => i.status === 'pending').length,
      processing: this.queue.filter((i) => i.status === 'processing').length,
      complete: this.queue.filter((i) => i.status === 'complete').length,
      error: this.queue.filter((i) => i.status === 'error').length
    };
  }
}

// worker.ts
self.onmessage = async (e: MessageEvent) => {
  const { type, pdfId, file } = e.data;

  if (type === 'process') {
    try {
      // Here you would add the actual PDF processing logic
      // For now, we'll just simulate processing with a delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Send completion message back to main thread
      self.postMessage({
        type: 'complete',
        pdfId
      });
    } catch (error) {
      self.postMessage({
        type: 'error',
        pdfId,
        error: (error as Error).message
      });
    }
  }
};

// usage-example.ts
const queueService = new PDFQueueService('/worker.js');

// When user selects files
function handleFileSelect(files: FileList) {
  queueService.addPDFs(Array.from(files));
}
