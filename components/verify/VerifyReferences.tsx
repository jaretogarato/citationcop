'use client';

import React, { useEffect, useState } from 'react';

import type { Reference } from '@/types/reference';
import { ProgressHeader } from './ProgressHeader';
import { useReferenceVerification } from '@/hooks/useReferenceVerification';
import { ProgressBar } from './ProgressBar';
import { StatusIndicators } from './StatusIndicator';

interface VerifyReferencesProps {
  data: {
    type: 'file' | 'text';
    content: Reference[];
  };
  onComplete: (data: {
    stats: VerificationResults;
    references: Reference[];
  }) => void;
}

interface VerificationResults {
  verified: number;
  issues: number;
  pending: number;
  totalReferences: number;
}

export default function VerifyReferences({
  data,
  onComplete
}: VerifyReferencesProps): JSX.Element {

  // Filter out references that are already verified
  const verifiedReferences = data.content.filter(ref => ref.status === 'verified');
  const unverifiedReferences = data.content.filter(ref => ref.status !== 'verified');

  // Track the number of verified references initially
  const initialVerifiedCount = verifiedReferences.length;

  // State to keep track of the current reference being processed
  //const [currentReferenceIndex, setCurrentReferenceIndex] = useState<number>(verifiedReferences.length)

  // Use reference verification only for unverified references
  const { state, processNextReference, completedRef } = useReferenceVerification(
    unverifiedReferences,
    (verificationResults) => {
      //console.log('**** Verification results callback **** ', verificationResults);

      // Merge back verified references and adjust stats accordingly
      const allReferences = [
        ...verifiedReferences,
        ...verificationResults.references,
      ];
      onComplete({
        stats: {
          ...verificationResults.stats,
          verified: verificationResults.stats.verified + initialVerifiedCount,
          totalReferences: data.content.length,
        },
        references: allReferences,
      });
    }
  );

  useEffect(() => {
    // Calculate total progress based on verified count and current state progress
    const totalVerified = state.stats.verified + initialVerifiedCount;
    const totalReferences = data.content.length;
    const progress = (totalVerified / totalReferences) * 100;

    if (progress >= 100 && !completedRef.current) {
      onComplete({
        stats: {
          ...state.stats,
          verified: totalVerified,
          totalReferences: totalReferences,
        },
        references: [...verifiedReferences, ...state.references],
      });
      completedRef.current = true; // Mark completion
    } else if (progress < 100) {
      // Update the local state to keep track of the current reference index
      //setCurrentReferenceIndex((prevIndex) => prevIndex + 1);
      processNextReference();
    }

    return () => {
      // Cleanup: Don't reset `completedRef.current` here to avoid restart
    };
  }, [
    state.progress,
    state.stats.verified,
    processNextReference,
    onComplete,
    verifiedReferences,
    state.references,
    initialVerifiedCount,
    data.content.length,
    completedRef
  ]);

  return (
    <div className="p-16">
      <div className="space-y-12">
        <ProgressHeader
          currentReference={state.stats.verified + initialVerifiedCount + 1}
          totalReferences={data.content.length}
        />

        <ProgressBar onProgress={(state.stats.verified + initialVerifiedCount) / data.content.length * 100} />

        <StatusIndicators stats={{ ...state.stats, verified: state.stats.verified + initialVerifiedCount }} />

        {(state.stats.verified + initialVerifiedCount) < data.content.length && (
          <div className="max-w-xl mx-auto">
            <div className="text-center text-sm text-indigo-300/80 animate-pulse">
              Processing {data.type === 'file' ? 'document' : 'text'} content...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
