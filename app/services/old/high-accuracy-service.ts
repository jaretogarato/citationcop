// app/services/high-accuracy-service.ts

import type { Reference } from '@/app/types/reference'

export class HighAccuracyCheckService {
  constructor(private apiEndpoint: string = '/api/high-accuracy-check') {}

  private async verifyReference(reference: Reference): Promise<Reference[]> {
    try { 
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference })
      })

      if (!response.ok) {
        console.error('Error verifying reference:', reference)
        return [{
          ...reference,
          status: 'error',
          message: 'Verification failed'
        }]
      }

      const result = await response.json()

      if (Array.isArray(result)) {
        if (result.length === 1 && result[0].ok === true) {
          // Reference is verified correct
          return [{
            ...reference,
            status: 'verified',
            message: 'Reference verified correct'
          }]
        } else {
          // We got corrected/multiple references
          return result.map((correctedRef, index) => ({
            ...correctedRef,
            id: correctedRef.id || `${reference.id}-${index + 1}`,
            status: 'verified',
            message: 'Reference corrected/expanded'
          }))
        }
      }

      // Unexpected response format
      console.error('Unexpected response format:', result)
      return [{
        ...reference,
        status: 'error',
        message: 'Invalid verification response'
      }]
    } catch (error) {
      console.error('Error processing reference:', error)
      return [{
        ...reference,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }]
    }
  }

  async processBatch(references: Reference[]): Promise<Reference[]> {
    const batchSize = 3
    const checkedReferences: Reference[] = []

    // Process references in batches of 3
    for (let i = 0; i < references.length; i += batchSize) {
      const batch = references.slice(i, i + batchSize)
      
      // Process each reference in the batch concurrently
      const batchPromises = batch.map(ref => this.verifyReference(ref))
      
      // Wait for all references in this batch to complete
      const batchResults = await Promise.all(batchPromises)
      
      // Flatten and add results to checkedReferences
      checkedReferences.push(...batchResults.flat())
      
      console.log(`Processed batch ${i/batchSize + 1} of ${Math.ceil(references.length/batchSize)}`)
    }

    return checkedReferences
  }
}