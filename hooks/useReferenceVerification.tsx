// hooks/useReferenceVerification.ts
import { useState, useCallback, useRef } from 'react';
import type { Reference, ReferenceStatus } from '@/types/reference';
import { verifyReferenceAndUpdateStatus } from '@/utils/verify-helpers/reference-utils';

interface VerificationResults {
  verified: number;
  issues: number;
  pending: number;
  totalReferences: number;
}

interface VerificationState {
  progress: number;
  currentReference: number;
  stats: VerificationResults;
  references: Reference[];

}

export function useReferenceVerification(
  initialContent: Reference[],  // Change type from string to Reference[]
  onComplete: (data: {
    stats: VerificationResults;
    references: Reference[];
  }) => void
) {
  const completedRef = useRef(false);
  const [state, setState] = useState<VerificationState>(() => {
    try {
      // No need to parse, initialContent is already Reference[]
      const initialReferences = initialContent.map(
        (ref: Reference, index: number) => ({
          ...ref,
          id: ref.id || index + 1,
          status: 'pending' as ReferenceStatus
        })
      );

      const totalReferences = initialReferences.length;

      return {
        progress: 0,
        currentReference: totalReferences > 0 ? 1 : 0,
        stats: {
          verified: 0,
          issues: 0,
          pending: totalReferences,
          totalReferences
        },
        references: initialReferences
      };
    } catch (error) {
      console.error('Initialization error:', error);
      return {
        progress: 0,
        currentReference: 0,
        stats: { verified: 0, issues: 0, pending: 0, totalReferences: 0 },
        references: []
      };
    }
  })

  const processingRef = useRef(false);


  const processNextReference = useCallback(async () => {
    if (completedRef.current || processingRef.current) return;

    processingRef.current = true;
    try {
      const pendingRefs = state.references.filter((ref) => ref.status === 'pending');

      if (pendingRefs.length === 0) {
        completedRef.current = true;
        onComplete({
          stats: {
            verified: state.references.filter((ref) => ref.status === 'verified').length,
            issues: state.references.filter((ref) => ref.status === 'unverified' || ref.status === 'error').length,
            pending: 0,
            totalReferences: state.stats.totalReferences,
          },
          references: state.references,
        });
        return;
      }

      const nextRef = pendingRefs[0];
      const verifiedRef = await verifyReferenceAndUpdateStatus(nextRef);

      setState((prevState) => {
        const newReferences = prevState.references.map((ref) =>
          ref.id === verifiedRef.id ? verifiedRef : ref
        );

        const verified = newReferences.filter((ref) => ref.status === 'verified').length;
        const issues = newReferences.filter((ref) => ref.status === 'unverified' || ref.status === 'error').length;
        const pending = newReferences.filter((ref) => ref.status === 'pending').length;

        const processed = verified + issues;
        const progress = (processed / prevState.stats.totalReferences) * 100;
        const currentReference = Math.min(processed + 1, prevState.stats.totalReferences);

        return {
          progress,
          currentReference,
          stats: {
            verified,
            issues,
            pending,
            totalReferences: prevState.stats.totalReferences,
          },
          references: newReferences,
        };
      });
    } catch (error) {
      console.error('Error processing reference:', error);
    } finally {
      processingRef.current = false;
    }
  }, [state.references, onComplete]);

  return {
    state,
    processNextReference,
    completedRef
  };
}
