import { useEffect, useState } from 'react'
// Define types for the counter hook
type UseCounterProps = {
  end: number
  duration?: number
  start?: number
}

// Animated counter hook
export const useCounter = ({
  end,
  duration = 2000,
  start = 0
}: UseCounterProps): number => {
  const [count, setCount] = useState<number>(start)

  useEffect(() => {
    let startTime: number | null = null
    const animate = (currentTime: number): void => {
      if (!startTime) startTime = currentTime
      const progress = (currentTime - startTime) / duration

      if (progress < 1) {
        setCount(Math.floor(progress * (end - start) + start))
        requestAnimationFrame(animate)
      } else {
        setCount(end)
      }
    }

    requestAnimationFrame(animate)
  }, [end, duration, start])

  return count
}
