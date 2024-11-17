// hooks/useBatchProcessingSearch.ts
import { useState, useCallback, useRef } from 'react';
import type { Reference, ReferenceStatus } from '@/types/reference';

const BATCH_SIZE = 5;

export function useBatchProcessingSearch() {
  const [processedRefs, setProcessedRefs] = useState<Reference[]>([]);
  const [progress, setProgress] = useState(0);
  const processingRef = useRef(false);

  const processReference = async (reference: Reference): Promise<Reference> => {
    const query = `${reference.title} ${reference.authors.join(' ')}`;
    console.log('Processing reference:', reference.id);
    
    try {
      const response = await fetch('/api/serper', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          // Add cache control headers
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({ q: query }),
      });

      if (!response.ok) {
        console.error('Search API error:', await response.text());
        throw new Error('Failed to process reference');
      }

      const results = await response.json();

      return {
        ...reference,
        status: results.organic?.length > 0 ? 'verified' as ReferenceStatus : 'error' as ReferenceStatus,
        verification_source: 'google',
        message: results.organic?.length > 0 ? 'Found matching results' : 'No matching results found',
        searchResults: results
      };
    } catch (error) {
      console.error('Error processing reference:', error);
      return {
        ...reference,
        status: 'error' as ReferenceStatus,
        verification_source: 'google',
        message: 'Failed to verify reference'
      };
    }
  };

  const processBatch = useCallback(async (
    references: Reference[], 
    startIndex: number, 
    onBatchComplete: (refs: Reference[]) => void
  ) => {
    if (processingRef.current) {
      console.log('Already processing a batch, skipping');
      return;
    }

    try {
      processingRef.current = true;
      const endIndex = Math.min(startIndex + BATCH_SIZE, references.length);
      const currentBatch = references.slice(startIndex, endIndex);
      
      console.log(`Processing batch ${startIndex}-${endIndex} of ${references.length}`);
      
      // Process the current batch of references in parallel
      const results = await Promise.all(
        currentBatch.map(ref => processReference(ref))
      );

      // Update processed refs atomically
      setProcessedRefs(prev => {
        const newRefs = [...prev, ...results];
        const newProgress = (newRefs.length / references.length) * 100;
        setProgress(newProgress);
        return newRefs;
      });

      // If there are more references to process, continue with next batch
      if (endIndex < references.length) {
        // Add a small delay between batches
        setTimeout(() => {
          processBatch(references, endIndex, onBatchComplete);
        }, 100);
      } else {
        // Final batch complete
        onBatchComplete(processedRefs);
      }
    } catch (error) {
      console.error('Batch processing error:', error);
    } finally {
      processingRef.current = false;
    }
  }, []);

  return {
    processBatch,
    progress,
    processedRefs
  };
}