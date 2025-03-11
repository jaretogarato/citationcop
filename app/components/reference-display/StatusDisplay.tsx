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

  // Group jobs by status for better organization
  const processingJobs = Array.from(currentJobs.entries())
    .filter(([_, item]) => item.status === 'processing')
    .sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime())

  const completedJobs = Array.from(currentJobs.entries())
    .filter(([_, item]) => item.status === 'complete')
    .sort((a, b) => b[1].timestamp.getTime() - a[1].timestamp.getTime())

  const errorJobs = Array.from(currentJobs.entries())
    .filter(
      ([_, item]) => item.status === 'error' && item.message.includes('failed')
    )
    .sort((a, b) => b[1].timestamp.getTime() - a[1].timestamp.getTime())

  return (
    <div className="mt-6 space-y-4">
      {/* Active Jobs Section */}
      {currentJobs.size > 0 && (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <span className="relative mr-2">
              <Cog className="w-5 h-5 text-yellow-400" />
            </span>
            Active Processes{' '}
            {/*({processingJobs.length} active,{' '}
            {completedJobs.length} completed, {errorJobs.length} errors)*/}
          </h3>

          <div className="space-y-3">
            {/* Processing Jobs */}
            {processingJobs.map(([jobId, item]) => (
              <div
                key={`job-${jobId}`}
                className="bg-gray-900 rounded-md p-3 border-l-4 border-yellow-500 opacity-100 relative z-10"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <span className="text-white font-medium block">
                      {item.pdfId}
                    </span>
                    <span className="text-gray-300 text-sm mt-1 block">
                      {item.message}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="h-3 w-3 bg-yellow-500 rounded-full animate-pulse"></div>
                    <span className="text-gray-400 text-xs">
                      {getElapsedTime(item.timestamp)}
                    </span>
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

            {/* Completed Jobs - Only show the 3 most recent */}
            {completedJobs.slice(0, 3).map(([jobId, item]) => (
              <div
                key={`job-${jobId}`}
                className="bg-gray-900 rounded-md p-3 border-l-4 border-green-500 opacity-90 relative z-10"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <span className="text-white font-medium block">
                      {item.pdfId}
                    </span>
                    <span className="text-gray-300 text-sm mt-1 block">
                      {item.message}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-gray-400 text-xs">
                      {getElapsedTime(item.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {/* Error Jobs */}
            {errorJobs.map(([jobId, item]) => (
              <div
                key={`job-${jobId}`}
                className="bg-gray-900 rounded-md p-3 border-l-4 border-red-500 opacity-90 relative z-10"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <span className="text-white font-medium block">
                      {item.pdfId}
                    </span>
                    <span className="text-gray-300 text-sm mt-1 block">
                      {item.message}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span className="text-gray-400 text-xs">
                      {getElapsedTime(item.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Log Messages Section 
      <div className="bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-2">Process Log</h3>
        <div
          ref={scrollRef}
          className="bg-gray-900 rounded p-3 max-h-[200px] overflow-y-auto text-sm"
        >
          {logMessages.length > 0 ? (
            logMessages.map((message, index) => (
              <div key={index} className="text-gray-300 py-0.5">
                {message}
              </div>
            ))
          ) : (
            <div className="text-gray-500 italic">
              Waiting for process to start...
            </div>
          )}
        </div>
      </div>
      */}
    </div>
  )
}

export default StatusDisplay
