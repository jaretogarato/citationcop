import React, { useState, useEffect } from 'react'
import type { Reference, ReferenceStatus } from '@/app/types/reference'
import {
  Dialog,
  DialogDescription,
  DialogTitle,
  DialogTrigger
} from '@/app/components/ui/dialog'
import GridReferenceDialogue from './GridReferenceDialogue'
import { DialogContent } from '@radix-ui/react-dialog'

const SQUARES_PER_ROW = 30
const ANIMATION_DELAY_PER_SQUARE = 50 // milliseconds

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
  const [prevLength, setPrevLength] = useState(0)

  useEffect(() => {
    // Only animate new squares
    if (references.length > prevLength) {
      // Start from previous length
      setVisibleCount(prevLength)
      
      // Animate new squares
      const interval = setInterval(() => {
        setVisibleCount(prev => {
          if (prev < references.length) {
            return prev + 1
          }
          clearInterval(interval)
          return prev
        })
      }, ANIMATION_DELAY_PER_SQUARE)

      // Update previous length after animation
      setPrevLength(references.length)

      return () => clearInterval(interval)
    }
  }, [references.length, prevLength])

  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-200 mb-4">Reference Status</h3>
      
      <div className="max-w-4xl rounded-lg border border-slate-700 p-4">
        <div className="flex flex-wrap gap-1">
          {references.map((ref, i) => (
            <Dialog key={i}>
              <DialogDescription></DialogDescription>
              <DialogTrigger>
                <div
                  className={`
                    w-4 h-4
                    ${statusColors[ref.status]}
                    hover:opacity-75 transition-opacity
                    cursor-pointer
                    transform
                    ${i >= prevLength && i < visibleCount ? 
                      'animate-in fade-in slide-in-from-bottom-2 duration-300' : 
                      i < prevLength ? 'opacity-100' : 'opacity-0'}
                  `}
                  style={{
                    animationDelay: `${(i - prevLength) * 50}ms`
                  }}
                />
              </DialogTrigger>
              <DialogContent title="Reference display">
                <DialogTitle></DialogTitle>
                <GridReferenceDialogue reference={ref} />
              </DialogContent>
            </Dialog>
          ))}
        </div>
      </div>

      {/* Legend */}
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