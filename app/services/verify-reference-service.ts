import type { Reference, ReferenceStatus } from '@/app/types/reference'

const BATCH_SIZE = 3

export class VerifyReferenceService {
  private async processReference(
    reference: Reference,
    keyIndex: number
  ): Promise<Reference> {
    try {
      const response = await fetch('/api/references/openAI-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference,
          searchResults: reference.searchResults,
          keyIndex,
          maxRetries: 2
        })
      })

      if (!response.ok) {
        throw new Error('Failed to verify reference')
      }

      const result = await response.json()

      return {
        ...reference,
        status: result.status as ReferenceStatus,
        verification_source: 'analysis of search results',
        message: result.message
      }
    } catch (error) {
      return {
        ...reference,
        status: 'error' as ReferenceStatus,
        verification_source: 'analysis of search results',
        message:
          error instanceof Error ? error.message : 'Failed to verify reference'
      }
    }
  }

  public async processBatch(
    references: Reference[],
    onBatchComplete: (refs: Reference[]) => void
  ): Promise<Reference[]> {
    // Create a copy of the input array
    const result = [...references]

    // Track unverified references with their original indices
    const unverifiedRefs = references
      .map((ref, index) => ({ ref, originalIndex: index }))
      .filter(({ ref }) => ref.status !== 'verified')

    for (let i = 0; i < unverifiedRefs.length; i += BATCH_SIZE) {
      // Get the current batch
      const currentBatch = unverifiedRefs.slice(i, i + BATCH_SIZE)

      // Process the batch
      const processedResults = await Promise.all(
        currentBatch.map(({ ref }, batchIndex) =>
          this.processReference(ref, batchIndex)
        )
      )

      // Put the processed results back in their original positions
      processedResults.forEach((processedRef, batchIndex) => {
        const originalIndex = currentBatch[batchIndex].originalIndex
        result[originalIndex] = processedRef
      })

      // Call the batch complete callback
      onBatchComplete(processedResults)

      // Add delay between batches
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    return result
  }
}
