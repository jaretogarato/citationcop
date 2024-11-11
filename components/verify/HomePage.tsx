'use client';

import { useState } from 'react';
import { ArrowRight, CheckCircle } from 'lucide-react';
import { useCounter } from '@/hooks/useCounter';
import { useRouter } from 'next/navigation';

// Define types for number formatting
type FormatNumberFunc = (num: number) => string;

export default function HomePage(): JSX.Element {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const refsVerified = useCounter({ end: 152847 });
  const phonyRefs = useCounter({ end: 23492 });
  const minutesSaved = useCounter({ end: 45981 });

  const formatNumber: FormatNumberFunc = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const handleSignUp = () => {
    router.push('/signup');
  };

  const handleLogin = () => {
    router.push('/verify');
  };

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
          {/*<a
            className="relative px-8 py-6 text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl shadow-lg shadow-indigo-500/20 transform hover:scale-105 transition-all duration-200 group"
            href="/verify"
          >
            <span className="flex items-center gap-2">
              Give it a go
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </span>
          </a> */}
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

        {/* Stats Section */}
        <div className="mt-24 mb-24 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 transform hover:scale-105 transition-all duration-200 border border-indigo-500/20">
            <div className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 inline-block text-transparent bg-clip-text mb-2">
              {formatNumber(refsVerified)}
            </div>
            <div className="text-indigo-300">References Verified</div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 transform hover:scale-105 transition-all duration-200 border border-indigo-500/20">
            <div className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 inline-block text-transparent bg-clip-text mb-2">
              {formatNumber(phonyRefs)}
            </div>
            <div className="text-indigo-300">Phony References Caught</div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 transform hover:scale-105 transition-all duration-200 border border-indigo-500/20">
            <div className="text-3xl font-bold bg-gradient-to-r from-pink-400 to-rose-400 inline-block text-transparent bg-clip-text mb-2">
              {formatNumber(minutesSaved)}
            </div>
            <div className="text-indigo-300">Minutes Saved</div>
          </div>
        </div>

        {/* Quick Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div className="flex flex-col items-center">
            <div className="bg-indigo-500/10 p-3 rounded-full mb-4">
              <CheckCircle className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-white font-semibold mb-2">Fast</h3>
            <p className="text-indigo-300">Verifies references in seconds</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="bg-purple-500/10 p-3 rounded-full mb-4">
              <CheckCircle className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-white font-semibold mb-2">Accurate</h3>
            <p className="text-indigo-300">AI enabled with an explanation of its reasoning</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="bg-pink-500/10 p-3 rounded-full mb-4">
              <CheckCircle className="w-6 h-6 text-pink-400" />
            </div>
            <h3 className="text-white font-semibold mb-2">Saves Time</h3>
            <p className="text-indigo-300">
              It does the boring work so you can focus on the important stuff
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
