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
    const processedRefs: Reference[] = []
    let currentIndex = 0

    // Filter out references that are already verified
    const unverifiedReferences = references.filter(
      (ref) => ref.status !== 'verified'
    )

    /*console.log(
      `Skipping ${references.length - unverifiedReferences.length} already verified references.`
    )*/

    while (currentIndex < unverifiedReferences.length) {
      const batch = unverifiedReferences.slice(
        currentIndex,
        currentIndex + BATCH_SIZE
      )
      /*console.log(
        `Processing verification batch: ${currentIndex}-${currentIndex + batch.length}`
      )*/

      const results = await Promise.all(
        batch.map((ref, index) => this.processReference(ref, index))
      )

      processedRefs.push(...results)
      onBatchComplete(results)
      currentIndex += BATCH_SIZE

      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // Reconstruct the full list in the original order
    return references.map((ref) => {
      const processedRef = processedRefs.find(
        (processed) => processed.id === ref.id
      )
      return processedRef || ref
    })
  }
}
