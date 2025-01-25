'use client'

import React, { useState, useEffect } from 'react'
import type { Reference, ReferenceStatus } from '@/app/types/reference'
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
  TooltipTrigger,
} from "@/app/components/ui/tooltip"
import { ReferenceDialog } from '../verify/display/ReferenceDialog'

const ANIMATION_DELAY = 100 // ms between each reference appearance

const statusColors: Record<ReferenceStatus, string> = {
  verified: 'bg-emerald-400/60',
  unverified: 'bg-rose-400/60',
  error: 'bg-amber-400/60',
  pending: 'bg-indigo-400/60'
}

const statusDisplayNames: Record<ReferenceStatus, string> = {
  verified: 'Verified',
  error: 'Needs Human Review',
  pending: 'Pending',
  unverified: 'Could not be verified'
}

interface ReferenceGridProps {
  references: Reference[]
}

const ReferenceGrid: React.FC<ReferenceGridProps> = ({ references }) => {
  const [visibleCount, setVisibleCount] = useState(0)

  useEffect(() => {
    setVisibleCount(0) // Reset count when references change
    
    const timeout = setTimeout(() => {
      setVisibleCount(references.length)
    }, ANIMATION_DELAY)
    
    return () => clearTimeout(timeout)
  }, [references])

  // Only show the first n references based on visibleCount
  const visibleReferences = references.slice(0, visibleCount)

  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-200 mb-4">
        Reference Status
      </h3>

      <div className="max-w-4xl rounded-lg border border-slate-700 p-4">
        <div className="flex flex-wrap gap-1">
          {visibleReferences.map((ref, i) => (
            <Dialog key={i}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DialogTrigger>
                      <div
                        className={`
                          w-4 h-4
                          ${statusColors[ref.status]}
                          hover:opacity-75 transition-opacity
                          cursor-pointer
                          animate-in fade-in zoom-in duration-500 slide-in-from-bottom-4
                          rounded-sm 
                        `}
                      /> 
                    </DialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent 
                    side="top" 
                    className="max-w-[300px] text-xs bg-slate-800 text-slate-100 border-slate-700"
                  >
                    <p className="font-semibold">{ref.title}</p>
                    {ref.sourceDocument && (
                      <p className="text-slate-300 mt-1">
                        Source: {ref.sourceDocument}
                      </p>
                    )}
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
        </div>
      </div>

      <div className="mt-4 flex gap-4 items-center justify-end">
        {Object.entries(statusDisplayNames).map(([status, displayName]) => (
          <div key={status} className="flex items-center gap-2">
            <div
              className={`w-4 h-4 ${statusColors[status as ReferenceStatus]}`}
            />
            <span className="text-sm text-gray-200 capitalize">
              {displayName}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ReferenceGrid