"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cn } from "@/utils/cn"

interface ProgressBarProps {
  indicatorColor?: string
  onProgress: number
  className?: string
}

const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ className, onProgress = 0, indicatorColor, ...props }, ref) => {
    
    console.log('IN PROGRESSBAR, Progress:', onProgress);
    
    return (

    <div className="space-y-2">
      <ProgressPrimitive.Root
        ref={ref}
        className={cn(
          "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
          className
        )}
        value={onProgress}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className="h-full w-full flex-1 transition-all"
          style={{
            background: indicatorColor || 'linear-gradient(to right, #6366F1, #8B5CF6, #EC4899)',
            transform: `translateX(-${100 - (onProgress || 0)}%)`
          }}
        />
      </ProgressPrimitive.Root>
      <p className="text-center text-sm text-muted-foreground">
        {Math.round(onProgress || 0)}% Complete
      </p>
    </div>
    );
  }
)
ProgressBar.displayName = "ProgressBar"

export { ProgressBar }