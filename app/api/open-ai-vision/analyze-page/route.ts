import { NextRequest, NextResponse } from 'next/server'
import Together from 'together-ai'
import OpenAI from 'openai'

export const maxDuration = 60

// Define response type for consistent handling
interface AnalysisResponse {
  hasReferencesHeader: boolean
  hasNewSectionStart: boolean
  hasReferences: boolean
  error?: string
}

async function analyzePage({
  togetherClient,
  openaiClient,
  visionLLM,
  imageData,
  parsedText,
  retryCount = 0
}: {
  togetherClient?: Together
  openaiClient?: OpenAI
  visionLLM: string
  imageData: string
  parsedText: string
  retryCount?: number
}): Promise<AnalysisResponse> {
  // Set max retries and timeout
  const MAX_RETRIES = 2
  const TIMEOUT_MS = 60000 // 60 seconds

  //Using the extracted text from the page (${parsedText}) and the image, analyze the content to answer the following questions in JSON format. Use both the extracted text (${parsedText}) and the image to determine the answers.
  const systemPrompt = `Analyse the image of a page and answer the following questions. 

hasReferenceHeader: This page has header with the words: \"References\", \"Bibliography\", \"Works Cited\", or synonyms thereof. It MUST be these words in a HEADER meaning on its own line.

hasNewSectionStart: A header indicating that is NOT a references section (e.g., \"Appendix\" or \"Supplementary Material\") AND references follow this header.

hasReferences: Page contains complete references such as: \"Smith, J. (2020). My paper. Journal of Papers, 1(2), 3-4.\" CRITICAL: Do not count references like Smith et al., 2020 or [1]

Note that all three three can be yes.

 Respond ONLY IN this exact JSON format without any additional text:
    {
      "hasReferencesHeader": "yes/no",
      "hasNewSectionStart": "yes/no",
      "hasReferences": "yes/no"
    }

    Response:`

  try {
    let output
    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), TIMEOUT_MS)

    try {
      // Different API call based on whether using Together AI or OpenAI
      if (visionLLM.includes('gpt-4o')) {
        if (!openaiClient) {
          throw new Error(
            'OpenAI client not initialized but GPT-4o model requested'
          )
        }

        output = await openaiClient.chat.completions.create({
          model: 'o1', //visionLLM,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: systemPrompt },
                {
                  type: 'image_url',
                  image_url: imageData.startsWith('data:')
                    ? { url: imageData } // If it's a data URL, use proper format
                    : { url: imageData } // If it's a URL, use OpenAI's format
                }
              ]
            }
          ],
          //max_tokens: 50,
          //temperature: 0.0, // Lower temperature for more consistent JSON output
          response_format: { type: 'json_object' } // Force JSON response
          //store: true // Store the message and image for history and analysis purposes
        })
      } else {
        if (!togetherClient) {
          throw new Error(
            'Together client not initialized but Together model requested'
          )
        }

        output = await togetherClient.chat.completions.create({
          model: visionLLM,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: systemPrompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageData
                  }
                }
              ]
            }
          ],
          max_tokens: 300,
          temperature: 0.1 // Lower temperature for more consistent outputs
        })
      }
    } finally {
      clearTimeout(timeoutId)
    }

    if (!output?.choices?.[0]?.message?.content) {
      throw new Error('No content in LLM response')
    }

    const content = output.choices[0].message.content.trim()
    console.log('LLM Response: VISION PAGE: ', content)

    // Handle cases where there might be extra text before or after the JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No valid JSON found in response')
    }

    const jsonContent = jsonMatch[0]
    const response = JSON.parse(jsonContent)

    // Validate that all required fields are present
    if (
      !(
        'hasReferencesHeader' in response &&
        'hasNewSectionStart' in response &&
        'hasReferences' in response
      )
    ) {
      throw new Error('Response missing required fields')
    }

    return {
      hasReferencesHeader: response.hasReferencesHeader.toLowerCase() === 'yes',
      hasNewSectionStart: response.hasNewSectionStart.toLowerCase() === 'yes',
      hasReferences: response.hasReferences.toLowerCase() === 'yes'
    }
  } catch (error) {
    // Handle retry logic
    if (retryCount < MAX_RETRIES) {
      console.warn(
        `Retry ${retryCount + 1}/${MAX_RETRIES} for analysis:`,
        (error as Error).message
      )

      // Exponential backoff
      const backoffTime = Math.pow(2, retryCount) * 1000
      await new Promise((resolve) => setTimeout(resolve, backoffTime))

      return analyzePage({
        togetherClient,
        openaiClient,
        visionLLM,
        imageData,
        parsedText,
        retryCount: retryCount + 1
      })
    }

    console.error('Analysis failed after retries:', error)
    return {
      hasReferencesHeader: false,
      hasNewSectionStart: false,
      hasReferences: false,
      error: (error as Error).message
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    // Add timeout to the overall request
    const GLOBAL_TIMEOUT = 45000 // 45 seconds
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), GLOBAL_TIMEOUT)

    try {
      const data = await request.json()
      const { filePath, parsedText, model } = data

      //console.log('Request Data:', data)

      // Input validation
      if (!filePath) {
        return NextResponse.json(
          { error: 'filePath or base64 image data is required' },
          { status: 400 }
        )
      }

      // Sanitize and validate parsedText
      const sanitizedText = typeof parsedText === 'string' ? parsedText : ''

      // Get API keys from environment variables
      const togetherApiKey = process.env.TOGETHER_API_KEY
      const openaiApiKey = process.env.OPENAI_API_KEY

      // Determine which model to use and validate
      const validModels = ['free', 'gpt-4o-mini']
      const requestedModel = validModels.includes(model) ? model : 'free'

      const visionLLM =
        requestedModel === 'free'
          ? 'meta-llama/Llama-Vision-Free'
          : 'gpt-4o-mini'

      // Initialize the appropriate client based on the model
      let togetherClient, openaiClient

      console.log('Vision LLM:', visionLLM)

      if (visionLLM.includes('gpt-4o')) {
        if (!openaiApiKey) {
          return NextResponse.json(
            { error: 'OPENAI_API_KEY is not configured' },
            { status: 500 }
          )
        }
        openaiClient = new OpenAI({
          apiKey: openaiApiKey,
          timeout: GLOBAL_TIMEOUT - 5000 // Set slightly shorter than global timeout
        })
      } else {
        if (!togetherApiKey) {
          return NextResponse.json(
            { error: 'TOGETHER_API_KEY is not configured' },
            { status: 500 }
          )
        }
        togetherClient = new Together({
          apiKey: togetherApiKey
        })
      }

      const analysis = await analyzePage({
        togetherClient,
        openaiClient,
        visionLLM,
        imageData: filePath,
        parsedText: sanitizedText
      })

      // Check if error happened during analysis
      if (analysis.error) {
        return NextResponse.json(
          {
            error: 'Analysis completed with errors',
            message: analysis.error,
            // Still include the fallback analysis results
            analysis: {
              hasReferencesHeader: analysis.hasReferencesHeader,
              isNewSectionStart: analysis.hasNewSectionStart,
              hasReferences: analysis.hasReferences
            }
          },
          { status: 207 } // 207 Multi-Status to indicate partial success
        )
      }

      return NextResponse.json(analysis)
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (error) {
    console.error('Page Analysis Error:', error)

    // Determine if it's an abort error
    const isTimeoutError = (error as Error).name === 'AbortError'

    return NextResponse.json(
      {
        error: isTimeoutError ? 'Request timed out' : 'Failed to analyze page',
        message: (error as Error).message
      },
      { status: isTimeoutError ? 504 : 500 }
    )
  }
}
