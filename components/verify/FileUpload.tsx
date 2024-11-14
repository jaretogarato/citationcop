'use client';

import { useState, useRef } from 'react';
import { Upload } from 'lucide-react';
import { stripImagesAndCompress } from '@/utils/grobid/pdf-processors';

interface CompressedFileData {
    file: File | null;
    name: string | null;
    originalSize?: number;
    compressedSize?: number;
}

interface FileUploadProps {
    fileData: CompressedFileData;
    setFileData: (data: CompressedFileData) => void;
}

export function FileUpload({ fileData, setFileData }: FileUploadProps) {
    const [dragActive, setDragActive] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCompressing, setIsCompressing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = async (file: File) => {
        if (!file.type.includes('pdf')) {
            setError('Please upload a PDF file');
            return;
        }

        const MAX_SIZE = 5 * 1024 * 1024; // 5MB
        if (file.size > MAX_SIZE) {
            setError(`File too large. Maximum size is 5MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
            return;
        }

        if (file.size <= 3 * 1024 * 1024) {  // If less than 3MB
            setFileData({
                file,
                name: file.name,
                originalSize: file.size,
                compressedSize: file.size
            });
            return;
        }

        setIsCompressing(true);
        try {
            const processedBlob = await stripImagesAndCompress(file);
            const finalFile = new File([processedBlob], file.name, { type: 'application/pdf' });
            setFileData({
                file: finalFile,
                name: file.name,
                originalSize: file.size,
                compressedSize: processedBlob.size
            });
        } catch (error) {
            console.error('PDF compression failed:', error);
            setFileData({
                file,
                name: file.name,
                originalSize: file.size,
                compressedSize: file.size
            });
        } finally {
            setIsCompressing(false);
        }
    }

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
    };

    return (
        <div className="space-y-4">
            {/* Size limit message */}
            <p className="text-sm text-gray-400 text-center">Maximum file size: 5MB. Files over 3MB will be compressed.</p>

            <div
                className={`border-2 border-dashed rounded-[2rem] p-12 text-center transition-all duration-300
          ${dragActive ? 'border-indigo-500 bg-indigo-900/20' : 'border-gray-700 bg-gray-800/50'}
          cursor-pointer`}
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
                        {isCompressing ? (
                            <p className="text-lg font-medium text-white mb-1">Compressing...</p>
                        ) : fileData.file ? (
                            <>
                                <p className="text-lg font-medium text-white mb-1">{fileData.name}</p>
                                {fileData.originalSize && fileData.compressedSize && fileData.originalSize !== fileData.compressedSize && (
                                    <p className="text-sm text-gray-400">
                                        {(fileData.originalSize / (1024 * 1024)).toFixed(2)}MB → {(fileData.compressedSize / (1024 * 1024)).toFixed(2)}MB
                                    </p>
                                )}
                            </>
                        ) : (
                            <>
                                <p className="text-lg font-medium text-white mb-1">Drop your PDF document here</p>
                                <p className="text-sm text-gray-400">or click to browse files</p>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {error && <div className="text-red-500 text-center text-sm">{error}</div>}
        </div>
    )
}