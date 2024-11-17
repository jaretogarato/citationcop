// utils/reference-utils.ts
import { useRef, useCallback, useState } from 'react';
import { Reference, ReferenceStatus } from '@/types/reference';
import { verifyReferences } from '@/utils/verify-helpers/verify-references';
import type { VerificationResults } from '@/types/reference';

// utils/reference-utils.ts
export async function verifyReferenceAndUpdateStatus(
  references: Reference[],
  onProgress?: (stage: 'google' | 'openai', count: number) => void
): Promise<Reference[]> {
  try {
    const verifiedRefs = await verifyReferences(references, onProgress);
    
    return verifiedRefs.map(ref => ({
      ...ref,
      status: ref.status as ReferenceStatus,
      verification_source: ref.verification_source,
      message: ref.message
    }));
  } catch (error) {
    console.error('Error in reference verification:', error);
    return references.map(ref => ({
      ...ref,
      status: 'error' as ReferenceStatus,
      verification_source: 'error',
      message: error instanceof Error ? error.message : 'Verification process failed'
    }));
  }
}

// hooks/useReferenceVerification.ts
export function useReferenceVerification(
  initialContent: Reference[],
  onComplete: (data: {
    stats: VerificationResults;
    references: Reference[];
  }) => void
) {
  const processingRef = useRef(false);
  const [state, setState] = useState({
    references: initialContent,
    stats: {
      verified: 0,
      issues: 0,
      pending: initialContent.length,
      totalReferences: initialContent.length,
    },
    progress: 0,
    currentReference: 1,
    processingStage: 'idle',
    processedCount: 0,
  });

  const BATCH_SIZE = 10; // Define the batch size
  const processNextReferences = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      const pendingRefs = state.references.filter((ref) => ref.status === 'pending');
      if (pendingRefs.length === 0) return;

      const batchToProcess = pendingRefs.slice(0, BATCH_SIZE);
      const verifiedRefs = await verifyReferenceAndUpdateStatus(
        batchToProcess,
        (stage, count) => {
          setState(prev => ({
            ...prev,
            processingStage: stage,
            processedCount: count
          }));
        }
      );

      setState((prevState) => {
        const newReferences = prevState.references.map((ref: Reference) => {
          const updatedRef = verifiedRefs.find((vRef) => vRef.id === ref.id);
          return updatedRef || ref;
        });

        const verified = newReferences.filter((ref: Reference) => ref.status === 'verified').length;
        const issues = newReferences.filter((ref: Reference) =>
          ref.status === 'unverified' || ref.status === 'error'
        ).length;
        const pending = newReferences.filter((ref) => ref.status === 'pending').length;

        if (pending === 0) {
          onComplete({
            stats: {
              verified,
              issues,
              pending,
              totalReferences: prevState.stats.totalReferences,
            },
            references: newReferences,
          });
        }

        return {
          progress: ((verified + issues) / prevState.stats.totalReferences) * 100,
          currentReference: Math.min(verified + issues + 1, prevState.stats.totalReferences),
          stats: {
            verified,
            issues,
            pending,
            totalReferences: prevState.stats.totalReferences,
          },
          references: newReferences,
          processingStage: pending === 0 ? 'complete' : prevState.processingStage,
          processedCount: prevState.processedCount
        };
      });

    } catch (error) {
      console.error('Error processing references:', error);
    } finally {
      processingRef.current = false;
    }
  }, [state, onComplete]);

  return {
    state,
    processNextReferences
  };
}