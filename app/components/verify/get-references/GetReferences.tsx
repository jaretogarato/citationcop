'use client'

import { useState } from 'react'
import { TabSelector } from './TabSelector'
import { FileUpload } from './FileUpload'
import { TextInput } from './TextInput'
import { SubmitButton } from './SubmitButton'
import { parsePDF } from '@/app/actions/parse-pdf'
import type { Reference, ReferenceStatus } from '@/app/types/reference'
import { ModeSelector } from '../../ui/ModeSelector'
import { ProcessingIndicator } from './ProcessingIndicator'
import { NoReferencesAlert } from './NoReferencesAlert'
import { validateReferences } from '@/app/utils/filter-references'

interface ExtractResponse {
  references: Reference[]
  error?: string
}

export interface FileData {
  file: File | null
  name: string | null
}

interface GetReferencesProps {
  onComplete: (data: { type: 'file' | 'text'; content: string }) => void;
  maxReferences?: number;
}

interface ReferenceProcessor {
  process: () => Promise<Reference[]>
  validate: () => boolean
}

class FileReferenceProcessor implements ReferenceProcessor {
  constructor(private file: File) { }

  async process(): Promise<Reference[]> {
    const formData = new FormData()
    formData.append('file', this.file)

    const response = await fetch('/api/grobid/references', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data: ExtractResponse = await response.json()
    if (data.error) {
      throw new Error(data.error)
    }

    return data.references
  }

  async fallbackProcess(): Promise<Reference[]> {
    // Convert file to array buffer
    const arrayBuffer = await this.file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)

    // Parse PDF to text using server action
    const extractedText = await parsePDF(Array.from(uint8Array))

    // Use text processor as fallback
    const textProcessor = new TextReferenceProcessor(extractedText)
    return textProcessor.process()
  }

  validate(): boolean {
    return this.file !== null
  }
}

class TextReferenceProcessor implements ReferenceProcessor {
  constructor(private text: string) { }

