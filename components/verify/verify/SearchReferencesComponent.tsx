'use client';

import React, { useEffect, useState } from 'react';
import type { Reference } from '@/types/reference';
import { Search, BookOpen, CheckCircle2, XCircle } from 'lucide-react';
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

  // Loading messages to cycle through
  const loadingMessages = [
    "Searching google for the references...",
    "and searching.....",
    "still searching....",
  ];

  const [messageIndex, setMessageIndex] = useState(0);

  // Cycle through loading messages
  useEffect(() => {
    if (isProcessing) {
      const interval = setInterval(() => {
        setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isProcessing]);

  useEffect(() => {
    const startProcess = async () => {
      if (isProcessing || data.content.length === 0) return;
      setIsProcessing(true);

      try {
        await processBatch(data.content, 0, (searchedRefs) => {
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

  const recentResults = processedRefs.slice(-3);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Main search visualization */}
      <div className="bg-slate-900 rounded-lg p-8 shadow-xl">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Reference Investigation</h2>
          <p className="text-slate-400">
            Searching through {data.content.length} academic citations
          </p>
        </div>

        {/* Animated search progress */}
        <div className="relative h-2 bg-slate-700 rounded-full mb-8">
          <div
            className="absolute h-full bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Animated loading message */}
        <div className="flex items-center justify-center space-x-3 mb-8">
          <Search className="w-5 h-5 text-indigo-400 animate-pulse" />
          <span className="text-slate-300 animate-pulse">
            {loadingMessages[messageIndex]}
          </span>
        </div>

        {/* Recent results preview */}
        <div className="space-y-4">
          {recentResults.map((ref, index) => (
            <div
              key={`${ref.title}-${index}`}
              className="bg-slate-800 rounded-lg p-4 animate-fadeIn flex items-center"
              style={{ animationDelay: `${index * 200}ms` }}
            >
              <BookOpen className="w-5 h-5 text-slate-400 mr-3 flex-shrink-0" />
              <div className="flex-grow min-w-0">
                <p className="text-slate-200 truncate">{ref.title}</p>
                <p className="text-slate-400 text-sm truncate">
                  {ref.authors.join(', ')}
                </p>
              </div>
              {ref.status === 'verified' ? (
                <CheckCircle2 className="w-5 h-5 text-green-400 ml-3 flex-shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400 ml-3 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>

        {/* Progress stats */}
        <div className="mt-8 flex justify-between text-slate-400 text-sm">
          <span>Processed: {processedRefs.length} of {data.content.length}</span>
          <span>{progress.toFixed(1)}% Complete</span>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}