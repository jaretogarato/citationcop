'use client';

import { useState, useCallback, useRef } from 'react';
import type { Reference, ReferenceStatus } from '@/types/reference';

const BATCH_SIZE = 3;
const MAX_RETRIES = 2;

export function useBatchProcessingVerify() {
  const [processedRefs, setProcessedRefs] = useState<Reference[]>([]);
  const [progress, setProgress] = useState(0);
  const processingRef = useRef(false);
  const currentKeyIndex = useRef(0);

  const processBatch = useCallback(async (
    references: Reference[],
    startIndex: number,
    onBatchComplete: (refs: Reference[]) => void
  ) => {
    if (processingRef.current) {
      console.log('Already processing a verification batch, skipping');
      return;
    }

    if (!references || references.length === 0) {
      console.warn('No references to verify');
      return;
    }

    console.log(`Starting verification of batch with ${references.length} references`);

    try {
      processingRef.current = true;
      const endIndex = Math.min(startIndex + BATCH_SIZE, references.length);
      const currentBatch = references.slice(startIndex, endIndex);

      console.log(`Verifying batch ${startIndex}-${endIndex} of ${references.length}`);

      const results = await Promise.all(
        currentBatch.map(async (ref) => {
          try {
            const response = await fetch('/api/references/openai-verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                reference: ref,
                searchResults: ref.searchResults,
                keyIndex: currentKeyIndex.current,
                maxRetries: MAX_RETRIES
              }),
            });

            if (!response.ok) {
              throw new Error(`Verification failed with status ${response.status}`);
            }

            const result = await response.json();
            
            currentKeyIndex.current = (currentKeyIndex.current + 1) % 3;

            return {
              ...ref,
              status: result.isValid ? 'verified' as ReferenceStatus : 'error' as ReferenceStatus,
              verification_source: 'openai',
              message: result.message
            };
          } catch (error) {
            console.error('Error verifying reference:', error);
            return {
              ...ref,
              status: 'error' as ReferenceStatus,
              verification_source: 'openai',
              message: error instanceof Error ? error.message : 'Failed to verify reference'
            };
          }
        })
      );

      setProcessedRefs(prev => {
        const newRefs = [...prev, ...results];
        const newProgress = (newRefs.length / references.length) * 100;
        console.log(`Updated progress: ${newProgress}%, Total processed: ${newRefs.length}`);
        setProgress(newProgress);
        return newRefs;
      });

      if (endIndex < references.length) {
        setTimeout(() => {
          processBatch(references, endIndex, onBatchComplete);
        }, 1000);
      } else {
        console.log('All references verified, calling completion callback');
        processingRef.current = false;
        onBatchComplete(processedRefs);
      }
    } catch (error) {
      console.error('Batch verification error:', error);
      processingRef.current = false;
    }
  }, []);

  return {
    processBatch,
    progress,
    processedRefs
  };
}