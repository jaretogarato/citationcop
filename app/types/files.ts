// types/files.ts
export interface CompressedFileData {
    file: File | null;
    name: string | null;
    originalSize?: number;
    compressedSize?: number;
}

export interface FileUploadProps {
    fileData: CompressedFileData;
    setFileData: (data: CompressedFileData) => void;
}