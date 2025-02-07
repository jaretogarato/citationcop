// app/verify/page.tsx
'use client'

import React from 'react'
import PDFProcessor from '@/app/components/batch/PDFProcessor'

export default function VerifyPage(): JSX.Element {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-blue-950 to-gray-900 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Step Container */}

        <div className="bg-gray-800/50 backdrop-blur-sm border-indigo-500/20 rounded-[3rem] overflow-hidden shadow-2xl shadow-indigo-500/10">
          <PDFProcessor />
        </div>
      </div>
    </div>
  )
}
