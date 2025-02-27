import type {
  Reference,
  ReferenceStatus,
  GoogleSearchResult
} from '@/app/types/reference'

const BATCH_SIZE = 3

export class SearchReferenceService {
  private async processReference(reference: Reference): Promise<Reference> {
    if (reference.status === 'verified') {
      return reference
    }

    const query = `${reference.title} ${reference.authors.join(' ')}`
    
    try {
      const response = await fetch('/api/serper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache'
        },
        body: JSON.stringify({ q: query })
      })

      if (!response.ok) {
        console.error('Search API error:', await response.text())
        throw new Error('Failed to process reference')
      }

      const results: GoogleSearchResult = await response.json()

      // Log the raw results for debugging
      //console.log('Search API results for reference:', reference.id, results)

      // Return updated reference with search results
      return {
        ...reference,
        status:
          (results.organic?.length ?? 0) > 0
            ? ('pending' as ReferenceStatus)
            : ('error' as ReferenceStatus),
        verification_source: 'google',
        message:
          (results.organic?.length ?? 0) > 0
            ? 'Found matching results'
            : 'No matching results found',
        searchResults: results
      }
    } catch (error) {
      console.error('Error processing reference:', reference.id, error)
      return {
        ...reference,
        status: 'error' as ReferenceStatus,
        verification_source: 'google',
        message: 'Failed to verify reference'
      }
    }
  }

  public async processBatch(
    references: Reference[],
    onBatchComplete: (refs: Reference[]) => void
  ): Promise<Reference[]> {
    const processedRefs: Reference[] = []
    let currentIndex = 0

    while (currentIndex < references.length) {
      const batch = references.slice(currentIndex, currentIndex + BATCH_SIZE)
      /*console.log(
        `Processing batch ${currentIndex}-${currentIndex + batch.length}...`
      )*/

      const results = await Promise.all(
        batch.map((ref) => this.processReference(ref))
      )
      processedRefs.push(...results)

      // Log batch results for debugging
     /* console.log(
        `Batch results (${currentIndex}-${currentIndex + batch.length}):`,
        results
      )*/

      // Notify the callback with the batch results
      onBatchComplete(results)

      currentIndex += BATCH_SIZE

      // Add a small delay between batches for throttling
      await new Promise((resolve) => setTimeout(resolve, 250))
    }

    //console.log('All references processed:', processedRefs)
    return processedRefs
  }
}
