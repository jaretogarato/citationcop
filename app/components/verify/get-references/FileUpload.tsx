import { useState, useRef } from 'react';
import { Upload } from 'lucide-react';
import { convert2Pdf } from '@/utils/file-utils';
import type { FileUploadProps } from '@/app/types/files';

const ACCEPTED_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx only
] as const;

const FILE_EXTENSIONS = '.pdf,.docx';

export function FileUpload({ fileData, setFileData }: FileUploadProps) {
    const [dragActive, setDragActive] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isConverting, setIsConverting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = async (file: File) => {
        const MAX_SIZE = 5 * 1024 * 1024; // 5MB
        if (file.size > MAX_SIZE) {
            setError(`File too large. Maximum size is 5MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
            return;
        }

        if (!ACCEPTED_TYPES.includes(file.type as typeof ACCEPTED_TYPES[number])) {
            setError('Please upload a PDF or DOCX file');
            return;
        }

        try {
            let finalFile = file;
            if (file.type !== 'application/pdf') {
                setIsConverting(true);
                finalFile = await convert2Pdf(file);
            }

            setFileData({
                file: finalFile,
                name: finalFile.name,
                originalSize: file.size,
                compressedSize: finalFile.size
            });
            setError(null);
        } catch (error) {
            console.error('File processing failed:', error);
            setError(error instanceof Error ? error.message : 'Failed to process file');
        } finally {
            setIsConverting(false);
        }
    };

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
            <p className="text-sm text-gray-400 text-center">Maximum file size: 5MB.</p>

            <div
                className={`border-2 border-dashed rounded-[2rem] p-12 text-center transition-all duration-300
                    ${dragActive ? 'border-indigo-500 bg-indigo-900/20' : 'border-gray-700 bg-gray-800/50'}
                    cursor-pointer`}
                role="button"
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
                    accept={ACCEPTED_TYPES.join(',')}
                />
                <div className="flex flex-col items-center gap-6">
                    {!fileData.file && !isConverting && (
                        <div className="w-24 h-24 rounded-[1.5rem] bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center">
                            <Upload className="w-12 h-12 text-white" />
                        </div>
                    )}
                    <div>
                        {isConverting ? (
                            <p className="text-lg font-medium text-white mb-1" aria-live="polite">Converting to PDF...</p>
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
                                <p className="text-lg font-medium text-white mb-1">Drop your document here</p>
                                <p className="text-sm text-gray-400">Supports PDF and DOCX files</p>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {error && <div className="text-red-500 text-center text-sm">{error}</div>}
        </div>
    );
}
