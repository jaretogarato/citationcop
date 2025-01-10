import type { QueueItem, WorkerMessage } from './types';

export class PDFQueueService {
  private queue: QueueItem[] = [];
  private workers: Worker[] = [];
  private maxWorkers: number = 5;
  private workerScript: string;
  private activeJobs: Map<Worker, string> = new Map();

  constructor(workerScript: string) {
    this.workerScript = workerScript;
    console.log('Worker script path:', this.workerScript);
  }

  public addPDFs(files: File[], highAccuracy: boolean) {
    const items: QueueItem[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: 'pending',
      highAccuracy
    }));

    this.queue.push(...items);
    this.processQueue();
  }

  private initializeWorkerPool() {
    console.log('Initializing worker pool');
    console.log('queue length: ', this.queue.length);
    const workerCount = Math.min(this.maxWorkers, this.queue.length);

    console.log(`Initializing worker pool with ${workerCount} workers`);
    for (let i = 0; i < workerCount; i++) {
      const worker = new Worker(this.workerScript);
      worker.onmessage = (e: MessageEvent<WorkerMessage>) =>
        this.handleWorkerMessage(worker, e.data);
      this.workers.push(worker);
      worker.onerror = (e) => {
        console.error('Worker error:', e.message, e);
      };
      //worker.postMessage({ type: 'ready' });
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

    console.log('Processing next item:', nextItem);

    if (nextItem) {
      nextItem.status = 'processing';
      this.activeJobs.set(worker, nextItem.id);

      worker.postMessage({
        type: 'process',
        pdfId: nextItem.id,
        file: nextItem.file,
        highAccuracy: nextItem.highAccuracy
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
