import React, { useState, useEffect } from 'react'
import type { Reference, ReferenceStatus } from '@/app/types/reference'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger
} from '@/app/components/ui/dialog'
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
  const [visibleReferences, setVisibleReferences] = useState<Reference[]>([])
  const [lastProcessedLength, setLastProcessedLength] = useState(0)

  useEffect(() => {
    console.log('New references array received:', references.length)
    console.log('Current visible references:', visibleReferences.length)
    console.log('Last processed length:', lastProcessedLength)

    // If we got new references
    if (references.length > lastProcessedLength) {
      // Find the new references that weren't processed yet
      const newRefs = references.slice(lastProcessedLength)
      console.log('New references to process:', newRefs.length)
      
      // Clear any existing timeouts
      const timeouts: NodeJS.Timeout[] = []
      
      // Add them one by one with delays
      newRefs.forEach((ref, index) => {
        const timeout = setTimeout(() => {
          setVisibleReferences(prev => [...prev, ref])
          
          // If this is the last reference in the batch, update lastProcessedLength
          if (index === newRefs.length - 1) {
            setLastProcessedLength(references.length)
          }
        }, index * ANIMATION_DELAY)
        
        timeouts.push(timeout)
      })

      // Cleanup timeouts if component unmounts or new references arrive
      return () => timeouts.forEach(timeout => clearTimeout(timeout))
    }
  }, [references, lastProcessedLength])

  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-200 mb-4">
        Reference Status
      </h3>

      <div className="max-w-4xl rounded-lg border border-slate-700 p-4">
        <div className="flex flex-wrap gap-1">
          {visibleReferences.map((ref, i) => (
            <Dialog key={i}>
              <DialogTrigger>
                <div
                  className={`
                    w-4 h-4
                    ${statusColors[ref.status]}
                    hover:opacity-75 transition-opacity
                    cursor-pointer
                    animate-in fade-in zoom-in duration-500 slide-in-from-bottom-4
                  `}
                />
              </DialogTrigger>
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