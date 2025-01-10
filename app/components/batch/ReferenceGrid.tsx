import React from 'react'
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

const statusColors: Record<ReferenceStatus, string> = {
  verified: 'bg-emerald-400/60',
  unverified: 'bg-rose-400/60',
  error: 'bg-amber-400/60',
  pending: 'bg-indigo-400/60'
}

// Create a map for display names of statuses
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
  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {references.map((ref, i) => (
          <Dialog key={i}>
            <DialogDescription></DialogDescription>{' '}
            <DialogTrigger>
              <div
                className={`
                  w-4 h-4
                  ${statusColors[ref.status]}
                  hover:opacity-75 transition-opacity
                  cursor-pointer
                `}
              />
            </DialogTrigger>
            <DialogContent title="Reference display">
              <DialogTitle></DialogTitle>
              <GridReferenceDialogue reference={ref} />
            </DialogContent>
          </Dialog>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex gap-4 items-center">
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
