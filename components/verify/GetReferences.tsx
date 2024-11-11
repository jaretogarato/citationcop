'use client'

import { useState } from 'react';
import { TabSelector } from './TabSelector';
import { FileUpload } from './FileUpload';
import { TextInput } from './TextInput';
import { SubmitButton } from './SubmitButton';
import { parsePDF } from '@/actions/parse-pdf';
//import { getReferences } from '@/actions/openAI-verify';

export interface FileData {
  file: File | null;
  name: string | null;
}

interface GetReferencesProps {
  onComplete: (data: { type: 'file' | 'text'; content: File | string }) => void;
}

export default function GetReferences({ onComplete }: GetReferencesProps): JSX.Element {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('paste');
  const [fileData, setFileData] = useState<FileData>({ file: null, name: null });
  const [text, setText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!hasContent) return;

    setIsProcessing(true);
    setError(null);

    try {
      let processedContent: string = '';

      // Process based on which input has content
      if (fileData.file) {
        // Process PDF file
        const arrayBuffer = await fileData.file.arrayBuffer()
        const binaryData = Array.from(new Uint8Array(arrayBuffer))
        const extractedText = await parsePDF(binaryData)

        console.log("Cleaned text from PDF:", extractedText)
        //debugger

        //processedContent = await getReferences(extractedText);
        processedContent = await extractReferences(extractedText)
      }

      if (text.trim()) {
        // If there's also text input, process and combine with file references
        //const textReferences = await getReferences(text);
        const textReferences = await extractReferences(text)
        processedContent = fileData.file ?
          `${processedContent}\n${textReferences}` :
          textReferences;
      }

      onComplete({
        type: 'text',
        content: processedContent
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Processing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Enable submit if either input has content
  const hasContent = fileData.file !== null || text.trim().length > 0;

  // Clear both inputs when switching tabs
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

          <div className="mt-8 flex justify-end">
            <SubmitButton
              isProcessing={isProcessing}
              disabled={!hasContent}
              onClick={handleSubmit}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
const extractReferences = async (text: string): Promise<string> => {
  try {
    const response = await fetch('/api/references/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    
    // Ensure the response has the correct structure
    if (!data.references || !Array.isArray(data.references)) {
      throw new Error('Invalid response structure')
    }

    // Return stringified data to match server action
    return JSON.stringify(data)

  } catch (error) {
    console.error('Error extracting references:', error)
    throw new Error('Failed to extract references')
  }
}