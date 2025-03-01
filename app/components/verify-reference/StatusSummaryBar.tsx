import React from 'react'
import { CheckCircle, XCircle } from 'lucide-react'

interface StatusSummaryBarProps {
  status: 'extracting' | 'processing' | 'complete' | 'error'
  counts: {
    total: number
    verified: number
    unverified: number
    needsHuman: number
    error: number
    pending: number
  }
}

export const StatusSummaryBar: React.FC<StatusSummaryBarProps> = ({
  status,
  counts
}) => {
  return (
    <div className="flex items-center justify-between bg-gray-800 rounded-lg p-3 shadow">
      <div className="flex items-center space-x-2">
        {status === 'extracting' || status === 'processing' ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500"></div>
        ) : status === 'complete' ? (
          <CheckCircle className="h-5 w-5 text-green-500" />
        ) : (
          <XCircle className="h-5 w-5 text-red-500" />
        )}
        <span className="text-gray-200 font-medium">
          {status === 'extracting'
            ? 'Extracting references...'
            : status === 'processing'
            ? 'Verifying references...'
            : status === 'complete'
            ? 'All references processed'
            : 'Error processing references'}
        </span>
      </div>
      <div className="flex items-center space-x-4">
        <div className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">
          Total: {counts.total}
        </div>
        <div className="text-xs px-2 py-1 rounded bg-emerald-900/60 text-emerald-200">
          Verified: {counts.verified}
        </div>
        <div className="text-xs px-2 py-1 rounded bg-amber-900/60 text-amber-200">
          Needs Human: {counts.needsHuman}
        </div>
        <div className="text-xs px-2 py-1 rounded bg-rose-900/60 text-rose-200">
          Unverified: {counts.unverified}
        </div>
        {counts.pending > 0 && (
          <div className="text-xs px-2 py-1 rounded bg-blue-900/60 text-blue-200">
            Pending: {counts.pending}
          </div>
        )}
      </div>
    </div>
  )
}

export default StatusSummaryBar