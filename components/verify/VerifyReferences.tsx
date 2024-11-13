'use client';

import React, { useEffect } from 'react';

import type { Reference } from '@/types/reference';
import { ProgressHeader } from './ProgressHeader';
import { useReferenceVerification } from '@/hooks/useReferenceVerification';
import { ProgressBar } from './ProgressBar';
import { StatusIndicators } from './StatusIndicator';

interface VerifyReferencesProps {
  data: {
    type: 'file' | 'text';
    content: Reference[];  // Changed from string to Reference[]
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
  const { state, processNextReference, completedRef } =
    useReferenceVerification(data.content, onComplete)


  useEffect(() => {
    console.log('Progress:', state.progress);

    if (state.progress >= 100 && !completedRef.current) {
      console.log('Calling onComplete from useEffect');
      onComplete({
        stats: state.stats,
        references: state.references
      });
    } else if (state.progress < 100) {
      processNextReference();
    }

    return () => {
      completedRef.current = false;
    };
  }, [
    state.progress,
    state.stats,
    state.references,
    processNextReference,
    completedRef,
    onComplete
  ]);

  return (
    <div className="p-16">
      <div className="space-y-12">
        <ProgressHeader
          currentReference={state.currentReference}
          totalReferences={state.stats.totalReferences}
        />

        <ProgressBar onProgress={state.progress} />
        <StatusIndicators stats={state.stats} />

        {state.progress < 100 && (
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