  async process(): Promise<Reference[]> {
    const response = await fetch('/api/references/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: this.text }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data: ExtractResponse = await response.json()

    if (!data.references || !Array.isArray(data.references)) {
      throw new Error('Invalid response structure')
    }

    const processedReferences = data.references.map(reference => ({
      ...reference//,
      //raw: ""//this.text
    }));

    return processedReferences;
  }

  validate(): boolean {
    return this.text.trim().length > 0
  }
}

export default function GetReferences({ onComplete, maxReferences }: GetReferencesProps): JSX.Element {
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [processingStage, setProcessingStage] = useState<'idle' | 'getting' | 'checking' | 'fallback'>('idle')
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('paste')
  const [fileData, setFileData] = useState<FileData>({ file: null, name: null })
  const [text, setText] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 })
  const [highAccuracy, setHighAccuracy] = useState<boolean>(true)
  const [fastProgress, setFastProgress] = useState<number>(0)

  const getProcessor = (): ReferenceProcessor | null => {
    if (activeTab === 'upload' && fileData.file) {
      return new FileReferenceProcessor(fileData.file)
    }
    if (activeTab === 'paste' && text) {
      return new TextReferenceProcessor(text)
    }
    return null
  }

  const limitReferences = (references: Reference[]): Reference[] => {
    if (maxReferences !== undefined) {
      return references.slice(0, maxReferences);
    }
    return references;
  };

  const handleSubmit = async () => {
    const processor = getProcessor()
    if (!processor) return

    setIsProcessing(true)
    setError(null)
    setProcessingStage('getting')
    setFastProgress(0)

    try {
      // Get initial references
      let references = await processor.process()
      let initialHadReferences = references.length

      //console.log("Initial references from processor:", references) 
      //console.log("Initial references length:", references.length)
      //console.log("initialHadReferences:", initialHadReferences)
      // Limit references early before expensive processing
      references = limitReferences(references);

      //console.log("Initial references from processor:", references)

      // If no references found and it's a file upload, try fallback method
      if (references.length === 0 && activeTab === 'upload' && processor instanceof FileReferenceProcessor) {
        setProcessingStage('fallback')
        //console.log("No references found, trying fallback method...")
        references = await processor.fallbackProcess()
        references = limitReferences(references);
        //console.log("Fallback references:", references)
      }

      references = validateReferences(references)

      if (references.length === 0) {
        setError('no-references')
        return
      }

      // Skip high accuracy mode if initial process had no references, OR if it's disabled or paste mode
      if (!initialHadReferences || !highAccuracy || activeTab === 'paste') {
        onComplete({
          type: activeTab === 'upload' ? 'file' : 'text',
          content: JSON.stringify(references)
        })
        return
      }

      setProcessingStage('checking')
      setProgress({ current: 0, total: references.length })

      const BATCH_SIZE = 3
      const finalReferences: Reference[] = []

      for (let i = 0; i < references.length; i += BATCH_SIZE) {
        const batchStartTime = Date.now()
        console.log(`Starting batch ${i / BATCH_SIZE + 1}`)

        const batch = references.slice(i, i + BATCH_SIZE)

        const batchPromises = batch.map((reference, index) => {
          const startTime = Date.now()
          const keyIndex = index % 3

          return fetch('/api/double-check', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ reference, keyIndex }),
          })
            .then(async response => {
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
              }
              const result = await response.json()

              const endTime = Date.now()
              console.log(`Reference ${i + index + 1} took ${endTime - startTime}ms`)

              setProgress(prev => ({ ...prev, current: prev.current + 1 }))

              if ('ok' in result[0]) {
                return reference
              } else {
                return (result as Reference[]).map(ref => ({
                  ...ref,
                  status: 'pending' as ReferenceStatus
                }))
              }
            })
            .catch(err => {
              console.warn('Error checking reference:', err)
              return reference
            })
        })

        const batchResults = await Promise.all(batchPromises)
        const batchEndTime = Date.now()
        console.log(`Batch ${i / BATCH_SIZE + 1} completed in ${batchEndTime - batchStartTime}ms`)

        finalReferences.push(...batchResults.flat())
      }

      onComplete({
        type: activeTab === 'upload' ? 'file' : 'text',
        content: JSON.stringify(finalReferences)
      })

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      console.error('Processing error:', err)
    } finally {
      setIsProcessing(false)
      setProcessingStage('idle')
      setProgress({ current: 0, total: 0 })
      setFastProgress(0)
    }
  }

  const hasContent = fileData.file !== null || text.trim().length > 0

  const handleTabChange = (newTab: 'upload' | 'paste') => {
    setActiveTab(newTab)
    setFileData({ file: null, name: null })
    setText('')
    setError(null)
  }

  return (
    <div className="p-8">
      <div className="w-full">
        <h2 className="text-3xl font-bold text-white mb-8 text-center">
          Validate References
        </h2>

        <div className="w-full">
          <TabSelector
            activeTab={activeTab}
            setActiveTab={handleTabChange}
          />
          {error === 'no-references' ? (
            <NoReferencesAlert />
          ) : error ? (
            <div className="mt-4 text-red-500 text-sm text-center">
              {error}
            </div>
          ) : null}
          <div className="mt-8">
            {activeTab === 'upload' ? (
              <FileUpload
                fileData={fileData}
                setFileData={setFileData}
              />
            ) : (
              <TextInput text={text} setText={setText} />
            )}
          </div>

          <div className="flex justify-between items-start mt-4">
            <ModeSelector
              isHighAccuracy={highAccuracy}
              onToggle={setHighAccuracy}
              disabled={isProcessing}
            />

            <ProcessingIndicator
              stage={processingStage}
              isHighAccuracy={highAccuracy}
              progress={progress}
            />
          </div>

          <div className="mt-4 flex justify-center">
            <SubmitButton
              isProcessing={isProcessing}
              isLimitReached={maxReferences === 0}
              disabled={!hasContent}
              onClick={handleSubmit}
            />
          </div>
        </div>
      </div>
    </div>
  )
}