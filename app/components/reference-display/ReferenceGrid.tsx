// Simplified ReferenceGrid component without animations
import React from 'react'
import type { Reference } from '@/app/types/reference'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger
} from '@/app/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/app/components/ui/tooltip'
import { ReferenceDialog } from '@/app/components/reference-display/ReferenceDialog'
import type { ReferenceStatus } from '@/app/types/reference'

const statusColors: Record<ReferenceStatus, string> = {
  verified: 'bg-emerald-400/60',
  unverified: 'bg-rose-400/60',
  'needs-human': 'bg-amber-400/60',
  error: 'bg-slate-400/60',
  pending: 'bg-indigo-400/60'
}

const statusDisplayNames: Record<ReferenceStatus | 'pending', string> = {
  verified: 'Verified',
  'needs-human': 'Needs Human review',
  error: 'Oops! Something went wrong',
  pending: 'Pending',
  unverified: 'Reference does not appear to exist'
}

interface ReferenceGridProps {
  references: Reference[]
}

const ReferenceGrid: React.FC<ReferenceGridProps> = ({ references }) => {
  // Helper function to get color based on status
  const getStatusColor = (
    status: ReferenceStatus | undefined | null
  ): string => {
    if (!status) return 'bg-gray-400/60'
    return statusColors[status] || 'bg-gray-400/60'
  }

  // Helper function to get display name based on status
  const getStatusDisplayName = (
    status: ReferenceStatus | undefined | null
  ): string => {
    if (!status) return statusDisplayNames.pending
    return statusDisplayNames[status] || statusDisplayNames.pending
  }

  // Group references by source document
  const groupedReferences = references.reduce(
    (groups, ref) => {
      const sourceDoc = ref.sourceDocument || 'Unknown Source'
      if (!groups[sourceDoc]) {
        groups[sourceDoc] = []
      }
      groups[sourceDoc].push(ref)
      return groups
    },
    {} as Record<string, Reference[]>
  )

  // Get unique statuses including 'no_status' if there are any undefined/null statuses
  const uniqueStatuses = [
    ...new Set(references.map((ref) => ref.status || 'no_status'))
  ]

  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-200 mb-4">
        Reference Status
      </h3>

      <div className="max-w-4xl rounded-lg border border-slate-700 p-4">
        <div className="flex flex-wrap gap-1 items-center">
          {Object.entries(groupedReferences).map(
            ([sourceDoc, refs], groupIndex) => (
              <React.Fragment key={sourceDoc}>
                {/* Add a vertical separator before each group except the first */}
                {groupIndex > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="h-6 w-px bg-slate-600 mx-2 self-center hover:bg-slate-400 transition-colors cursor-help shrink-0" />
                      </TooltipTrigger>
                      {/*<TooltipContent
                        side="top"
                        className="bg-slate-800 text-slate-100 border-slate-700"
                      >
                        <span className="text-xs">
                          Start of references from:
                        </span>
                        <span className="text-xs font-medium">{sourceDoc}</span>
                      </TooltipContent>*/}
                      <TooltipContent
                        side="top"
                        className="bg-slate-800 text-slate-100 border-slate-700"
                      >
                        <div>
                          <span className="text-xs">
                            Start of references from:
                          </span>
                          <span className="text-xs font-medium">
                            {sourceDoc}
                          </span>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {refs.map((ref, i) => (
                  <Dialog key={`${sourceDoc}-${ref.id}-${i}`}>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DialogTrigger>
                            <div
                              className={`
                                w-4 h-4
                                ${getStatusColor(ref.status)}
                                hover:opacity-75 transition-opacity
                                cursor-pointer
                                rounded-sm
                                shrink-0
                              `}
                            />
                          </DialogTrigger>
                        </TooltipTrigger>
                        {/*<TooltipContent
                          side="top"
                          className="max-w-[300px] text-xs bg-slate-800 text-slate-100 border-slate-700"
                        >
                          <span className="font-semibold">{ref.title}</span>
                          <span className="text-slate-300 mt-1">
                            Source: {sourceDoc}
                          </span>
                        </TooltipContent>*/}
                        <TooltipContent
                          side="top"
                          className="max-w-[300px] text-xs bg-slate-800 text-slate-100 border-slate-700"
                        >
                          <div>
                            <span className="font-semibold">{ref.title}</span>
                            <span className="text-slate-300 mt-1">
                              Source: {sourceDoc}
                            </span>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <DialogContent className="bg-transparent border-none shadow-none max-w-lg">
                      <DialogTitle hidden>Reference {ref.title}</DialogTitle>
                      <DialogDescription hidden>
                        Details of the verification of the reference
                      </DialogDescription>
                      <h2 className="sr-only">Reference {ref.title}</h2>
                      <p className="sr-only">
                        Details of the verification of the reference
                      </p>
                      <div className="mt-4">
                        <ReferenceDialog reference={ref} />
                      </div>
                    </DialogContent>
                  </Dialog>
                ))}
              </React.Fragment>
            )
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-4 items-center justify-end">
        {uniqueStatuses.map((status) => (
          <div key={status} className="flex items-center gap-2">
            <div
              className={`w-4 h-4 ${getStatusColor(status as ReferenceStatus)}`}
            />
            <span className="text-sm text-gray-200 capitalize">
              {getStatusDisplayName(status as ReferenceStatus)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ReferenceGrid
