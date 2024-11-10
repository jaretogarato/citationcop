"use client"

import * as React from "react"
import * as Progress from "@radix-ui/react-progress"
import { cn } from "@/utils/cn"

interface ProgressBarProps {
  onProgress: number
  className?: string
  indicatorColor?: string
}

const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ onProgress = 0, className, indicatorColor }, ref) => {
    return (
      <Progress.Root
        ref={ref}
        className={cn(
          "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
          className
        )}
        value={onProgress}
      >
        <Progress.Indicator
          className="h-full w-full flex-1 bg-primary duration-300 ease-in-out"
          style={{
            background: indicatorColor || 'linear-gradient(to right, #6366F1, #8B5CF6, #EC4899)',
            transform: `translateX(-${100 - onProgress}%)`
          }}
        />
      </Progress.Root>
    )
  }
)
ProgressBar.displayName = "ProgressBar"

export { ProgressBar }