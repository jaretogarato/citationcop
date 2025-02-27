// this service is responsible for extracting references from text
// it splits the text into chunks and processes them in parallel batches
// to avoid hitting the API rate limit
// it also removes duplicate references from the results
// the processTextWithProgress method provides a way to track progress
// while processing large texts
//

import type { Reference } from '@/app/types/reference'

export class ReferenceExtractFromTextService {
  private static CHUNK_SIZE = 2000
  private static BATCH_SIZE = 5

  private splitIntoChunks(text: string): string[] {
    console.log('Splitting text into chunks:', text)
    const references = text
      .split(/\n/)
      .map((ref) => ref.trim())
      .filter((ref) => ref.length > 0)

    const chunks: string[] = []
    let currentChunk = ''

    for (const ref of references) {
      if ((currentChunk + '\n' + ref).length > ReferenceExtractFromTextService.CHUNK_SIZE && currentChunk) {
        chunks.push(currentChunk)
        currentChunk = ref
      } else {
        currentChunk += (currentChunk ? '\n' : '') + ref
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk)
    }

    return chunks
  }

  private async processChunk(chunk: string): Promise<Reference[]> {
    const response = await fetch('/api/references/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: chunk })
    })

    if (!response.ok) {
      throw new Error(`Failed to process chunk: ${response.statusText}`)
    }

    const { references } = await response.json()
    return references || []
  }

  private async processBatch(
    chunks: string[], 
    startIndex: number,
    onProgress?: (processed: number, total: number) => void,
    totalChunks?: number
  ): Promise<Reference[]> {
    const batchPromises = chunks.map(async (chunk, index) => {
      try {
        const references = await this.processChunk(chunk)
        if (onProgress) {
          onProgress(startIndex + index + 1, totalChunks || chunks.length)
        }
        return references
      } catch (error) {
        console.error(`Error processing chunk ${startIndex + index + 1}:`, error)
        return []
      }
    })

    const batchResults = await Promise.all(batchPromises)
    return batchResults.flat()
  }

  async processText(text: string): Promise<Reference[]> {
    if (text.length <= ReferenceExtractFromTextService.CHUNK_SIZE) {
      return this.processChunk(text)
    }

    const chunks = this.splitIntoChunks(text)
    const allReferences: Reference[] = []

    // Process chunks in parallel batches
    for (let i = 0; i < chunks.length; i += ReferenceExtractFromTextService.BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + ReferenceExtractFromTextService.BATCH_SIZE)
      const batchReferences = await this.processBatch(batchChunks, i)
      allReferences.push(...batchReferences)
    }

    // Remove duplicates
    const seen = new Set()
    const uniqueReferences = allReferences.filter(ref => {
      const key = ref.DOI || ref.raw
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return uniqueReferences
  }

  async processTextWithProgress(
    text: string,
    onProgress?: (processed: number, total: number) => void
  ): Promise<Reference[]> {
    if (text.length <= ReferenceExtractFromTextService.CHUNK_SIZE) {
      const references = await this.processChunk(text)
      onProgress?.(1, 1)
      return references
    }

    const chunks = this.splitIntoChunks(text)
    const allReferences: Reference[] = []
    const totalChunks = chunks.length
    
    console.log(`Processing ${totalChunks} chunks in batches of ${ReferenceExtractFromTextService.BATCH_SIZE}`)
    
    // Process chunks in parallel batches
    for (let i = 0; i < chunks.length; i += ReferenceExtractFromTextService.BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + ReferenceExtractFromTextService.BATCH_SIZE)
      console.log(`Processing batch ${Math.floor(i / ReferenceExtractFromTextService.BATCH_SIZE) + 1} (chunks ${i + 1}-${i + batchChunks.length})`)
      
      const startTime = performance.now()
      const batchReferences = await this.processBatch(batchChunks, i, onProgress, totalChunks)
      const endTime = performance.now()
      
      console.log(`Batch completed in ${(endTime - startTime).toFixed(2)}ms`)
      allReferences.push(...batchReferences)
    }

    // Remove duplicates
    const seen = new Set()
    const uniqueReferences = allReferences.filter(ref => {
      const key = ref.DOI || ref.raw
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return uniqueReferences
  }
}