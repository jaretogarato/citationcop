import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { X } from 'lucide-react'
import { useEffect, useState } from 'react'

export function NoReferencesAlert() {
  const [show, setShow] = useState(true)
  const [opacity, setOpacity] = useState(1)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setOpacity(0), 9000)
    const hideTimer = setTimeout(() => setShow(false), 10000)
    
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(hideTimer)
    }
  }, [])

  if (!show) return null

  return (
    <Alert 
      variant="default" 
      className="mt-6 bg-gradient-to-r from-indigo-600 to-purple-600 border-indigo-500 transition-opacity duration-1000 relative"
      style={{ opacity }}
    >
      <button 
        onClick={() => setShow(false)}
        className="absolute top-4 right-4 text-gray-300 hover:text-white transition-all duration-300 hover:scale-110"
      >
        <X className="w-5 h-5 animate-[pulse_3s_ease-in-out_infinite]" />
      </button>
      <AlertTitle className="text-2xl font-bold text-white">No References Found</AlertTitle>
      <AlertDescription className="mt-3 text-lg text-gray-200">
        Hmm, I've tried multiple methods to extract references from your document but couldn't find any citations in a standard format. 
        <ul className="mt-3 space-y-2 list-disc list-inside">
          <li>Check if your document contains citations</li>
          <li>Try copying and pasting the references section directly</li>
        </ul>
      </AlertDescription>
    </Alert>
  )
}