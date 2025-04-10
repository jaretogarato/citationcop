import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { ChatCompletionMessageParam } from 'openai/resources/chat'
import { referencePageDetectionTools } from '@/app/lib/reference-tools'

export const maxDuration = 300

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: Request) {
  try {
    const {
      pageImage,
      pageNumber,
      totalPages,
      iteration = 0,
      previousMessages = [],
      functionResult = null,
      lastToolCallId = null
    } = await request.json()

    /*console.log(
      `Reference page detection iteration ${iteration} for page ${pageNumber}/${totalPages}`
    )*/

    // Build the conversation messages
    let messages: ChatCompletionMessageParam[] = []

    if (previousMessages && previousMessages.length > 0) {
      messages = [...previousMessages]
      // Include tool result from previous iteration if available
      if (functionResult && lastToolCallId) {
        messages.push({
          role: 'tool',
          tool_call_id: lastToolCallId,
          content: JSON.stringify(functionResult)
        })
      }
    } else {
      messages = [
        {
          role: 'system',
          content: `Your task is to identify the pages that include the REFERENCES SECTION. When you find the Reference section header, return the results. 

          INSTRUCTIONS:
          1) Look at a page starting from the back of the document and identify the pages with references
          2) FIND THE REFERENCE HEADER. A references section will start with a header like "References" or "Bibliography" and includes a list of citations. Return the final answer when you have found the reference header.
          
          TOOLS: If you having yet found the header, use the "earlier_page" tool to retrieve the page before it 
          
CRITICAL: YOU ARE LOOKING FOR A REFERENCE HEADER. A references section starts with a header like "References" or "Bibliography" followed by a list of citations. **Return the final answer when you have found the reference header.** To help find the reference header, pay attention to reference numbering or the alphabetical order. The refernece header will typically come just before [1] or A. **

WHEN YOU FIND THE REFECENCE HEADER, RETURN THE FINAL ANSWER, DO NOT ASK FOR A earlier_page TOOL CALL.
          
Your final answer must be a JSON object with a key "references" that maps to an array of page numbers starting with the baginning of the references section, and going until the end, e.g., {"references": [12, 13, 14]}. Do not include any additional keys or explanatory text.

Do not include any other pages that are not part of the references section. IF another section starts, like APPENDIX, that has references, DO NOT INCLUDE IT.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `This is page ${pageNumber} of ${totalPages}.`
            },
            {
              type: 'image_url',
              image_url: { url: pageImage }
            }
          ]
        }
      ]
    }

    // Debug: log the message size
    const messagesSize = JSON.stringify(messages).length
    //console.log(`Messages size: ${Math.round(messagesSize / 1024)} KB`)

    // Set up retry mechanism
    const maxRetries = 3
    let retries = 0
    let finalMessage: any = null
    let tokenUsage: any = null

    while (retries < maxRetries) {
      const completion = await openai.chat.completions.create({
        model: 'o1',
        messages,
        tools: referencePageDetectionTools,
        store: true,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'referenceSchema',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                references: { type: 'array', items: { type: 'number' } }
              },
              additionalProperties: false,
              required: ['references']
            }
          }
        }
      })

      finalMessage = completion.choices[0].message
      tokenUsage = completion.usage
      //console.log('LLM Response received : ', finalMessage)
      //console.log('TOols call : ', finalMessage.tool_calls)

      // If the response includes tool calls, accept it as valid.
      if (finalMessage.tool_calls && finalMessage.tool_calls.length > 0) {
        break
      }

      // If content exists, try to parse it as JSON.
      if (finalMessage.content) {
        try {
          JSON.parse(finalMessage.content)
          break // Valid JSON received; break out.
        } catch (parseError) {
          retries++
          console.error(
            `Invalid JSON response. Retrying ${retries}/${maxRetries}...`
          )
        }
      } else {
        // If there's no content and no tool call, count as a failure.
        retries++
        console.error(`Empty response. Retrying ${retries}/${maxRetries}...`)
      }
    }

    if (retries === maxRetries) {
      throw new Error(
        'LLM did not return a valid response after maximum retries'
      )
    }

    console.log('Token usage:', tokenUsage)

    return NextResponse.json({
      status: 'complete',
      response: finalMessage,
      messages: [...messages, finalMessage],
      tokenUsage
    })
  } catch (error) {
    console.error('Error in find-references-section endpoint:', error)
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        errorStack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
