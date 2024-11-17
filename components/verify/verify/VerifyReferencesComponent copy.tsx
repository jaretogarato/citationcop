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
  const [stage, setStage] = useState<'google' | 'openai' | 'complete'>('google');
  const [processedRefs, setProcessedRefs] = useState<Reference[]>([]);
  const completedRef = React.useRef(false);

  // Separate verified and unverified references
  const verifiedRefs = data.content.filter(ref => ref.status === 'verified');
  const unverifiedRefs = data.content.filter(ref => ref.status !== 'verified');
  const initialVerifiedCount = verifiedRefs.length;

  // Calculate current stats based on processed references
  const currentStats = React.useMemo(() => {
    const verified = processedRefs.filter(ref => ref.status === 'verified').length;
    const issues = processedRefs.filter(ref => 
      ref.status === 'unverified' || ref.status === 'error'
    ).length;
    
    return {
      verified: verified + initialVerifiedCount,
      issues,
      pending: data.content.length - (verified + issues + initialVerifiedCount),
      totalReferences: data.content.length
    };
  }, [processedRefs, data.content.length, initialVerifiedCount]);

  // Handle progress updates from verification process
  const handleProgress = (verificationStage: 'google' | 'openai', count: number, updatedRefs: Reference[]) => {
    console.log(`Progress update: ${verificationStage} - ${count}/${unverifiedRefs.length}`);
    setStage(verificationStage);
    // Update processed refs in real-time
    if (verificationStage === 'openai') {
      setProcessedRefs(updatedRefs);
    }
  };

  const { state, processNextReferences } = useReferenceVerification(
    unverifiedRefs,
    (verificationResults) => {
      const allReferences = [...verifiedRefs, ...verificationResults.references];
      setProcessedRefs(verificationResults.references);
      setStage('complete');
      onComplete({
        stats: {
          ...verificationResults.stats,
          verified: verificationResults.stats.verified + initialVerifiedCount,
          totalReferences: data.content.length,
        },
        references: allReferences,
      });
    },
    handleProgress
  );

  useEffect(() => {
    if (state.stats.pending > 0 && !completedRef.current) {
      processNextReferences();
    }
  }, [state.stats.pending, processNextReferences]);

  // Calculate progress based only on verified references
  const progress = React.useMemo(() => {
    if (stage === 'complete') return 100;
    
    // Calculate progress based on verified references
    const totalToVerify = unverifiedRefs.length;
    const verifiedCount = currentStats.verified - initialVerifiedCount; // Only count newly verified
    return Math.min(100, (verifiedCount / totalToVerify) * 100);
  }, [stage, currentStats.verified, unverifiedRefs.length, initialVerifiedCount]);

  // Calculate current reference number
  const currentReference = Math.min(
    currentStats.verified + currentStats.issues + 1,
    currentStats.totalReferences
  );

  // Message to display based on stage
  const stageMessage = React.useMemo(() => {
    switch (stage) {
      case 'google':
        return 'Looking up references...';
      case 'openai':
        return 'Verifying references...';
      default:
        return '';
    }
  }, [stage]);

  return (
    <div className="p-16">
      <div className="space-y-12">
        <ProgressHeader
          currentReference={currentReference}
          totalReferences={currentStats.totalReferences}
        />

        <ProgressBar onProgress={progress} />

        <StatusIndicators stats={currentStats} />

        {progress < 100 && (
          <div className="max-w-xl mx-auto">
            <div className="text-center text-sm text-indigo-300/80 animate-pulse">
              {stageMessage}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}