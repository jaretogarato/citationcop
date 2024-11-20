'use client'

import { useCounter } from '@/hooks/useCounter'

const Stats = () => {

    const refsVerified = useCounter({ end: 152847 });
    const phonyRefs = useCounter({ end: 23492 });
    const minutesSaved = useCounter({ end: 45981 });
    // Define types for number formatting
    type FormatNumberFunc = (num: number) => string;

    const formatNumber: FormatNumberFunc = (num) => {
        return new Intl.NumberFormat('en-US').format(num);
    }

    return (

        <div className="mt-20 mb-20 grid grid-cols-1 md:grid-cols-3 gap-8">
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
    )
}
export default Stats