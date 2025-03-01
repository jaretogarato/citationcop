// app/api/references/extract/route.ts
import OpenAI from 'openai'
import { NextResponse } from 'next/server'

export const maxDuration = 300 // Increased to 5 minutes (300 seconds)
export const runtime = 'edge'

const openAI = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const model = process.env.LLM_MODEL_ID || 'o3-mini' // 'gpt-4o-mini'

const REFERENCE_EXTRACTION_PROMPT = `Your role is to precisely extract references from the following text. ONLY INCLUDE INFORMATION THAT IS ON THE TEXT. Provide information found the following JSON format:

{
  "references": [
    {
      "authors": ["author name 1", "author name 2"],
      "type": "type of reference (e.g., journal article, conference paper, etc.)",
      "title": "title of the reference",
      "journal": "journal name if applicable",
      "year": "year of publication",
      "DOI": "DOI if available",
      "publisher": "publisher name if available",
      "volume": "volume number if available",
      "issue": "issue number if available",
      "pages": "page range if available",
      "conference": "conference name if applicable",
      "url": "ONLY if URL Is given AND starts with https:// or www. otherwise leave blank",
      "date_of_access": "date of access if applicable, will come after url"
      "raw": the raw text of the reference itself. This is the text that was parsed to create this reference.
    }
  ]
}

It is OK to have 0 references found.

Text:

{text}

References (in JSON format):`

// Configuration for retries
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000 // Start with 1 second delay

/**
 * Sleep function for implementing delay between retries
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Makes a request to OpenAI with exponential backoff retry logic
 */
async function makeOpenAIRequestWithRetry(text: string) {
  let attempt = 0
  let lastError: Error | null = null
  
  while (attempt < MAX_RETRIES) {
    try {
      const llmStartTime = performance.now()
      
      const response = await openAI.chat.completions.create({
        model: model,
        messages: [
          {
            role: 'user',
            content: REFERENCE_EXTRACTION_PROMPT.replace('{text}', text)
          }
        ],
        temperature: 0,
        response_format: { type: 'json_object' }
      })
      
      const llmEndTime = performance.now()
      const llmTime = llmEndTime - llmStartTime
      
      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('Empty response from OpenAI')
      }
      
      const result = JSON.parse(content)
      return { result, llmTime }
    } catch (error) {
      attempt++
      lastError = error instanceof Error ? error : new Error('Unknown error')
      
      if (attempt >= MAX_RETRIES) {
        break
      }
      
      // Exponential backoff with jitter
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1) * (0.5 + Math.random())
      console.log(`Retry attempt ${attempt}/${MAX_RETRIES} after ${delay.toFixed(0)}ms: ${lastError.message}`)
      await sleep(delay)
    }
  }
  
  throw lastError || new Error('Failed after multiple retries')
}

export async function POST(request: Request) {
  const startTime = performance.now()
  const metrics = {
    inputLength: 0,
    referencesFound: 0,
    attempts: 0,
    totalTime: 0,
    llmTime: 0
  }

  try {
    const { text } = await request.json()
    
    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }
    
    metrics.inputLength = text.length
    
    const { result, llmTime } = await makeOpenAIRequestWithRetry(text)
    metrics.llmTime = llmTime
    metrics.referencesFound = result.references?.length || 0
    
    const endTime = performance.now()
    metrics.totalTime = endTime - startTime
    
    console.log(`📊 Reference extraction successful:
      Total time: ${metrics.totalTime.toFixed(2)}ms
      LLM time: ${metrics.llmTime.toFixed(2)}ms
      Input length: ${metrics.inputLength} chars
      References found: ${metrics.referencesFound}`)
    
    return NextResponse.json({
      ...result,
      _metadata: {
        processingTimeMs: metrics.totalTime,
        llmTimeMs: metrics.llmTime,
        inputLength: metrics.inputLength
      }
    })
  } catch (error) {
    const endTime = performance.now()
    metrics.totalTime = endTime - startTime
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to extract references'
    
    console.error(`❌ Reference extraction failed:
      Error: ${errorMessage}
      Total time: ${metrics.totalTime.toFixed(2)}ms
      Input length: ${metrics.inputLength} chars`)
    
    return NextResponse.json({
      error: errorMessage,
      _metadata: {
        processingTimeMs: metrics.totalTime,
        inputLength: metrics.inputLength,
        status: 'failed'
      }
    }, { status: 500 })
  }
}