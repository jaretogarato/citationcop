import React, { useEffect, useState } from 'react';
import type { Reference } from '@/types/reference';
import { ProgressBar } from './ProgressBar';
import { ProgressHeader } from './ProgressHeader';
import { StatusIndicators } from './StatusIndicator';
import { useBatchProcessingVerify } from '@/hooks/useBatchProcessingVerify';

interface VerifyReferencesProps {
  references: Reference[];
  onComplete: (data: { 
    stats: { 
      verified: number;
      issues: number;
      pending: number;
      totalReferences: number;
    };
    references: Reference[];
  }) => void;
}

export default function VerifyReferencesComponent({
  references,
  onComplete
}: VerifyReferencesProps): JSX.Element {
  const { processBatch, progress, processedRefs } = useBatchProcessingVerify();
  const [isProcessing, setIsProcessing] = useState(false);

  // Effect to check if verification is complete
  useEffect(() => {
    if (processedRefs.length === references.length && processedRefs.length > 0) {
      const stats = {
        verified: processedRefs.filter(ref => ref.status === 'verified').length,
        issues: processedRefs.filter(ref => ref.status === 'error').length,
        pending: 0,
        totalReferences: references.length
      };
      onComplete({ stats, references: processedRefs });
    }
  }, [processedRefs, references.length, onComplete]);

  useEffect(() => {
    const startProcess = async () => {
      if (isProcessing || references.length === 0) return;
      setIsProcessing(true);

      try {
        await processBatch(references, 0, () => {
          // Processing is handled by the other useEffect
          setIsProcessing(false);
        });
      } catch (error) {
        console.error('Error in verification process:', error);
        setIsProcessing(false);
      }
    };

    startProcess();
  }, [references, processBatch]);

  const stats = {
    verified: processedRefs.filter(ref => ref.status === 'verified').length,
    issues: processedRefs.filter(ref => ref.status === 'error').length,
    pending: references.length - processedRefs.length
  };

  return (
    <div className="p-16">
      <div className="space-y-12">
        <ProgressHeader
          currentReference={processedRefs.length}
          totalReferences={references.length}
        />

        <ProgressBar onProgress={progress} />

        <StatusIndicators stats={stats} />

        <div className="max-w-xl mx-auto">
          <div className="text-center text-sm text-indigo-300/80 animate-pulse">
            Verifying references: {processedRefs.length} of {references.length}
          </div>
        </div>

        <div className="text-xs text-gray-500">
          <div>Total References: {references.length}</div>
          <div>Verified: {stats.verified}</div>
          <div>Issues: {stats.issues}</div>
          <div>Progress: {progress.toFixed(1)}%</div>
          <div>Processing: {isProcessing ? 'Yes' : 'No'}</div>
        </div>
      </div>
    </div>
  );
}