'use client'

import React, { useEffect, useState } from 'react';
import type { Reference } from '@/types/reference';
import { ProgressBar } from './ProgressBar';
import { ProgressHeader } from './ProgressHeader';
import { StatusIndicators } from './StatusIndicator';
import { useBatchProcessingSearch } from '@/hooks/useBatchProcessingSearch';

interface VerifyReferencesProps {
  data: {
    content: Reference[];
  };
  onComplete: (references: Reference[]) => void;
}

export default function VerifyReferencesComponent({
  data,
  onComplete
}: VerifyReferencesProps): JSX.Element {
  const { processBatch, progress, processedRefs } = useBatchProcessingSearch();
  const [phase, setPhase] = useState<'searching' | 'verifying'>('searching');

  useEffect(() => {
    processBatch(data.content, 0, (refs) => {
      // Add a 2-second pause before moving to verification
      setTimeout(() => {
        setPhase('verifying');
        onComplete(refs);
      }, 20000);
    });
  }, [data.content]);

  // Calculate stats
  const stats = {
    verified: processedRefs.filter(ref => ref.status === 'verified').length,
    issues: processedRefs.filter(ref => ref.status === 'error').length,
    pending: data.content.length - processedRefs.length
  };

  return (
    <div className="p-16">
      <div className="space-y-12">
        <ProgressHeader
          currentReference={processedRefs.length}
          totalReferences={data.content.length}
        />
        
        <ProgressBar onProgress={progress} />
        
        <StatusIndicators stats={stats} />

        <div className="max-w-xl mx-auto">
          <div className="text-center text-sm text-indigo-300/80 animate-pulse">
            {phase === 'searching' 
              ? `Looking up references: ${processedRefs.length} of ${data.content.length}`
              : 'Verifying references...'
            }
          </div>
        </div>
      </div>
    </div>
  );
}