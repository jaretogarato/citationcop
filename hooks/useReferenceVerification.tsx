// hooks/useReferenceVerification.ts
import { useState, useCallback, useRef } from 'react';
import type { Reference, ReferenceStatus, VerificationResults } from '@/types/reference';
import { verifyReferenceAndUpdateStatus } from '@/utils/verify-helpers/reference-utils';

interface VerificationState {
  references: Reference[];
  stats: VerificationResults;
  progress: number;
  currentReference: number;
}

export function useReferenceVerification(
  initialContent: Reference[],
  onComplete: (data: {
    stats: VerificationResults;
    references: Reference[];
  }) => void
) {
  const processingRef = useRef(false);
  const completedRef = useRef(false);

  const [state, setState] = useState<VerificationState>(() => ({
    references: initialContent.map((ref, index) => ({
      ...ref,
      id: ref.id || index + 1,
      status: ref.status || 'pending' as ReferenceStatus
    })),
    stats: {
      verified: 0,
      issues: 0,
      pending: initialContent.length,
      totalReferences: initialContent.length
    },
    progress: 0,
    currentReference: 1
  }));

  const processNextReferences = useCallback(async () => {
    if (processingRef.current || completedRef.current) {
      return;
    }

    processingRef.current = true;

    try {
      const pendingRefs = state.references.filter(ref => ref.status === 'pending');
      
      if (pendingRefs.length === 0) {
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete({
            stats: state.stats,
            references: state.references
          });
        }
        return;
      }

      // Process all pending references - let verifyReferenceAndUpdateStatus handle batching
      const verifiedRefs = await verifyReferenceAndUpdateStatus(
        pendingRefs,
        (stage, count) => {
          // Update progress based on verification stage
          setState(prev => ({
            ...prev,
            progress: stage === 'google' 
              ? (count / pendingRefs.length) * 50  // First 50%
              : 50 + (count / pendingRefs.length) * 50  // Second 50%
          }));
        }
      );

      setState(prevState => {
        const newReferences = prevState.references.map(ref => {
          const updatedRef = verifiedRefs.find(vRef => vRef.id === ref.id);
          return updatedRef || ref;
        });

        const verified = newReferences.filter(ref => ref.status === 'verified').length;
        const issues = newReferences.filter(ref => 
          ref.status === 'unverified' || ref.status === 'error'
        ).length;
        const pending = newReferences.filter(ref => ref.status === 'pending').length;

        const newStats = {
          verified,
          issues,
          pending,
          totalReferences: prevState.stats.totalReferences
        };

        if (pending === 0 && !completedRef.current) {
          completedRef.current = true;
          onComplete({
            stats: newStats,
            references: newReferences
          });
        }

        return {
          references: newReferences,
          stats: newStats,
          progress: ((verified + issues) / prevState.stats.totalReferences) * 100,
          currentReference: Math.min(verified + issues + 1, prevState.stats.totalReferences)
        };
      });

    } catch (error) {
      console.error('Error processing references:', error);
      // Update references that failed with error status
      setState(prevState => {
        const newReferences = prevState.references.map(ref => 
          ref.status === 'pending' ? {
            ...ref,
            status: 'error' as ReferenceStatus,
            message: 'Verification failed unexpectedly'
          } : ref
        );

        return {
          ...prevState,
          references: newReferences,
          stats: {
            ...prevState.stats,
            issues: newReferences.filter(ref => ref.status === 'error').length,
            pending: 0
          }
        };
      });
    } finally {
      processingRef.current = false;
    }
  }, [state.references, onComplete]);

  return { state, processNextReferences };
}