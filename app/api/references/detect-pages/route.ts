import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { RefPagesResult } from '@/app/types/reference'
import { logTokenUsage } from '@/app/lib/usage-logger'

export const maxDuration = 300 // 5 minutes

const openAI = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const MODEL_NAME = 'o3-mini'
const API_ENDPOINT = 'references/detect-pages'

const REFERENCES_PAGE_DETECTION_PROMPT = `Your task is to analyze the following text extracted from a PDF document.
Each page in the text is denoted by "Page <number>:" at the start.
Identify which pages contain a references section. A references section is indicated by a header line that includes a keyword such as: "Bibliography", "References", or "Works Cited".

CRITICAL: 
1) Only include pages that contain references. If there is just a References header but no references themselves, do not include the page.
2) References sections usually appear at the end of a document, but this is not always the case.
3) References are often numbered or in alphabetical order, so make sure the section appears complete.

Return a JSON object with a key "pages" whose value is an array of page numbers.
For example, if references are found on pages 4, 5, and 6, return:
{
  "pages": [4, 5, 6]
}
If no references section is found, return:
{
  "pages": []
}

Text:
{text}

References (in JSON format):`

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function makeOpenAIRequestWithRetry(
  text: string
): Promise<{ pages: number[] }> {
  let attempt = 0
  let lastError: Error | null = null

  //console.log('Document', text)

  while (attempt < MAX_RETRIES) {
    try {
      //console.log(
      //  `Requesting page detection from ${MODEL_NAME} (Attempt ${attempt + 1}) for ${API_ENDPOINT}`
      //)

      const response = await openAI.chat.completions.create({
        model: MODEL_NAME,
        messages: [
          {
            role: 'user',
            content: REFERENCES_PAGE_DETECTION_PROMPT.replace('{text}', text)
          }
        ],
        response_format: { type: 'json_object' }
      })

      // --- Log Token Usage ---
      if (response.usage) {
        //console.log('OpenAI Usage Data:', response.usage)
        // Call logTokenUsage asynchronously (don't await) and catch errors
        logTokenUsage({
          modelName: MODEL_NAME,
          totalTokens: response.usage.total_tokens,
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          apiEndpoint: API_ENDPOINT
        }).catch((err) => {
          console.error(`Error logging token usage for ${API_ENDPOINT}:`, err)
        })
      } else {
        console.warn(
          `Warning: OpenAI response for ${API_ENDPOINT} did not include usage data.`
        )
      }
      // --- End Log Token Usage ---

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('Empty response from OpenAI')
      }

      const result = JSON.parse(content)
      const pages: number[] = result.pages || []
      //console.log('Detected reference pages:', pages)
      return { pages }
    } catch (error) {
      attempt++
      lastError = error instanceof Error ? error : new Error('Unknown error')
      if (attempt >= MAX_RETRIES) break
      const delay =
        RETRY_DELAY_MS * Math.pow(2, attempt - 1) * (0.5 + Math.random())
      //console.log(
      //  `Retry attempt ${attempt}/${MAX_RETRIES} after ${delay.toFixed(0)}ms: ${lastError.message}`
      //)
      await sleep(delay)
    }
  }

  throw lastError || new Error('Failed after multiple retries')
}

export async function POST(request: Request) {
  try {
    const { text } = await request.json()

    // Call the LLM to detect reference pages
    const { pages } = await makeOpenAIRequestWithRetry(text)

    const rawTextArray = pages.map(() => '')
    // Prepare imageData as empty strings (to be added later)
    const imageDataArray = pages.map(() => '')

    const finalResult: RefPagesResult = {
      pages,
      rawText: rawTextArray,
      imageData: imageDataArray
    }
    console.log('Final result:', finalResult)

    return NextResponse.json(finalResult)
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Failed to detect reference pages'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
