'use client'

import React, { useEffect, useState } from 'react';
import type { Reference, VerificationResults } from '@/types/reference';
import { ProgressHeader } from './ProgressHeader';
import { ProgressBar } from './ProgressBar';
import { StatusIndicators } from './StatusIndicator';
import { useReferenceVerification } from '@/hooks/useReferenceVerification';

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

export default function VerifyReferencesComponent({
  data,
  onComplete
}: VerifyReferencesProps): JSX.Element {
  // Track both Google and OpenAI progress separately
  const [googleProgress, setGoogleProgress] = useState(0);
  const [openaiProgress, setOpenaiProgress] = useState(0);
  const [stage, setStage] = useState<'google' | 'openai' | 'complete'>('google');
  const completedRef = React.useRef(false);

  // Separate verified and unverified references
  const verifiedRefs = data.content.filter(ref => ref.status === 'verified');
  const unverifiedRefs = data.content.filter(ref => ref.status !== 'verified');
  const initialVerifiedCount = verifiedRefs.length;

  const { state, processNextReferences } = useReferenceVerification(
    unverifiedRefs,
    (verificationResults) => {
      const allReferences = [...verifiedRefs, ...verificationResults.references];
      setStage('complete');
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

  // Handle progress updates from verification process
  const handleProgress = (verificationStage: 'google' | 'openai', count: number) => {
    const progress = (count / unverifiedRefs.length) * 100;
    if (verificationStage === 'google') {
      setGoogleProgress(progress);
    } else {
      setOpenaiProgress(progress);
    }
    setStage(verificationStage);
  };

  useEffect(() => {
    if (state.stats.pending > 0 && !completedRef.current) {
      processNextReferences();
    }
  }, [state.stats.pending, processNextReferences]);

  // Calculate total progress considering both stages
  const totalProgress = (() => {
    if (stage === 'complete') return 100;
    
    // Google search is 50% of progress, OpenAI verification is other 50%
    const googleWeight = 0.5;
    const openaiWeight = 0.5;
    
    return (googleProgress * googleWeight) + (openaiProgress * openaiWeight);
  })();

  return (
    <div className="p-16">
      <div className="space-y-12">
        <ProgressHeader
          currentReference={state.stats.verified + initialVerifiedCount + 1}
          totalReferences={data.content.length}
        />

        <ProgressBar onProgress={totalProgress} />

        <StatusIndicators
          stats={{
            ...state.stats,
            verified: state.stats.verified + initialVerifiedCount
          }}
        />

        {totalProgress < 100 && (
          <div className="max-w-xl mx-auto">
            <div className="text-center text-sm text-indigo-300/80 animate-pulse">
              {stage === 'google' 
                ? 'Searching for references...' 
                : 'Verifying reference details...'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}