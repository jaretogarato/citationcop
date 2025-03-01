// app/components/verification/VerificationStatusComponents.tsx
import React from 'react'
import { 
  FileText, 
  Search, 
  Link, 
  CheckCircle,
  AlertCircle,
  XCircle,
  Clock
} from 'lucide-react'
import { Alert, AlertTitle } from '@/app/components/ui/alert'
import { Badge } from '@/app/components/ui/badge'
import { ProcessingStep, getBadgeColor } from '@/app/lib/verification-service'

export type UIStatus =
  | 'idle'
  | 'loading'
  | 'verified'
  | 'requires-verification'
  | 'unverified'
  | 'error'

interface ProcessingStepDisplayProps {
  processingStep: ProcessingStep
  currentToolArgs: any
}

export const ProcessingStepDisplay: React.FC<ProcessingStepDisplayProps> = ({
  processingStep,
  currentToolArgs
}) => {
  switch (processingStep) {
    case 'initializing':
      return (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-400" />
          <span>analyzing reference structure</span>
        </div>
      )
    case 'search_reference':
      return (
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-purple-400" />
          <span>
            searching:{' '}
            {currentToolArgs?.reference
              ? `"${currentToolArgs.reference.substring(0, 30)}${currentToolArgs.reference.length > 30 ? '...' : ''}"`
              : 'reference'}
          </span>
        </div>
      )
    case 'check_doi':
      return (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-teal-400" />
          <span>
            checking DOI:{' '}
            {currentToolArgs?.doi ? currentToolArgs.doi : 'identifier'}
          </span>
        </div>
      )
    case 'check_url':
      return (
        <div className="flex items-center gap-2">
          <Link className="h-4 w-4 text-indigo-400" />
          <span>
            verifying URL:{' '}
            {currentToolArgs?.url
              ? currentToolArgs.url.substring(0, 30) +
                (currentToolArgs.url.length > 30 ? '...' : '')
              : 'link'}
          </span>
        </div>
      )
    case 'finalizing':
      return (
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-400" />
          <span>finalizing verification</span>
        </div>
      )
    default:
      return <span>processing...</span>
  }
}

interface VerificationAlertProps {
  status: UIStatus
}

export const VerificationAlert: React.FC<VerificationAlertProps> = ({ 
  status
}) => {
  return (
    <Alert
      variant={
        status === 'verified'
          ? 'default'
          : status === 'requires-verification'
            ? 'default'
            : 'destructive'
      }
      className={`p-2.5 border ${
        status === 'verified'
          ? 'border-green-700 bg-green-900/30 text-green-200'
          : status === 'requires-verification'
            ? 'border-yellow-700 bg-yellow-900/30 text-yellow-200'
            : 'border-red-700 bg-red-900/30 text-red-200'
      }`}
    >
      <div className="flex items-center gap-2">
        {status === 'verified' && (
          <CheckCircle className="h-5 w-5 text-green-400" />
        )}
        {status === 'requires-verification' && (
          <Clock className="h-5 w-5 text-yellow-400" />
        )}
        {(status === 'unverified' || status === 'error') && (
          <AlertCircle className="h-5 w-5 text-red-400" />
        )}

        <AlertTitle className="text-sm">
          {status === 'verified' && 'Reference Verified'}
          {status === 'requires-verification' &&
            'Requires Human Verification'}
          {status === 'unverified' && 'Reference Unverified'}
          {status === 'error' && 'Error Processing Reference'}
        </AlertTitle>
      </div>
    </Alert>
  )
}

interface ReferenceResultProps {
  formattedReference: string
  explanation: string
  wasModified: boolean
  checksPerformed: string[]
}

export const ReferenceResult: React.FC<ReferenceResultProps> = ({
  formattedReference,
  explanation,
  wasModified,
  checksPerformed
}) => {
  return (
    <div className="space-y-2">
      <div className="rounded-md border border-gray-700 bg-gray-800/30 p-2.5 relative">
        {/* Reformatted badge in upper right corner */}
        {wasModified && (
          <Badge className="absolute top-2 right-2 bg-blue-900 text-blue-200 text-xs border-blue-700">
            reformatted
          </Badge>
        )}
        <p className="text-sm text-left text-gray-200 pr-20">
          {formattedReference}
        </p>
      </div>

      <div className="rounded-md border border-gray-700 bg-gray-800/30 p-2.5">
        <p className="text-sm leading-relaxed text-gray-300 text-left mb-3">
          {explanation}
        </p>

        {/* Display checks performed below the explanation */}
        {checksPerformed && checksPerformed.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {checksPerformed.map((check, index) => (
              <Badge
                key={index}
                variant="outline"
                className={`text-xs ${getBadgeColor(check)}`}
              >
                {check}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

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