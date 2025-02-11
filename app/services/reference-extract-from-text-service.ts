import type { Reference } from '@/app/types/reference'

export class ReferenceExtractFromTextService {
  private static CHUNK_SIZE = 4000

  private splitIntoChunks(text: string): string[] {
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

  async processText(text: string): Promise<Reference[]> {
    // For short texts, process directly
    if (text.length <= ReferenceExtractFromTextService.CHUNK_SIZE) {
      return this.processChunk(text)
    }

    // Split into chunks and process
    const chunks = this.splitIntoChunks(text)
    const allReferences: Reference[] = []

    // Process chunks sequentially to avoid overwhelming the API
    for (const chunk of chunks) {
      try {
        const references = await this.processChunk(chunk)
        allReferences.push(...references)
      } catch (error) {
        console.error('Error processing chunk:', error)
        // Continue processing other chunks even if one fails
      }
    }

    // Remove duplicates based on DOI or raw text
    const seen = new Set()
    const uniqueReferences = allReferences.filter(ref => {
      const key = ref.DOI || ref.raw
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return uniqueReferences
  }

  // Optional progress callback for the worker
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
    
    for (let i = 0; i < chunks.length; i++) {
      try {
        const references = await this.processChunk(chunks[i])
        allReferences.push(...references)
        onProgress?.(i + 1, chunks.length)
      } catch (error) {
        console.error(`Error processing chunk ${i + 1}/${chunks.length}:`, error)
      }
    }

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