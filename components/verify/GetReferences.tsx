'use client'

import { useState } from 'react'
import { TabSelector } from './TabSelector'
import { FileUpload } from './FileUpload'
import { TextInput } from './TextInput'
import { SubmitButton } from './SubmitButton'
import { doubleCheckReference } from '@/actions/double-check-reference'
import type { Reference } from '@/types/reference'

interface ExtractResponse {
  references: Reference[]
  error?: string
}

export interface FileData {
  file: File | null
  name: string | null
}

interface GetReferencesProps {
  onComplete: (data: { type: 'file' | 'text'; content: string }) => void
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
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: ExtractResponse = await response.json();

    if (!data.references || !Array.isArray(data.references)) {
      throw new Error('Invalid response structure');
    }

    return data.references;
  }

  validate(): boolean {
    return this.text.trim().length > 0;
  }
}

export default function GetReferences({ onComplete }: GetReferencesProps): JSX.Element {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStage, setProcessingStage] = useState<'idle' | 'getting' | 'checking'>('idle');
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('paste');
  const [fileData, setFileData] = useState<FileData>({ file: null, name: null });
  const [text, setText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });

  const getProcessor = (): ReferenceProcessor | null => {
    if (activeTab === 'upload' && fileData.file) {
      return new FileReferenceProcessor(fileData.file);
    }
    if (activeTab === 'paste' && text) {
      return new TextReferenceProcessor(text);
    }
    return null;
  };

  const handleSubmit = async () => {
    const processor = getProcessor();
    if (!processor) return;

    setIsProcessing(true);
    setError(null);
    setProcessingStage('getting');
    setProgress({ current: 0, total: 0 });

    try {
      // Get initial references
      const references = await processor.process();
      console.log("Initial references from processor:", references);

      // Update progress total
      setProgress({ current: 0, total: references.length });

      // Double check phase
      // Double check phase
      setProcessingStage('checking');
      let finalReferences: Reference[] = [];

      for (let i = 0; i < references.length; i++) {
        const reference = references[i];
        try {
          //console.log(`Checking reference ${i + 1}:`, reference);

          const result = await doubleCheckReference(reference);

          //console.log(`Double check result for reference ${i + 1}:`, result);

          if ('ok' in result[0]) {
            // If the reference is valid, keep the original
            finalReferences.push(reference);
          } else {
            // If we got back corrected/multiple references, add them all
            const correctedRefs = result as Reference[];

            //console.log(`Corrected references:`, correctedRefs);


            // Map through to ensure each reference has the right status
            finalReferences = finalReferences.concat(
              correctedRefs.map(ref => ({
                ...ref,
                status: 'pending' // Always set status to pending for corrected references
              }))
            );
          }

          //console.log(`Final references array after processing ${i + 1}:`, finalReferences);

          setProgress(prev => ({ ...prev, current: i + 1 }))


        } catch (err) {
          console.warn(`Error checking reference ${i + 1}:`, err)
          finalReferences.push(reference); // Keep original if check fails
          setProgress(prev => ({ ...prev, current: i + 1 }))
        }
      }

      //console.log("All references processed. Final array:", finalReferences);
      //console.log("Stringified content being sent:", JSON.stringify(finalReferences));


      onComplete({
        type: activeTab === 'upload' ? 'file' : 'text',
        content: JSON.stringify(finalReferences)
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Processing error:', err);
    } finally {
      setIsProcessing(false);
      setProcessingStage('idle');
      setProgress({ current: 0, total: 0 });
    }
  };

  const hasContent = fileData.file !== null || text.trim().length > 0;

  const handleTabChange = (newTab: 'upload' | 'paste') => {
    setActiveTab(newTab);
    setFileData({ file: null, name: null });
    setText('');
    setError(null);
  };

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

          {error && (
            <div className="mt-4 text-red-500 text-sm text-center">
              {error}
            </div>
          )}

          <div className="mt-8 flex flex-col items-center gap-4">
            <SubmitButton
              isProcessing={isProcessing}
              disabled={!hasContent}
              onClick={handleSubmit}
            />
 
            {processingStage !== 'idle' && (
              <div className="text-sm text-gray-400 flex flex-col items-center gap-2">
                <div>
                  {processingStage === 'getting'
                    ? 'Getting references...'
                    : 'Double checking references...'}
                </div>
                {processingStage === 'checking' && progress.total > 0 && (
                  <div className="text-xs">
                    Progress: {progress.current + 1} / {progress.total}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}