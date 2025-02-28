import { NextResponse } from 'next/server'
import OpenAI from 'openai'
//import type { Reference } from '@/app/types/reference'

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

// switching to trained model first choice.
const model =
  process.env.LLM_MODEL_VERIFY_ID || process.env.LLM_MODEL_ID || 'gpt-4o-mini'

export async function POST(request: Request) {
  try {
    const {
      reference,
      searchResults,
      keyIndex,
      maxRetries = 5
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

    //const reference_string = constructGoogleSearchString(reference)

    // FOR NOW JUST GOING WITH THE RAW TEXT FROM THE PAPER!
    const reference_string = reference.raw

    //console.log(`reference_string: ${reference_string}`);

    /*const reference_string = [
      reference.authors?.join(' '),
      reference.title,
      reference.journal,
      reference.year,
      reference.volume,
      reference.pages,
      reference.publisher,
      reference.conference,
      reference.date_of_access,
      reference.issue,
    ]
      .filter((field) => field !== null && field !== undefined)
      .join(' ');*/

    const prompt = `You are a machine that checks references/citations and uncovers false references in writing. Given the following search results, determine whether the provided reference refers to an actual article, conference paper, blog post, or other. Only use the information from the search results to determine the validity of the reference.
    
    A reference status is:
    - verified if multiple search results confirms its validity
    - unverified if there is no evidence of its existance
    - error if there are some things that suggest that perhaps the reference is has some missing or incorrect info that a human should verify. All references must have a title and authors as a minimum. If not, status should be error

    Reference: ${reference_string}

   Google Search Results: ${formatSearchResults(searchResults)}

    Answer in the following JSON format:
    {
      "status": "verified | unverified | error", 
      "message": "Explain how the search results verify or not the given reference. Include links that support your conclusion.",
    }`

    console.log(`prompt: ${prompt}`)
    let lastError: Error | null = null as Error | null

    // Retry loop
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

          /*console.log(
            `Reference verified in ${Date.now() - startTime}ms with key ${keyIndex}`
          )*/
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
            //console.log(`Backing off for ${delay}ms before retry`)
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

function formatSearchResults(searchResults: any) {
  try {
    const formattedResults = (searchResults.organic || []).map(
      (result: any) => ({
        title: result.title,
        link: result.link,
        snippet: result.snippet,
        date: result.date || null
      })
    )
    return JSON.stringify(formattedResults, null, 2)
  } catch (error) {
    console.warn('Error formatting search results:', error)
    return JSON.stringify([])
  }
}
