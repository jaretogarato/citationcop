"use client"

import * as React from "react"
import * as Progress from "@radix-ui/react-progress"
import { cn } from "@/app/utils/cn"

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
          "relative w-full h-4 overflow-hidden rounded-full bg-black/10",
          "before:absolute before:w-full before:h-full before:bg-[length:300%_100%]",
          "before:animate-shimmer before:bg-gradient-to-r",
          "before:from-transparent before:via-white/10 before:to-transparent",
          className
        )}
        value={onProgress}
      >
        <Progress.Indicator
          className={cn(
            "w-full h-full transition-transform duration-500 ease-out",
            "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500",
            "animate-pulse"
          )}
          style={{
            transform: `translateX(-${100 - onProgress}%)`
          }}
        />
        <div 
          className={cn(
            "absolute inset-0 w-full h-full",
            "bg-gradient-to-r from-black/5 to-transparent",
            "pointer-events-none"
          )}
        />
      </Progress.Root>
    )
  }
)
ProgressBar.displayName = "ProgressBar"

export { ProgressBar }