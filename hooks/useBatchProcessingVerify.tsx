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

  const verifyReference = async (reference: Reference): Promise<Reference> => {
    if (!reference.searchResults) {
      return {
        ...reference,
        status: 'error' as ReferenceStatus,
        verification_source: 'openai',
        message: 'No search results available for verification'
      };
    }

    try {
      // Fixed API endpoint URL
      const response = await fetch('/api/references/openAI-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reference,
          searchResults: reference.searchResults,
          keyIndex: currentKeyIndex.current,
          maxRetries: MAX_RETRIES
        }),
      });

      if (!response.ok) {
        console.error(`Verification failed with status ${response.status}`);
        throw new Error(`Verification failed with status ${response.status}`);
      }

      const result = await response.json();
      
      // Rotate through available API keys
      currentKeyIndex.current = (currentKeyIndex.current + 1) % 3;

      console.log('Verification result:', result);

      return {
        ...reference,
        status: result.isValid ? 'verified' as ReferenceStatus : 'error' as ReferenceStatus,
        verification_source: 'Google search confirmation',
        message: result.message
      };
    } catch (error) {
      console.error('Error verifying reference:', error);
      return {
        ...reference,
        status: 'error' as ReferenceStatus,
        verification_source: 'openai',
        message: error instanceof Error ? error.message : 'Failed to verify reference'
      };
    }
  };

  const processBatch = useCallback(async (
    references: Reference[],
    startIndex: number,
    onBatchComplete: (refs: Reference[]) => void
  ) => {
    if (processingRef.current) {
      console.log('Already processing a verification batch, skipping');
      return;
    }

    try {
      processingRef.current = true;
      const endIndex = Math.min(startIndex + BATCH_SIZE, references.length);
      const currentBatch = references.slice(startIndex, endIndex);

      console.log(`Verifying batch ${startIndex}-${endIndex} of ${references.length}`);

      const results = await Promise.all(
        currentBatch.map(ref => verifyReference(ref))
      );

      setProcessedRefs(prev => {
        const newRefs = [...prev, ...results];
        const newProgress = (newRefs.length / references.length) * 100;
        setProgress(newProgress);
        return newRefs;
      });

      if (endIndex < references.length) {
        setTimeout(() => {
          processBatch(references, endIndex, onBatchComplete);
        }, 1000);
      } else {
        console.log('All verifications complete');
        onBatchComplete(processedRefs);
      }
    } catch (error) {
      console.error('Batch verification error:', error);
    } finally {
      processingRef.current = false;
    }
  }, [processedRefs]);

  return {
    processBatch,
    progress,
    processedRefs
  };
}