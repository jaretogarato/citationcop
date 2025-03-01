import { NextResponse } from 'next/server'
import Together from 'together-ai'

const apiKey = process.env.TOGETHER_API_KEY
const model = 'deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free'

// Configuration for exponential backoff
const INITIAL_RETRY_DELAY = 1000 // 1 second
const MAX_RETRY_DELAY = 32000 // 32 seconds
const BACKOFF_FACTOR = 2

const together = new Together({ apiKey })

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

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Together API key is required' },
        { status: 400 }
      )
    }

    const startTime = Date.now()

    const reference_string = reference.raw

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
      "message": "Mention the key points taken into consideration to determine the status. Include links that support your conclusion.",
    }`

    //console.log(`prompt: ${prompt}`)
    let lastError: Error | null = null as Error | null

    // Retry loop
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await together.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: model,
          max_tokens: 1500,
          temperature: 0.0,
          top_p: 0.7,
          top_k: 50,
          repetition_penalty: 1,
          stop: ['<｜end▁of▁sentence｜>']
        })

        const content = response.choices[0]?.message?.content
        //console.log(`Content: ${content}`)
        if (!content) {
          console.warn(`Attempt ${attempt + 1}: No content received from LLM`)
          const delay = calculateBackoffDelay(attempt)
          await sleep(delay)
          continue
        }

        try {
          //const result = JSON.parse(content)
          const result = parseResponse(content);
          //console.log(`Restuls: ${result}`)
          if (
            !['verified', 'unverified', 'error'].includes(result.status) ||
            typeof result.message !== 'string'
          ) {
            console.warn(`Attempt ${attempt + 1}: Invalid response structure`)
            const delay = calculateBackoffDelay(attempt)
            await sleep(delay)
            continue
          }

          //console.log(
          //  `Reference verified in ${Date.now() - startTime}ms with key ${keyIndex}`
         // )
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
          (error.message.includes('429') ||
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

function parseResponse(content: string): any {
  try {
    // Find the JSON part by looking for content between ```json and ```
    const jsonMatch = content.match(/```json\s*(\{[\s\S]*?\})\s*```/)
    if (jsonMatch && jsonMatch[1]) {
      return JSON.parse(jsonMatch[1])
    }

    // If no ```json block found, try to find any valid JSON object
    const jsonRegex = /(\{[\s\S]*?\})/g
    const matches = content.match(jsonRegex)
    if (matches) {
      // Try each match until we find valid JSON
      for (const match of matches) {
        try {
          const parsed = JSON.parse(match)
          if (parsed.status && parsed.message) {
            return parsed
          }
        } catch (e) {
          continue
        }
      }
    }

    throw new Error('No valid JSON found in response')
  } catch (error) {
    throw error
  }
}
