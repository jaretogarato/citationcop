'use client'

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import WhoItsFor from '@/app/components/home-page/WhoItsFor'
import QuickFeatures from '@/app/components/home-page/QuickFeatures'
import Stats from '@/app/components/home-page/Stats'



export default function HomePage(): JSX.Element {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLoading = (url: string) => {
    setIsLoading(true);
    router.push(url);
  };

  return (
    <div>
      {/* Hero Section */}
      <main className="max-w-4xl mx-auto px-8 pt-24 pb-16 text-center">
        <h1 className="text-5xl md:text-6xl font-bold mb-6">
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 inline-block text-transparent bg-clip-text">
            SourceVerify
          </span>
        </h1>

        <p className="text-xl text-indigo-300 mb-12 max-w-2xl mx-auto">
          Fast, accurate reference validation for academic writing
        </p>

        <div className="flex justify-center gap-6">

          <button
            className={`relative px-8 py-6 text-lg font-semibold rounded-xl shadow-lg shadow-indigo-500/20 transform transition-all duration-200 group ${isLoading
              ? 'bg-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white'
              }`}
            onClick={() => handleLoading('/verify')}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 border-2 border-t-2 border-t-white border-indigo-300 rounded-full animate-spin"></span>
                Loading...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Give it a go
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </span>
            )}
          </button>
        </div>

        <Stats />

        <WhoItsFor />

        <QuickFeatures />

      </main>
    </div>
  );
}
