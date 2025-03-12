import type { QueueItem, WorkerMessage } from './types'
import type { Reference } from '@/app/types/reference'

export class PDFQueueService {
  private queue: QueueItem[] = []
  private workers: Worker[] = []
  private maxWorkers: number = 5
  private workerScript: string
  private activeJobs: Map<Worker, string> = new Map()
  private updateListener: ((message: WorkerMessage) => void) | null = null
  private onCompleteCallback: (() => void) | null = null

  constructor(workerScript: string) {
    this.workerScript = workerScript
    //console.log('Worker script path:', this.workerScript)
  }

  public addPDFs(files: File[]) {
    const items: QueueItem[] = files.map((file) => ({
      id: file.name,
      file,
      status: 'pending'
    }))

    this.queue.push(...items)
    this.processQueue()
  }

  /**
   * Reset the queue service to its initial state
   */
  public reset() {
    // Terminate all active workers
    this.workers.forEach((worker) => {
      worker.terminate()
    })

    // Clear all internal state
    this.workers = []
    this.queue = []
    this.activeJobs = new Map()

    // Notify listeners of reset if needed
    /*if (this.updateListener) {
      this.updateListener({
        type: 'update',
        pdfId: 'system',
        message: 'Queue service reset'
      })
    }*/

    console.log('Queue service reset complete')
  }

  // provide a method to set the callback.
  public onAllComplete(callback: () => void) {
    this.onCompleteCallback = callback
  }

  /**
   * Register a listener for worker updates (e.g., UI updates).
   */
  public onUpdate(listener: (message: WorkerMessage) => void) {
    this.updateListener = listener
  }

  private initializeWorkerPool() {
    const workerCount = Math.min(this.maxWorkers, this.queue.length)

    for (let i = 0; i < workerCount; i++) {
      const worker = new Worker(this.workerScript)
      worker.onmessage = (e: MessageEvent<WorkerMessage>) =>
        this.handleWorkerMessage(worker, e.data)
      this.workers.push(worker)
      worker.onerror = (e) => {
        console.error('Worker error:', e.message, e)
      }
    }
  }

  private handleWorkerMessage(worker: Worker, message: WorkerMessage) {
    switch (message.type) {
      case 'ready':
        // Worker is ready for next job
        this.processNextItem(worker)
        break

      case 'complete':
        if (message.pdfId) {
          const item = this.queue.find((i) => i.id === message.pdfId)
          if (item) {
            item.status = 'complete'
          }
          this.activeJobs.delete(worker)

          // Send verified references to the update listener
          if (this.updateListener) {
            this.updateListener({
              type: 'complete',
              pdfId: message.pdfId,
              references: message.references,
              message: `Processing complete for PDF ${message.pdfId}`
            })
          }

          this.processNextItem(worker)

          // update database with references
        }
        break

      case 'reference-verified':
        // Forward the message to the update listener
        if (this.updateListener) {
          this.updateListener(message)
        }
        break

      case 'references':
        //console.log(`Message: ${message.message}`)
        // Update state or UI with the batch results
        if (this.updateListener) {
          //console.log('updating listener')
          this.updateListener(message)
        }
        break

      case 'update':
        //console.log(`${message.pdfId} : message ${message.message}`)
        // Update state or UI with the batch results
        if (this.updateListener) {
          this.updateListener(message)
        }
        break

      case 'error':
        if (message.pdfId) {
          const item = this.queue.find((i) => i.id === message.pdfId)
          if (item) {
            item.status = 'error'
          }
          this.activeJobs.delete(worker)
          this.processNextItem(worker)
        }
        break
    }
  }

  private processNextItem(worker: Worker) {
    const nextItem = this.queue.find((item) => item.status === 'pending')

    if (nextItem) {
      nextItem.status = 'processing'
      this.activeJobs.set(worker, nextItem.id)

      worker.postMessage({
        type: 'process',
        pdfId: nextItem.id,
        file: nextItem.file
        //highAccuracy: nextItem.highAccuracy
      })
    } else {
      // No more items to process
      worker.terminate()
      this.workers = this.workers.filter((w) => w !== worker)

      if (this.workers.length === 0) {
        this.onComplete()
      }
    }
  }

  private processQueue() {
    if (this.workers.length === 0) {
      this.initializeWorkerPool()

      // Start initial processing
      this.workers.forEach((worker) => {
        this.processNextItem(worker)
      })
    }
  }

  private onComplete() {
    // Gather all completed references from the queue
    const allReferences: Reference[] = this.queue
      .filter((item) => item.status === 'complete')
      .flatMap((item) => item.references || [])

    // Add any completion callbacks here
    if (this.onCompleteCallback) {
      this.onCompleteCallback()
    }

    if (this.updateListener) {
      this.updateListener({
        type: 'batch-complete',
        pdfId: 'system',
        verifiedReference: allReferences,
        message: `All PDFs have been processed. Total references: ${allReferences.length}`
      })
    }
  }

  public getStatus() {
    return {
      pending: this.queue.filter((i) => i.status === 'pending').length,
      processing: this.queue.filter((i) => i.status === 'processing').length,
      complete: this.queue.filter((i) => i.status === 'complete').length,
      error: this.queue.filter((i) => i.status === 'error').length
    }
  }
}
