import React, { useEffect } from 'react';
import { StatsCards } from '@/components/verify/display/StatsCard'
import { ReferenceCard } from '@/components/verify/display/ReferenceCard'
import type { Reference } from '@/types/reference';

interface DisplayReferencesProps {
  data: Reference[];
  onComplete: () => void;
}

export default function DisplayReferences({ data, onComplete }: DisplayReferencesProps): JSX.Element {
  // Validate data prop
  useEffect(() => {
    if (!Array.isArray(data)) {
      console.error('DisplayReferences: data prop is not an array', data);
    }
  }, [data]);

  const getStatusSummary = () => {
    if (!Array.isArray(data)) return { verified: 0, invalid: 0, warning: 0 };

    return {
      verified: data.filter(ref => ref.status === 'verified').length,
      invalid: data.filter(ref => ref.status === 'unverified').length,
      warning: data.filter(ref => ref.status === 'error').length
    };
  };

  const summary = getStatusSummary();

  // If data is not an array, show error state
  if (!Array.isArray(data)) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-3xl font-bold text-red-400">
          Error: Invalid reference data
        </h2>
      </div>
    );
  }

  const statsData = {
    totalCount: data.length,
    verified: summary.verified,
    invalid: summary.invalid,
    warning: summary.warning
  };

  return (
    <div className="p-8">
      {/* Results Header */}
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-pink-400 inline-block text-transparent bg-clip-text">
          Reference Analysis Results
        </h2>

        <StatsCards data={statsData} />

        {/* Verify More Button */}
        <div className="flex justify-center mt-8">
          <button
            onClick={onComplete}
            className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-pink-500 rounded-full text-white font-medium hover:opacity-90 transition-opacity shadow-lg"
          >
            Verify More Results
          </button>
        </div>
      </div>

      {/* Reference Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-[1400px] mx-auto border-none">
        {data.length === 1 ? (
          <div className="col-span-1 md:col-span-2 lg:col-span-3 flex justify-center">
            <ReferenceCard
              key={data[0].id} // Added key here for single reference case
              reference={data[0]}
            />
          </div>
        ) : (
          data.map((reference: Reference) => (
            <ReferenceCard
              key={reference.id}
              reference={reference}
            />
          ))
        )}
      </div>

    </div>
  );
}