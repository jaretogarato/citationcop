// Modify the ReferenceGrid component to better handle individual reference updates
import React, { useState, useEffect, useRef } from 'react'
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

const ANIMATION_DELAY = 100 // ms between each reference appearance

const statusColors: Record<ReferenceStatus, string> = {
  verified: 'bg-emerald-400/60',
  unverified: 'bg-rose-400/60',
  'needs-human': 'bg-amber-400/60',
  error: 'bg-slate-400/60',
  pending: 'bg-indigo-400/60'
}

const statusDisplayNames: Record<ReferenceStatus | 'no_status', string> = {
  verified: 'Verified',
  'needs-human': 'Needs Human review',
  error: 'Oops! Something went wrong',
  pending: 'Pending',
  unverified: 'Reference does not appear to exist',
  no_status: 'No Status'
}

interface ReferenceGridProps {
  references: Reference[]
}

const ReferenceGrid: React.FC<ReferenceGridProps> = ({ references }) => {
  // Track which references we've seen before in a ref
  const seenReferencesRef = useRef<Set<string>>(new Set())
  const [visibleReferences, setVisibleReferences] = useState<string[]>([])

  useEffect(() => {
    // Only animate new references that we haven't seen before
    const newReferences = references.filter(
      (ref) => !seenReferencesRef.current.has(`${ref.sourceDocument}-${ref.id}`)
    )

    if (newReferences.length === 0) return

    // Add the new references to our seen set
    newReferences.forEach((ref) => {
      seenReferencesRef.current.add(`${ref.sourceDocument}-${ref.id}`)
    })

    // Gradually make the new references visible with animation
    let timeoutId: NodeJS.Timeout
    newReferences.forEach((ref, index) => {
      timeoutId = setTimeout(() => {
        setVisibleReferences((prev) => [
          ...prev,
          `${ref.sourceDocument}-${ref.id}`
        ])
      }, ANIMATION_DELAY * index)
    })

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [references])

  // Helper function to check if a reference should be visible
  const isReferenceVisible = (ref: Reference): boolean => {
    return visibleReferences.includes(`${ref.sourceDocument}-${ref.id}`)
  }

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
    if (!status) return statusDisplayNames.no_status
    return statusDisplayNames[status] || statusDisplayNames.no_status
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
                      <TooltipContent
                        side="top"
                        className="bg-slate-800 text-slate-100 border-slate-700"
                      >
                        <p className="text-xs">Start of references from:</p>
                        <p className="text-xs font-medium">{sourceDoc}</p>
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
                                ${
                                  seenReferencesRef.current.has(
                                    `${ref.sourceDocument}-${ref.id}`
                                  ) && !isReferenceVisible(ref)
                                    ? 'opacity-0'
                                    : 'animate-in fade-in zoom-in duration-500 slide-in-from-bottom-4'
                                }
                                rounded-sm 
                                shrink-0
                              `}
                            />
                          </DialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="max-w-[300px] text-xs bg-slate-800 text-slate-100 border-slate-700"
                        >
                          <p className="font-semibold">{ref.title}</p>
                          <p className="text-slate-300 mt-1">
                            Source: {sourceDoc}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <DialogContent className="bg-transparent border-none shadow-none max-w-lg">
                      <DialogTitle hidden>Reference {ref.title}</DialogTitle>
                      <DialogDescription hidden>
                        Details of the verification of the reference
                      </DialogDescription>
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
