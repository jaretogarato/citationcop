export type ProcessStatus = 'pending' | 'complete' | 'error'

// Updated ProcessState type
export type ProcessState = {
  status: ProcessStatus
  messages?: any[]
  iteration?: number
  result?: any
  error?: string

  // Old properties (keep for backward compatibility)
  functionResult?: any
  lastToolCallId?: string

  // New properties for multiple tool calls
  functionResults?: any[]
  toolCallIds?: string[]
  toolCalls?: Array<{
    id: string
    name: string
    arguments: any
  }>

  // Error handling properties
  parsingError?: boolean
  parseErrorMessage?: string
  rawContent?: string
  resultWasFallback?: boolean
}
