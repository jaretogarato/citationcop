// StatusDisplay.tsx

import React, { useEffect, useRef } from 'react'
import { Cog, CheckCircle, XCircle } from 'lucide-react'

interface StatusItem {
  pdfId: string
  status: 'processing' | 'complete' | 'error'
  message: string
  timestamp: Date
  progress?: number // Optional progress percentage
}

interface StatusDisplayProps {
  logMessages: string[]
  currentJobs: Map<string, StatusItem>
}

const StatusDisplay: React.FC<StatusDisplayProps> = ({
  logMessages,
  currentJobs
}) => {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logMessages])

  // Function to get time elapsed
  const getElapsedTime = (timestamp: Date) => {
    const now = new Date()
    const diffInSeconds = Math.floor(
      (now.getTime() - timestamp.getTime()) / 1000
    )

    if (diffInSeconds < 60) {
      return `${diffInSeconds}s ago`
    } else if (diffInSeconds < 3600) {
      return `${Math.floor(diffInSeconds / 60)}m ago`
    } else {
      return `${Math.floor(diffInSeconds / 3600)}h ${Math.floor((diffInSeconds % 3600) / 60)}m ago`
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {/* Active Jobs Section */}
      {currentJobs.size > 0 && (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <span className="relative mr-2">
              <Cog className="w-5 h-5 text-yellow-400" />
            </span>
            Active Processing
          </h3>

          <div
            className="space-y-3"
            key={`jobs-container-${Array.from(currentJobs.entries()).length}`}
          >
            {Array.from(currentJobs.entries()).map(([pdfId, item], index) => (
              <div
                key={pdfId}
                className="bg-gray-900 rounded-md p-3 border-l-4 border-yellow-500 opacity-100 relative z-10"
                style={{
                  // Ensure no transform or opacity is being applied
                  transform: 'none',
                  transition: 'all 300ms ease-in-out'
                }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    {/*<p className="text-white font-medium">{pdfId}</p>
                    <p className="text-gray-300 text-sm mt-1">{item.message}</p>*/}

                    <span className="text-white font-medium block">
                      {pdfId}
                    </span>
                    <br />
                    <span className="text-gray-300 text-sm mt-1 block">
                      {item.message}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {item.status === 'processing' && (
                      <div className="h-3 w-3 bg-yellow-500 rounded-full animate-pulse"></div>
                    )}
                    {item.status === 'complete' && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                    {item.status === 'error' && (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    {/* <span className="text-gray-400 text-xs">
                      {getElapsedTime(item.timestamp)}
                    </span>*/}{' '}
                  </div>
                </div>

                {/* Progress bar */}
                {item.progress !== undefined && (
                  <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-yellow-500 transition-all duration-500 ease-in-out"
                      style={{ width: `${item.progress}%` }}
                    ></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  ) // end return
}

export default StatusDisplay
