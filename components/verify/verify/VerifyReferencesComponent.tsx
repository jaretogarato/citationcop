// components/VerifyReferencesComponent.tsx
'use client'

import React, { useEffect } from 'react';
import type { Reference } from '@/types/reference';
import { ProgressBar } from './ProgressBar';
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

  useEffect(() => {
    processBatch(data.content, 0, onComplete);
  }, [data.content]);

  return (
    <div className="p-16">
      <ProgressBar onProgress={progress} />
    </div>
  );
}