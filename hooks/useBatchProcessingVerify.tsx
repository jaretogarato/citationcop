'use client';

import { useState, useCallback, useRef } from 'react';
import type { Reference, ReferenceStatus } from '@/types/reference';

const BATCH_SIZE = 3; // Match the number of API keys for true parallel processing

interface VerificationData {
  stats: {
    verified: number;
    issues: number;
    pending: number;
    totalReferences: number;
  };
  references: Reference[];
}

export function useBatchProcessingVerify() {
  const [processedRefs, setProcessedRefs] = useState<Reference[]>([]);
  const [progress, setProgress] = useState(0);
  const processingRef = useRef(false);
  const accumulatedRefs = useRef<Reference[]>([]);

  const processReference = async (reference: Reference, keyIndex: number): Promise<Reference> => {
    try {
      const response = await fetch('/api/references/openAI-verify', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          reference,
          searchResults: reference.searchResults,
          keyIndex,
          maxRetries: 2
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to verify reference');
      }

      const result = await response.json();

      return {
        ...reference,
        status: result.isValid ? 'verified' as ReferenceStatus : 'error' as ReferenceStatus,
        verification_source: 'openai',
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
    onBatchComplete: (data: VerificationData) => void
  ) => {
    if (processingRef.current) {
      console.log('Already processing a batch, skipping');
      return;
    }

    if (!references || references.length === 0) {
      console.warn('No references to verify');
      onBatchComplete({
        stats: { verified: 0, issues: 0, pending: 0, totalReferences: 0 },
        references: []
      });
      return;
    }

    try {
      processingRef.current = true;
      const endIndex = Math.min(startIndex + BATCH_SIZE, references.length);
      const currentBatch = references.slice(startIndex, endIndex);
      
      console.log(`Processing verify batch ${startIndex}-${endIndex} of ${references.length}`);
      
      // Process the current batch of references in parallel
      // Each reference uses a different API key
      const results = await Promise.all(
        currentBatch.map((ref, index) => processReference(ref, index))
      );

      // Update accumulated refs
      accumulatedRefs.current = [...accumulatedRefs.current, ...results];
      
      // Update processed refs for UI
      setProcessedRefs(accumulatedRefs.current);
      setProgress((accumulatedRefs.current.length / references.length) * 100);

      // If there are more references to process, continue with next batch
      if (endIndex < references.length) {
        setTimeout(() => {
          processBatch(references, endIndex, onBatchComplete);
        }, 1000); // Longer delay between verification batches
      } else {
        // Final batch complete
        console.log('Verification phase complete, passing refs:', accumulatedRefs.current.length);
        
        // Calculate final stats
        const verificationData: VerificationData = {
          stats: {
            verified: accumulatedRefs.current.filter(ref => ref.status === 'verified').length,
            issues: accumulatedRefs.current.filter(ref => ref.status === 'error').length,
            pending: 0,
            totalReferences: references.length
          },
          references: accumulatedRefs.current
        };
        
        onBatchComplete(verificationData);
        // Reset accumulated refs for next run
        accumulatedRefs.current = [];
      }
    } catch (error) {
      console.error('Batch verification error:', error);
    } finally {
      processingRef.current = false;
    }
  }, []); // No dependencies to prevent recreation

  return {
    processBatch,
    progress,
    processedRefs
  };
}