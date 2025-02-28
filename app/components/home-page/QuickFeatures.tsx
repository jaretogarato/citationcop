import { CheckCircle } from 'lucide-react'

const QuickFeatures = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 text-center">
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
        <p className="text-indigo-300">
          AI enabled with an explanation of its reasoning
        </p>
      </div>
      <div className="flex flex-col items-center">
        <div className="bg-amber-500/10 p-3 rounded-full mb-4">
          <CheckCircle className="w-6 h-6 text-amber-400" />
        </div>
        <h3 className="text-white font-semibold mb-2">Repairs References</h3>
        <p className="text-indigo-300">
          Fixes references with missing or incorrect information
        </p>
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
      <div className="flex flex-col items-center">
        <div className="bg-teal-500/10 p-3 rounded-full mb-4">
          <CheckCircle className="w-6 h-6 text-teal-400" />
        </div>
        <h3 className="text-white font-semibold mb-2">Easy to Use</h3>
        <p className="text-indigo-300">
          Simple interface with no learning curve
        </p>
      </div>
    </div>
  )
}

export default QuickFeatures
