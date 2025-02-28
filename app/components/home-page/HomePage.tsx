'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowRight, ChevronsDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import WhoItsFor from '@/app/components/home-page/WhoItsFor'
import QuickFeatures from '@/app/components/home-page/QuickFeatures'
import Stats from '@/app/components/home-page/Stats'
import ReferenceVerifier from '../verify-reference/ReferenceVerifier'

export default function HomePage(): JSX.Element {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isVerifierVisible, setIsVerifierVisible] = useState(false)
  const [isWhoItsForVisible, setIsWhoItsForVisible] = useState(false)
  const [isQuickFeaturesVisible, setIsQuickFeaturesVisible] = useState(false)

  const verifierRef = useRef<HTMLDivElement>(null)
  const whoItsForRef = useRef<HTMLDivElement>(null)
  const quickFeaturesRef = useRef<HTMLDivElement>(null)

  const handleLoading = (url: string) => {
    setIsLoading(true)
    router.push(url)
  }

  // Smooth scroll function
  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    // Create a single intersection observer for all sections
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Set the corresponding state based on the ref
          if (entry.target === verifierRef.current && entry.isIntersecting) {
            setIsVerifierVisible(true)
          } else if (
            entry.target === whoItsForRef.current &&
            entry.isIntersecting
          ) {
            setIsWhoItsForVisible(true)
          } else if (
            entry.target === quickFeaturesRef.current &&
            entry.isIntersecting
          ) {
            setIsQuickFeaturesVisible(true)
          }

          // Once visible, no need to keep observing this element
          if (entry.isIntersecting) {
            observer.unobserve(entry.target)
          }
        })
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
      }
    )

    // Observe all section refs
    if (verifierRef.current) observer.observe(verifierRef.current)
    if (whoItsForRef.current) observer.observe(whoItsForRef.current)
    if (quickFeaturesRef.current) observer.observe(quickFeaturesRef.current)

    // Cleanup
    return () => {
      if (verifierRef.current) observer.unobserve(verifierRef.current)
      if (whoItsForRef.current) observer.unobserve(whoItsForRef.current)
      if (quickFeaturesRef.current) observer.unobserve(quickFeaturesRef.current)
    }
  }, [])

  return (
    <div className="relative">
      {/* Hero Section */}
      <main className="max-w-4xl mx-auto px-8 pt-24 pb-16 text-center">
        <h1 className="text-5xl md:text-6xl font-bold mb-6">
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 inline-block text-transparent bg-clip-text">
            SourceVerify
          </span>
        </h1>

        <p className="text-xl text-indigo-300 mb-8 max-w-2xl mx-auto">
          Fast, accurate reference validation for academic writing
        </p>

        <div className="flex justify-center gap-6 mb-12">
          <button
            className={`relative px-8 py-6 text-lg font-semibold rounded-xl shadow-lg shadow-indigo-500/20 transform transition-all duration-200 group ${
              isLoading
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

        {/* Scroll indicator */}
        <div
          className="flex flex-col items-center cursor-pointer mb-8 animate-bounce"
          onClick={() => scrollToSection(verifierRef)}
        >
          {/*<p className="text-indigo-300 mb-2 text-sm">Scroll to learn more</p>*/}
          <ChevronsDown className="w-6 h-6 text-indigo-400" />
        </div>

        <div
          ref={verifierRef}
          className={`transition-all duration-700 transform ${
            isVerifierVisible
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-16'
          }`}
        >
          <div className="mb-16">
            <ReferenceVerifier />
          </div>
        </div>

        <div
          ref={quickFeaturesRef}
          className={`transition-all duration-700 transform ${
            isQuickFeaturesVisible
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-16'
          } mb-12`}
        >
          <QuickFeatures />
        </div>

        <div
          ref={whoItsForRef}
          className={`transition-all duration-700 transform ${
            isWhoItsForVisible
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-16'
          } `}
        >
          <WhoItsFor />
        </div>
      </main>
    </div>
  )
}
