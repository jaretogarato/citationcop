// hooks/useReferenceProcessor.ts
import { useState } from 'react'
import { parsePDF } from '@/app/actions/parse-pdf'
import type { Reference, ReferenceStatus } from '@/app/types/reference'
import { validateReferences } from '@/app/utils/filter-references'

interface ProcessingState {
  isProcessing: boolean
  processingStage: 'idle' | 'getting' | 'checking' | 'fallback'
  error: string | null
  progress: { current: number; total: number }
  fastProgress: number
}

interface UseReferenceProcessorProps {
  onComplete: (data: { type: 'file' | 'text'; content: string }) => void
  maxReferences?: number
  highAccuracy: boolean
}

export const useReferenceExtractor = ({ 
  onComplete, 
  maxReferences, 
  highAccuracy 
}: UseReferenceProcessorProps) => {
  const [state, setState] = useState<ProcessingState>({
    isProcessing: false,
    processingStage: 'idle',
    error: null,
    progress: { current: 0, total: 0 },
    fastProgress: 0
  })

  const updateState = (newState: Partial<ProcessingState>) => {
    setState((prev: ProcessingState) => ({ ...prev, ...newState }))
  }

  const processReferences = async (references: Reference[]) => {
    if (!highAccuracy) {
      return references
    }

    updateState({ 
      processingStage: 'checking',
      progress: { current: 0, total: references.length }
    })

    const BATCH_SIZE = 3
    const finalReferences: Reference[] = []

    for (let i = 0; i < references.length; i += BATCH_SIZE) {
      const batch = references.slice(i, i + BATCH_SIZE)
      const batchPromises = batch.map((reference, index) => {
        const keyIndex = index % 3
        return fetch('/api/double-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference, keyIndex }),
        })
        .then(async response => {
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
          const result = await response.json()

          const newState = (prev: ProcessingState) => ({
                      ...prev,
                      progress: { 
                        ...prev.progress, 
                        current: prev.progress.current + 1 
                      }
                    });
          updateState(newState(state));

          if ('ok' in result[0]) return reference
          return (result as Reference[]).map(ref => ({
            ...ref,
            status: 'pending' as ReferenceStatus
          }))
        })
        .catch(() => reference)
      })

      const batchResults = await Promise.all(batchPromises)
      finalReferences.push(...batchResults.flat())
    }

    return finalReferences
  }

  const processFile = async (file: File) => {
    try {
      updateState({ 
        isProcessing: true, 
        error: null, 
        processingStage: 'getting' 
      })

      let references: Reference[]
      
      // Try GROBID first
      try {
        const formData = new FormData()
        formData.append('file', file)
        const response = await fetch('/api/grobid/references', {
          method: 'POST',
          body: formData
        })
        
        if (!response.ok) throw new Error()
        const data = await response.json()
        references = data.references
      } catch {
        // Fallback to PDF parsing
        updateState({ processingStage: 'fallback' })
        const arrayBuffer = await file.arrayBuffer()
        const text = await parsePDF(Array.from(new Uint8Array(arrayBuffer)))
        await processText(text)
        references = []
      }

      references = validateReferences(references.slice(0, maxReferences))
      
      if (references.length === 0) {
        updateState({ error: 'no-references' })
        return []
      }

      const finalReferences = await processReferences(references)
      onComplete({
        type: 'file',
        content: JSON.stringify(finalReferences)
      })
      return references
    } catch (err) {
      updateState({ 
        error: err instanceof Error ? err.message : 'An error occurred' 
      })
    } finally {
      updateState({ 
        isProcessing: false, 
        processingStage: 'idle',
        progress: { current: 0, total: 0 },
        fastProgress: 0
      })
    }
  }

  const processText = async (text: string) => {
    try {
      updateState({ 
        isProcessing: true, 
        error: null, 
        processingStage: 'getting' 
      })

      const response = await fetch('/api/references/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      
      const data = await response.json()
      if (!data.references || !Array.isArray(data.references)) {
        throw new Error('Invalid response structure')
      }

      let references = data.references.map((reference: Reference) => ({
        ...reference,
        raw: text
      }))

      references = validateReferences(references.slice(0, maxReferences))

      if (references.length === 0) {
        updateState({ error: 'no-references' })
        return
      }

      const finalReferences = await processReferences(references)
      onComplete({
        type: 'text',
        content: JSON.stringify(finalReferences)
      })
    } catch (err) {
      updateState({ 
        error: err instanceof Error ? err.message : 'An error occurred' 
      })
    } finally {
      updateState({ 
        isProcessing: false, 
        processingStage: 'idle',
        progress: { current: 0, total: 0 },
        fastProgress: 0
      })
    }
  }

  return {
    ...state,
    processFile,
    processText
  }
}