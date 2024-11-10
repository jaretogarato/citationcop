import React, { useEffect } from 'react';
import Card from "@/components/ui/Card";
import CardContent from "@/components/ui/Card";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import type { Reference, ReferenceStatus, StatusColorMap, StatusTextMap } from '@/types/reference';

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

  const getStatusColor = (status: ReferenceStatus): string => {
    const colorMap: StatusColorMap = {
      verified: "from-emerald-900 to-emerald-800",
      unverified: "from-rose-900 to-rose-800",
      error: "from-amber-900 to-amber-800",
      pending: "from-blue-900 to-blue-800"
    };

    return colorMap[status] || "from-gray-900 to-gray-800";
  };

  const getStatusIcon = (status: ReferenceStatus): JSX.Element | null => {
    const iconMap: { [K in ReferenceStatus]: JSX.Element } = {
      verified: <CheckCircle className="h-6 w-6 text-emerald-400" />,
      error: <AlertTriangle className="h-6 w-6 text-amber-400" />,
      pending: <AlertTriangle className="h-6 w-6 text-blue-400" />,
      unverified: <XCircle className="h-6 w-6 text-rose-400" />
    };

    return iconMap[status] || null;
  };

  const getStatusText = (status: ReferenceStatus): string => {
    const textMap: StatusTextMap = {
      verified: "Verified",
      error: "Needs Review",
      pending: "Pending",
      unverified: "Could not be verified"
    };

    return textMap[status] || status;
  };

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

  return (
    <div className="p-8">
      {/* Results Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-pink-400 inline-block text-transparent bg-clip-text">
          Reference Analysis Results
        </h2>
        <div className="text-indigo-300 mt-2 space-y-1">
          <p>Found {data.length} references</p>
          <p className="text-sm">
            {summary.verified} verified · {summary.invalid} invalid · {summary.warning} need review
          </p>
        </div>
      </div>

      {/* Reference Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.map((reference: Reference) => (
          <Card
            key={reference.id}
            title={reference.title}

          >
            <div className={`bg-gradient-to-br ${getStatusColor(reference.status)} border-none rounded-[1.5rem] overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-200 hover:scale-[1.02] transform group`}>
              <CardContent title={reference.title}>
                <div className="space-y-4">
                  {/* Status Header */}
                  <div className="flex items-center gap-2 bg-black/20 rounded-xl p-3 group-hover:bg-black/30 transition-colors">
                    {getStatusIcon(reference.status)}
                    <span className="text-lg font-semibold text-white">
                      {getStatusText(reference.status)}
                    </span>
                  </div>

                  {/* Reference Details */}
                  <div className="space-y-3 bg-black/20 rounded-xl p-4 group-hover:bg-black/30 transition-colors">
                    <div>
                      <h3 className="text-sm font-medium text-indigo-300">Title</h3>
                      <p className="text-white font-medium leading-tight">{reference.title}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-indigo-300">Authors</h3>
                      <p className="text-white text-sm">
                        {Array.isArray(reference.authors) && reference.authors.length > 0
                          ? reference.authors.length > 2
                            ? (
                              <>
                                {reference.authors.slice(0, 2).map((name, index) => (
                                  <span key={index}>
                                    {name}
                                    {index < 1 ? ', ' : ''}
                                  </span>
                                ))}
                                <span>... et al.</span>
                              </>
                            )
                            : reference.authors.map((name, index) => (
                              <span key={index}>
                                {name}
                                {index < reference.authors.length - 1 ? ', ' : ''}
                              </span>
                            ))
                          : 'No authors listed'}
                      </p>

                    </div>
                    <div className="flex justify-between items-start text-sm">
                      <div>
                        <h3 className="text-sm font-medium text-indigo-300">Year</h3>
                        <p className="text-white">{reference.year}</p>
                      </div>
                      <div className="text-right">
                        <h3 className="text-sm font-medium text-indigo-300">Journal</h3>
                        <p className="text-white">{reference.journal}</p>
                      </div>
                    </div>
                  </div>

                  {/* Verification Notes */}
                  <div className="bg-black/20 rounded-xl p-4 group-hover:bg-black/30 transition-colors">
                    <h3 className="text-sm font-medium text-indigo-300 mb-1">Verification Notes</h3>
                    <p className="text-white text-sm leading-relaxed group-hover:line-clamp-none line-clamp-4">
                      {reference.message}
                    </p>
                  </div>
                </div>
              </CardContent>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}