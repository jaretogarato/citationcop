import { NextResponse } from 'next/server'
import OpenAI from 'openai'
//import type { Reference } from '@/types/reference'

//export const maxDuration = 300

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

const openAIInstances = API_KEYS.map((apiKey) => new OpenAI({ apiKey }))
const model = process.env.LLM_MODEL_ID || 'gpt-4o-mini'

async function fetchUrlContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ReferenceValidator/1.0)',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`)
    }

    // Get the content type from headers
    const contentType = response.headers.get('content-type') || ''

    // Check if we're dealing with text content
    if (
      !contentType.includes('text/html') &&
      !contentType.includes('text/plain') &&
      !contentType.includes('application/json')
    ) {
      throw new Error('Unsupported content type: ' + contentType)
    }

    // Get the raw text content
    const rawContent = await response.text()

    // Basic HTML cleaning - remove scripts, styles, and HTML tags
    const cleanContent = rawContent
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove styles
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
      .replace(/&[a-z]+;/gi, '') // Remove other HTML entities
      .trim()
      .slice(0, 15000) // Limit content length for OpenAI

    if (!cleanContent) {
      throw new Error('No readable content found on page')
    }
    //console.log('Content fetched:', cleanContent)
    return cleanContent
  } catch (error) {
    console.error('Error fetching URL:', error)
    throw new Error(
      `Failed to fetch URL content: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function POST(request: Request) {
  try {
    const { reference, maxRetries = 0 } = await request.json()

    /// MAX RETRIES SET

    if (!reference || !reference.url) {
      return NextResponse.json(
        { error: 'Reference with URL is required' },
        { status: 400 }
      )
    }

    // Use the first API key for URL verification
    const openAI = openAIInstances[0]
    //const startTime = Date.now()

    // Fetch the URL content
    let webContent: string
    try {
      webContent = await fetchUrlContent(reference.url)
    } catch (error) {
      return NextResponse.json({
        status: 'error',
        message: `Failed to fetch URL content: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    }

    const prompt = `You are a reference validation system analyzing webpage content to verify citations.

Reference to verify: "${reference.raw}"

URL being checked: ${reference.url}

Webpage content excerpt: "${webContent.substring(0, 2500)}"

Compare the reference against the webpage content and determine if the reference is accurate. If it is the reference, then the status should be "verified". If the reference is not found or is incorrect, the status should be "error".

Answer in the following JSON format:
{
  "status": "verified | error",
  "message": "Detailed explanation of the verification result",
}`

    let lastError: Error | null = null

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
          continue
        }

        try {
          const result = JSON.parse(content)
          //console.log(`result: ${result.status}, ${result.message}`)

          // Validate the response structure
          if (
            !result ||
            typeof result !== 'object' ||
            !['verified', 'unverified', 'error'].includes(result.status) ||
            typeof result.message !== 'string'
          ) {
            console.warn(
              `Attempt ${attempt + 1}: Invalid response structure:`,
              result
            )
            continue
          }

          //console.log(`URL content verified in ${Date.now() - startTime}ms`)
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
            await new Promise((resolve) => setTimeout(resolve, 1000))
            continue
          }
        }
      } catch (error) {
        console.warn(
          `Attempt ${attempt + 1}: Request failed:`,
          error instanceof Error ? error.message : 'Unknown error'
        )
        lastError = error instanceof Error ? error : new Error('Unknown error')

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
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
        message: `URL verification failed after ${maxRetries + 1} attempts. Last error: ${(lastError as Error)?.message}`
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
