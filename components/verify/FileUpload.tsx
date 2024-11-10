'use client'

import { useState, useRef } from 'react';
import { Upload } from "lucide-react";
import type { FileData } from '@/types/types';

interface FileUploadProps {
  fileData: FileData;
  setFileData: (data: FileData) => void;
}

export function FileUpload({ 
  fileData, 
  setFileData 
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.type.includes('pdf')) {
        setError('Please upload a PDF file');
        return;
      }
      setFileData({ file, name: file.name });
      setError(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.includes('pdf')) {
        setError('Please upload a PDF file');
        return;
      }
      setFileData({ file, name: file.name });
      setError(null);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-[2rem] p-12 text-center transition-all duration-300 
          ${dragActive
            ? 'border-indigo-500 bg-indigo-900/20'
            : 'border-gray-700 bg-gray-800/50'
          }
          cursor-pointer`
        }
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept=".pdf"
        />
        <div className="flex flex-col items-center gap-6">
          <div className="w-24 h-24 rounded-[1.5rem] bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center">
            <Upload className="w-12 h-12 text-white" />
          </div>
          <div>
            {fileData.file ? (
              <p className="text-lg font-medium text-white mb-1">
                {fileData.name}
              </p>
            ) : (
              <>
                <p className="text-lg font-medium text-white mb-1">
                  Drop your PDF document here
                </p>
                <p className="text-sm text-gray-400">
                  or click to browse files
                </p>
              </>
            )}
          </div>
        </div>
      </div>
      
      {error && (
        <div className="text-red-500 text-center text-sm">
          {error}
        </div>
      )}
    </div>
  );
}