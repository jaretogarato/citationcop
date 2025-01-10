'use client'

import React, { useState, useEffect, useRef } from 'react'
import { PDFQueueService } from '@/app/services/queue-service'
import { Upload, FileText, CheckCircle, XCircle, Loader } from 'lucide-react'

const PDFProcessor = () => {
  const [status, setStatus] = useState({
    pending: 0,
    processing: 0,
    complete: 0,
    error: 0
  });
  const queueServiceRef = useRef(null);

  useEffect(() => {
    // Initialize the queue service
    queueServiceRef.current = new PDFQueueService('/worker.js');

    // Poll for status updates
    const interval = setInterval(() => {
      if (queueServiceRef.current) {
        setStatus(queueServiceRef.current.getStatus());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleFileSelect = (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      queueServiceRef.current.addPDFs(Array.from(files));
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <label
          htmlFor="pdf-upload"
          className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Upload className="w-8 h-8 mb-2 text-gray-500" />
            <p className="mb-2 text-sm text-gray-500">
              <span className="font-semibold">Click to upload</span> or drag and
              drop
            </p>
            <p className="text-xs text-gray-500">PDF files only</p>
          </div>
          <input
            id="pdf-upload"
            type="file"
            className="hidden"
            multiple
            accept=".pdf"
            onChange={handleFileSelect}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center p-4 bg-gray-50 rounded-lg">
          <FileText className="w-6 h-6 text-blue-500 mr-2" />
          <div>
            <p className="text-sm font-medium">Pending</p>
            <p className="text-2xl font-bold">{status.pending}</p>
          </div>
        </div>

        <div className="flex items-center p-4 bg-gray-50 rounded-lg">
          <Loader className="w-6 h-6 text-yellow-500 mr-2 animate-spin" />
          <div>
            <p className="text-sm font-medium">Processing</p>
            <p className="text-2xl font-bold">{status.processing}</p>
          </div>
        </div>

        <div className="flex items-center p-4 bg-gray-50 rounded-lg">
          <CheckCircle className="w-6 h-6 text-green-500 mr-2" />
          <div>
            <p className="text-sm font-medium">Complete</p>
            <p className="text-2xl font-bold">{status.complete}</p>
          </div>
        </div>

        <div className="flex items-center p-4 bg-gray-50 rounded-lg">
          <XCircle className="w-6 h-6 text-red-500 mr-2" />
          <div>
            <p className="text-sm font-medium">Error</p>
            <p className="text-2xl font-bold">{status.error}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PDFProcessor;
