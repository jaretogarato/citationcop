import React from 'react'
import { Reference } from '@/app/types/reference'
import { Dialog, DialogTrigger } from '@/app/components/ui/dialog'
import { ReferenceDialog } from '../verify/display/ReferenceDialog'

import { renderMessageWithLinks } from '@/app/utils/ui/ui-utils'
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info
} from 'lucide-react'

const statusStyles = {
  verified: {
    gradient: 'from-emerald-900/50 to-emerald-800/50',
    accent: 'bg-emerald-400/10',
    text: 'text-emerald-300',
    icon: <CheckCircle className="h-6 w-6 text-emerald-400" />
  },
  error: {
    gradient: 'from-amber-900/50 to-amber-800/50',
    accent: 'bg-amber-400/10',
    text: 'text-amber-300',
    icon: <AlertTriangle className="h-6 w-6 text-amber-400" />
  },
  unverified: {
    gradient: 'from-rose-900/50 to-rose-800/50',
    accent: 'bg-rose-400/10',
    text: 'text-rose-300',
    icon: <XCircle className="h-6 w-6 text-rose-400" />
  },
  pending: {
    gradient: 'from-indigo-900/50 to-indigo-800/50',
    accent: 'bg-indigo-400/10',
    text: 'text-indigo-300',
    icon: <AlertTriangle className="h-6 w-6 text-indigo-400" />
  }
}

const formatAuthors = (authors: string[] = []) => {
  if (authors.length === 0) return ''
  if (authors.length <= 2) return authors.join(', ')
  return `${authors[0]}, ${authors[1]} et al.`
}

const GridReferenceDialog = ({ reference }: { reference: Reference }) => {
  const status = statusStyles[reference.status]
  
  return (

    <Dialog>
      <DialogTrigger asChild>
    <div className={`w-full bg-gradient-to-br ${status.gradient} rounded-[1.5rem] overflow-hidden shadow-xl`}>
      <div className="p-6 space-y-4">
        {/* Status Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 bg-black/20 rounded-xl p-3 flex-1">
            {status.icon}
            <span className="text-lg font-semibold text-white">
              {reference.status === 'error' ? 'Needs Human Review' : reference.status}
            </span>
          </div>
          {reference.sourceDocument && (
            <div className={`p-2 rounded-xl ${status.accent}`}>
              <Info className={`h-5 w-5 ${status.text}`} />
            </div>
          )}
        </div>

        {/* Reference Details */}
        <div className={`space-y-3 ${status.accent} rounded-xl p-4`}>
          <div>
            <h3 className={`text-sm font-medium ${status.text}`}>Title</h3>
            <p className="text-white font-medium leading-tight">
              {reference.title}
            </p>
          </div>
          <div>
            <h3 className={`text-sm font-medium ${status.text}`}>Authors</h3>
            <p className="text-white font-medium leading-tight">
              {formatAuthors(reference.authors)}
            </p>
          </div>
          {reference.sourceDocument && (
            <div>
              <h3 className={`text-sm font-medium ${status.text}`}>Source Document</h3>
              <p className="text-white font-medium leading-tight">
                {reference.sourceDocument}
              </p>
            </div>
          )}
        </div>

        {/* Verification Message */}
        {reference.message && (
          <div className={`${status.accent} rounded-xl p-4`}>
            <h3 className={`text-sm font-medium ${status.text} mb-1`}>
              Verification Notes
            </h3>
            <div className="max-h-24 overflow-y-auto">
              <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                {renderMessageWithLinks(reference.message)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
    </DialogTrigger>

      <ReferenceDialog reference={reference} />
    </Dialog>
  )
}
export default GridReferenceDialog