'use client'

import { useState, useCallback, useRef } from 'react'
import type { Reference, ReferenceStatus } from '@/app/types/reference'

const BATCH_SIZE = 5

export function useBatchProcessingSearch() {
  const [processedRefs, setProcessedRefs] = useState<Reference[]>([])
  const [progress, setProgress] = useState(0)
  const processingRef = useRef(false)
  const accumulatedRefs = useRef<Reference[]>([])

  const processReference = async (reference: Reference): Promise<Reference> => {
    const query = `${reference.title} ${reference.authors.join(' ')}`
    //console.log('Searchign reference:', reference.id)

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

      const results = await response.json()

      return {
        ...reference,
        status:
          results.organic?.length > 0
            ? ('pending' as ReferenceStatus)
            : ('error' as ReferenceStatus),
        verification_source: 'google',
        message:
          results.organic?.length > 0
            ? 'Found matching results'
            : 'No matching results found',
        searchResults: results
      }
    } catch (error) {
      console.error('Error processing reference:', error)
      return {
        ...reference,
        status: 'error' as ReferenceStatus,
        verification_source: 'google',
        message: 'Failed to verify reference'
      }
    }
  }

  const processBatch = useCallback(
    async (
      references: Reference[],
      startIndex: number,
      onBatchComplete: (refs: Reference[]) => void
    ) => {
      if (processingRef.current) {
        console.log('Already processing a batch, skipping')
        return
      }

      if (!references || references.length === 0) {
        console.warn('No references to process')
        onBatchComplete([])
        return
      }

      try {
        processingRef.current = true
        const endIndex = Math.min(startIndex + BATCH_SIZE, references.length)
        const currentBatch = references.slice(startIndex, endIndex)

        /*console.log(
          `Processing search batch ${startIndex}-${endIndex} of ${references.length}`
        )*/

        // Process the current batch of references in parallel
        const results = await Promise.all(
          currentBatch.map((ref) => processReference(ref))
        )

        // Update accumulated refs
        accumulatedRefs.current = [...accumulatedRefs.current, ...results]

        // Update processed refs for UI
        setProcessedRefs(accumulatedRefs.current)
        setProgress((accumulatedRefs.current.length / references.length) * 100)

        // If there are more references to process, continue with next batch
        if (endIndex < references.length) {
          // Add a small delay between batches
          setTimeout(() => {
            processBatch(references, endIndex, onBatchComplete)
          }, 100)
        } else {
          // Final batch complete
          console.log(
            'Search phase complete, passing refs:',
            accumulatedRefs.current.length
          )
          onBatchComplete(accumulatedRefs.current)
          // Reset accumulated refs for next run
          accumulatedRefs.current = []
        }
      } catch (error) {
        console.error('Batch processing error:', error)
      } finally {
        processingRef.current = false
      }
    },
    []
  ) // Remove processedRefs dependency

  return {
    processBatch,
    progress,
    processedRefs
  }
}
