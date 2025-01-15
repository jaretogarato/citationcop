import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import type { Reference } from '@/app/types/reference'

const API_KEYS = [
  process.env.OPENAI_API_KEY_1,
  process.env.OPENAI_API_KEY_2,
  process.env.OPENAI_API_KEY_3
].filter((key): key is string => {
  if (!key) {
    console.warn('Missing OpenAI API key')
    return false
  }
  return true
})

// Configuration for exponential backoff
const INITIAL_RETRY_DELAY = 1000 // 1 second
const MAX_RETRY_DELAY = 32000 // 32 seconds
const BACKOFF_FACTOR = 2

// Helper function to calculate delay with jitter
const calculateBackoffDelay = (attempt: number): number => {
  const delay = Math.min(
    INITIAL_RETRY_DELAY * Math.pow(BACKOFF_FACTOR, attempt),
    MAX_RETRY_DELAY
  )
  // Add random jitter of up to 25% of the delay
  return delay + Math.random() * delay * 0.25
}

// Helper function to handle the delay
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const openAIInstances = API_KEYS.map((apiKey) => new OpenAI({ apiKey }))
const model = process.env.LLM_MODEL_ID || 'gpt-4o-mini'

export async function POST(request: Request) {
  try {
    const {
      reference,
      searchResults,
      keyIndex,
      maxRetries = 5 // Increased default retries for rate limit handling
    } = await request.json()

    if (!reference || !searchResults) {
      return NextResponse.json(
        { error: 'Reference and searchResults are required' },
        { status: 400 }
      )
    }

    if (keyIndex >= openAIInstances.length) {
      return NextResponse.json({ error: 'Invalid key index' }, { status: 400 })
    }

    const openAI = openAIInstances[keyIndex]
    const startTime = Date.now()
    //const reference_string = reference.raw

    const prompt = `You are a machine that checks references/citations and uncovers false references in writing...` // [rest of prompt remains the same]

    let lastError: Error | null = null as Error | null

    // Enhanced retry loop with exponential backoff
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await openAI.chat.completions.create({
          model: model,
          messages: [{ role: 'system', content: prompt }],
          temperature: 0.0,
          response_format: { type: 'json_object' }
        })

        const content = response.choices[0]?.message?.content

        if (!content) {
          console.warn(`Attempt ${attempt + 1}: No content received from LLM`)
          const delay = calculateBackoffDelay(attempt)
          await sleep(delay)
          continue
        }

        try {
          const result = JSON.parse(content)

          if (
            !['verified', 'unverified', 'error'].includes(result.status) ||
            typeof result.message !== 'string'
          ) {
            console.warn(`Attempt ${attempt + 1}: Invalid response structure`)
            const delay = calculateBackoffDelay(attempt)
            await sleep(delay)
            continue
          }

          console.log(
            `Reference verified in ${Date.now() - startTime}ms with key ${keyIndex}`
          )
          return NextResponse.json(result)
        } catch (parseError) {
          console.warn(
            `Attempt ${attempt + 1}: JSON parsing failed:`,
            parseError instanceof Error
              ? parseError.message
              : 'Unknown parsing error'
          )
          lastError =
            parseError instanceof Error
              ? parseError
              : new Error('Unknown parsing error')
          if (attempt < maxRetries) {
            const delay = calculateBackoffDelay(attempt)
            await sleep(delay)
            continue
          }
        }
      } catch (error) {
        const isRateLimit =
          error instanceof Error &&
          (('status' in error && error.status === 429) ||
            error.message.includes('429') ||
            error.message.toLowerCase().includes('rate limit'))

        if (isRateLimit) {
          console.warn(`Rate limit hit on attempt ${attempt + 1}`)
          if (attempt < maxRetries) {
            const delay = calculateBackoffDelay(attempt)
            console.log(`Backing off for ${delay}ms before retry`)
            await sleep(delay)
            continue
          }
        }

        console.warn(
          `Attempt ${attempt + 1}: Request failed:`,
          error instanceof Error ? error.message : 'Unknown error'
        )
        lastError = error instanceof Error ? error : new Error('Unknown error')

        if (attempt < maxRetries) {
          const delay = calculateBackoffDelay(attempt)
          await sleep(delay)
          continue
        }
      }
    }

    // If we've exhausted all retries, return an error result
    console.error(
      'All verification attempts failed. Last error:',
      lastError?.message
    )
    return NextResponse.json(
      {
        status: 'error',
        message: `Verification failed after ${maxRetries + 1} attempts. Last error: ${lastError?.message}`
      },
      { status: 500 }
    )
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
