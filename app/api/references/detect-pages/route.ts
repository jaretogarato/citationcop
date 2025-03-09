// app/api/references/extract/route.ts
import OpenAI from 'openai'
import { NextResponse } from 'next/server'

export const maxDuration = 300 // Increased to 5 minutes (300 seconds)
export const runtime = 'edge'

const openAI = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

//const model = process.env.LLM_MODEL_ID || 'o3-mini' // or 'gpt-4o-mini'
const model = 'o3-mini'
/**
 * Prompt instructs the LLM to examine the document text, which includes page breaks
 * indicated by "Page <number>:", and to return a JSON object listing the pages where
 * a references section is found. The references section is detected by a header line
 * containing "Bibliography", "References", or "Works Cited".
 */
const REFERENCES_PAGE_DETECTION_PROMPT = `Your task is to analyze the following text extracted from a PDF document.
Each page in the text is denoted by "Page <number>:" at the start.
Identify which pages contain a references section. A references section is indicated by a header line that includes a keyword such as: "Bibliography", "References", or "Works Cited".

CRITICAL: 
1) Only included pages that contain references. If there is just a References header but no references themselves, do not include the page.
2) References sections usually appear at the end of a document, but this is not always the case.
3) References are often numbered or in alphabetical order, so make sure the section appears complete.

Return a JSON object with a key "references" whose value is an array of page numbers.
For example, if references start on page 4 and continues to page 6, return {"references": [4,6]}. If no references section is found, return {"references": []}.

Text:
{text}

References (in JSON format):`

// Configuration for retries
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000 // Start with 1 second delay

/**
 * Sleep function for implementing delay between retries
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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
            content: REFERENCES_PAGE_DETECTION_PROMPT.replace('{text}', text)
          }
        ],
        //temperature: 0,
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
      const delay =
        RETRY_DELAY_MS * Math.pow(2, attempt - 1) * (0.5 + Math.random())
      console.log(
        `Retry attempt ${attempt}/${MAX_RETRIES} after ${delay.toFixed(0)}ms: ${lastError.message}`
      )
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

    console.log(`📊 Reference page detection successful:
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

    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Failed to detect reference pages'

    console.error(`❌ Reference page detection failed:
      Error: ${errorMessage}
      Total time: ${metrics.totalTime.toFixed(2)}ms
      Input length: ${metrics.inputLength} chars`)

    return NextResponse.json(
      {
        error: errorMessage,
        _metadata: {
          processingTimeMs: metrics.totalTime,
          inputLength: metrics.inputLength,
          status: 'failed'
        }
      },
      { status: 500 }
    )
  }
}
