'use client';

import React, { useEffect, useState, useCallback } from 'react';
import type { Reference } from '@/types/reference';
import { ProgressBar } from './ProgressBar';
import { ProgressHeader } from './ProgressHeader';
import { StatusIndicators } from './StatusIndicator';
import { useBatchProcessingSearch } from '@/hooks/useBatchProcessingSearch';
import { useBatchProcessingVerify } from '@/hooks/useBatchProcessingVerify';

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
  const { processBatch: processSearchBatch, progress: searchProgress, processedRefs: searchedRefs } = useBatchProcessingSearch();
  const { processBatch: processVerifyBatch, progress: verifyProgress, processedRefs: verifiedRefs } = useBatchProcessingVerify();
  const [phase, setPhase] = useState<'searching' | 'verifying'>('searching');
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchResults, setSearchResults] = useState<Reference[]>([]);

  // Handle completion of search phase and start verification
  const handleSearchComplete = useCallback((refs: Reference[]) => {
    console.log('Search phase complete with refs:', refs.length);
    setSearchResults(refs);
    setPhase('verifying');
    
    // Start verification phase with the completed search results
    processVerifyBatch(refs, 0, (verifiedRefs) => {
      console.log('Verification phase complete with refs:', verifiedRefs.length);
      onComplete(verifiedRefs);
    });
  }, [processVerifyBatch, onComplete]);

  // Start the initial search phase
  useEffect(() => {
    const startProcess = async () => {
      if (isProcessing || data.content.length === 0) return;
      setIsProcessing(true);

      try {
        await processSearchBatch(data.content, 0, handleSearchComplete);
      } catch (error) {
        console.error('Error in search process:', error);
        setIsProcessing(false);
      }
    };

    startProcess();
  }, [data.content, processSearchBatch, handleSearchComplete]);

  // Calculate stats and progress based on current phase
  const currentProgress = phase === 'searching' ? searchProgress : verifyProgress;
  const currentRefs = phase === 'searching' ? searchedRefs : verifiedRefs;
  
  const stats = {
    verified: currentRefs.filter(ref => ref.status === 'verified').length,
    issues: currentRefs.filter(ref => ref.status === 'error').length,
    pending: data.content.length - currentRefs.length
  };

  return (
    <div className="p-16">
      <div className="space-y-12">
        <ProgressHeader
          currentReference={currentRefs.length}
          totalReferences={data.content.length}
        />

        <ProgressBar onProgress={currentProgress} />

        <StatusIndicators stats={stats} />

        <div className="max-w-xl mx-auto">
          <div className="text-center text-sm text-indigo-300/80 animate-pulse">
            {phase === 'searching'
              ? `Looking up references: ${searchedRefs.length} of ${data.content.length}`
              : `Verifying references: ${verifiedRefs.length} of ${searchResults.length}`
            }
          </div>
        </div>

        {/* Debug information */}
        <div className="text-xs text-gray-500">
          <div>Phase: {phase}</div>
          <div>Total References: {data.content.length}</div>
          <div>Searched: {searchedRefs.length}</div>
          <div>Search Results: {searchResults.length}</div>
          <div>Verified: {verifiedRefs.length}</div>
          <div>Progress: {currentProgress.toFixed(1)}%</div>
          <div>Processing: {isProcessing ? 'Yes' : 'No'}</div>
        </div>
      </div>
    </div>
  );
}