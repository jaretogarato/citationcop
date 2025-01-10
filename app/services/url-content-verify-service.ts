import type {
  Reference,
  ReferenceStatus,
  UrlVerificationResult
} from '@/app/types/reference'

export class URLContentVerifyService {
  private static BATCH_SIZE = 5 // Adjust batch size as needed

  // Utility function to validate URLs
  private isValidUrl(url: string): boolean {
    try {
      new URL(url) // Will throw if invalid
      return true
    } catch {
      return false
    }
  }


  public async verifyReferencesWithUrls(
    references: Reference[]
  ): Promise<Reference[]> {
    // Step 1: Filter references that have URLs
    //const urlReferences = references.filter((ref) => ref.url)

    // Step 1: Filter references that have valid URLs
    const urlReferences = references.filter((ref) => ref.url && this.isValidUrl(ref.url))


    // Step 2: Process references with URLs in batches
    const verifiedReferences: Reference[] = []
    let currentIndex = 0

    while (currentIndex < urlReferences.length) {
      const batch = urlReferences.slice(
        currentIndex,
        currentIndex + URLContentVerifyService.BATCH_SIZE
      )

      const batchResults = await Promise.all(
        batch.map(async (ref) => {
          try {
            const response = await fetch('/api/references/url-verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reference: ref, maxRetries: 2 })
            })

            if (!response.ok) {
              throw new Error('Failed to verify URL content')
            }

            const result: UrlVerificationResult = await response.json()
            if (result.status === 'verified') {
              return {
                ...ref,
                status: 'verified' as ReferenceStatus,
                message: result.message,
                url_match: true
              }
            }
          } catch (error) {
            console.error('Error verifying URL content:', error)
          }

          return ref // Return unchanged if verification fails
        })
      )

      verifiedReferences.push(...batchResults)
      currentIndex += URLContentVerifyService.BATCH_SIZE

      // Add a small delay between batches if needed
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // Step 3: Map verified results back to the original references
    const finalResults = references.map(
      (ref) => verifiedReferences.find((vRef) => vRef.id === ref.id) || ref
    )

    return finalResults
  }
}
