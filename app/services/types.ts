// app/services/types.ts
export interface QueueItem {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'complete' | 'error';
}

export interface WorkerMessage {
  type: 'ready' | 'complete' | 'error';
  pdfId?: string;
  error?: string;
}
