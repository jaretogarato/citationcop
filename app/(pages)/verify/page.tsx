import React from 'react'
import PDFProcessor from '@/app/components/batch/PDFProcessor'
import MultiReferenceVerifier from '@/app/components/verify-reference/MultiReferenceVerifier'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { Card, CardContent } from '@/app/components/ui/card'

export default function TabbedVerifier() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-blue-950 to-gray-900 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <Card className="bg-gray-800/50 backdrop-blur-sm border border-indigo-500/20 rounded-3xl overflow-hidden shadow-2xl shadow-indigo-500/10">
          <CardContent className="p-6">
            <Tabs defaultValue="references" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-gray-900/70 p-1">
                <TabsTrigger
                  value="references"
                  className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-gray-300 hover:text-white transition-colors"
                >
                  Copy and paste text
                </TabsTrigger>
                <TabsTrigger
                  value="pdfs"
                  className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-gray-300 hover:text-white transition-colors"
                >
                  PDF
                </TabsTrigger>
              </TabsList>

              <TabsContent value="references" className="mt-0">
                <MultiReferenceVerifier />
              </TabsContent>

              <TabsContent value="pdfs" className="mt-0">
                <PDFProcessor />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
