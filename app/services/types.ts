// app/services/types.ts
import { Reference } from '@/app/types/reference';

export type QueueItemStatus = 'pending' | 'processing' | 'complete' | 'error';

export interface QueueItem {
  id: string
  file: File
  status: QueueItemStatus
  highAccuracy: boolean
  references?: Reference[]
  error?: string
}

export type WorkerMessage = 
  | { type: 'ready' }
  | { type: 'complete'; pdfId: string; references: Reference[], message: string }
  | { type: 'error'; pdfId: string; error: string }
  | { type: 'update'; pdfId: string, message: string }
  | { type: 'references'; pdfId: string, noReferences: number, message: string}