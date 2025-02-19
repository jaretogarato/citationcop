import React from 'react'
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/app/components/ui/accordion'

type TokenUsage = {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

type TokenPricingProps = {
  tokenUsage: TokenUsage
}

export default function TokenPricing({ tokenUsage }: TokenPricingProps) {
  return (
    <AccordionItem value="usage">
      <AccordionTrigger className="text-gray-100 text-left">
        View Token Usage
      </AccordionTrigger>
      <AccordionContent>
        <div className="bg-gray-800/50 p-4 rounded-xl space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-300">Prompt Tokens:</span>
                <span className="text-gray-200 font-mono">
                  {tokenUsage.prompt_tokens}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Cost ($1.10/M):</span>
                <span className="text-gray-300 font-mono">
                  ${((tokenUsage.prompt_tokens / 1000000) * 1.1).toFixed(6)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-300">Completion Tokens:</span>
                <span className="text-gray-200 font-mono">
                  {tokenUsage.completion_tokens}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Cost ($4.40/M):</span>
                <span className="text-gray-300 font-mono">
                  ${((tokenUsage.completion_tokens / 1000000) * 4.4).toFixed(6)}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-2 mt-4">
            <div className="flex justify-between">
              <span className="text-gray-300">Total Tokens:</span>
              <span className="text-gray-200 font-mono">
                {tokenUsage.total_tokens}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Total Cost:</span>
              <span className="text-gray-300 font-mono">
                $
                {(
                  (tokenUsage.prompt_tokens / 1000000) * 1.1 +
                  (tokenUsage.completion_tokens / 1000000) * 4.4
                ).toFixed(6)}
              </span>
            </div>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
