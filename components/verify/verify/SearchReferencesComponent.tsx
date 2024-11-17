import React, { useEffect, useState } from 'react';
import type { Reference } from '@/types/reference';
import { ProgressBar } from './ProgressBar';
import { ProgressHeader } from './ProgressHeader';
import { StatusIndicators } from './StatusIndicator';
import { useBatchProcessingSearch } from '@/hooks/useBatchProcessingSearch';

interface SearchReferencesProps {
  data: {
    content: Reference[];
  };
  onComplete: (references: Reference[]) => void;
}

export default function SearchReferencesComponent({
  data,
  onComplete
}: SearchReferencesProps): JSX.Element {
  const { processBatch, progress, processedRefs } = useBatchProcessingSearch();
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const startProcess = async () => {
      if (isProcessing || data.content.length === 0) return;
      setIsProcessing(true);

      try {
        await processBatch(data.content, 0, (searchedRefs) => {
          console.log('Search phase complete with refs:', searchedRefs.length);
          onComplete(searchedRefs);
        });
      } catch (error) {
        console.error('Error in search process:', error);
      } finally {
        setIsProcessing(false);
      }
    };

    startProcess();
  }, [data.content, processBatch, onComplete]);

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
            Looking up references: {processedRefs.length} of {data.content.length}
          </div>
        </div>

        <div className="text-xs text-gray-500">
          <div>Total References: {data.content.length}</div>
          <div>Searched: {processedRefs.length}</div>
          <div>Progress: {progress.toFixed(1)}%</div>
          <div>Processing: {isProcessing ? 'Yes' : 'No'}</div>
        </div>
      </div>
    </div>
  );
}