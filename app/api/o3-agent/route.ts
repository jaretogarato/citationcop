// app/api/o3-agent/route.ts
import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { ChatCompletionMessageParam } from 'openai/resources/chat'
import { referenceTools } from '@/app/lib/reference-tools'

export const maxDuration = 60

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: Request) {
  try {
    const {
      reference,
      iteration = 0,
      previousMessages = [],
      functionResult = null,
      lastToolCallId = null
    } = await request.json()

    //console.log(`\n=== Starting Iteration ${iteration} ===`)
    //console.log(`Reference text: ${reference?.substring(0, 100)}...`)
    //console.log(`Previous messages: ${previousMessages?.length}`)

    // Always ensure we have a valid messages array
    let messages: ChatCompletionMessageParam[] = []

    if (previousMessages?.length > 0) {
      messages = [...previousMessages]
      // If we have a function result from previous iteration, add it
      if (functionResult && lastToolCallId) {
        messages.push({
          role: 'tool',
          tool_call_id: lastToolCallId,
          content: JSON.stringify(functionResult)
        })
      }
    } else {
      // Initial messages if we don't have any previous ones
      messages = [
        {
          role: 'system',
          content: `You are a reference verification assistant. Your task is to verify academic and web references using available tools.

A reference status must be one of:
- "verified": if validity can be confirmed with high confidence
- "unverified": if there is no evidence of its existence
- "needs-human": if the reference exists but has discrepancies or missing information that requires human verification

When searching:
1. First identify key elements from the reference (authors, title, year, publication)
2. Create specific search queries using these elements - prioritize exact titles and author names
3. If the first search isn't conclusive, try alternative queries focusing on different elements
4. Analyze search results by looking for:
   - Exact title matches
   - Author name matches
   - Publication/venue matches
   - Year matches
   - Similar content descriptions

Return a final JSON response only when you have sufficient evidence:
{
  "status": "verified" | "unverified" | "needs-human" ,
  "message": "Detailed explanation of findings. Include relevant links if available. Use formatting if helpful.",
  "reference": "Reference in APA format including any new information found."
}

IMPORTANT: Your final response must be valid JSON. Do NOT include any additional text, markdown, or formatting outside the JSON object.
Do NOT use tool_calls when giving your final response. Make sure to try multiple searches if the first attempt is inconclusive.`
        },
        {
          role: 'user',
          content: `Please verify this reference: ${reference}`
        }
      ]
    }

    // Verify we have messages before making the API call
    if (!messages || messages.length === 0) {
      throw new Error('No messages available for LLM call')
    }

    //console.log('Messages to send:', messages.length)
    //console.log('First message role:', messages[0]?.role)
    //console.log('Last message role:', messages[messages.length - 1]?.role)

    const completion = await openai.chat.completions.create({
      model: 'o3-mini',
      messages,
      tools: referenceTools,
      store: true
    })

    const message = completion.choices[0].message
    //console.log('LLM Response received :', message.content)

    const tokenUsage = completion.usage
    //console.log('Token usage:', tokenUsage)

    // If no tool_calls, we have our final answer
    if (!message.tool_calls) {
      //console.log('Final answer received')
      try {
        if (message.content === null) {
          throw new Error('Message content is null')
        }

        // Try to extract JSON from the response if it's not properly formatted
        let jsonContent = message.content
        let extractedJson = false

        // If it doesn't look like JSON, try to extract it
        if (!jsonContent.trim().startsWith('{')) {
          const jsonMatch = jsonContent.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            //console.log('Found JSON embedded in non-JSON response')
            jsonContent = jsonMatch[0]
            extractedJson = true
          }
        }

        // Parse the JSON content
        const result = JSON.parse(jsonContent)

        // Log extraction if we had to fix the response
        /*if (extractedJson) {
          console.log('Successfully extracted JSON from malformed response')
          console.log('Original:', message.content.substring(0, 100) + '...')
          console.log('Extracted:', jsonContent.substring(0, 100) + '...')
        }*/

        // Ensure required fields are present
        const requiredFields = ['status', 'message', 'reference']
        const missingFields = requiredFields.filter((field) => !result[field])

        if (missingFields.length > 0) {
          console.warn(
            `Missing required fields in JSON response: ${missingFields.join(', ')}`
          )

          // Add missing fields with defaults
          if (!result.status) {
            result.status = 'needs-human'
            //console.log('Added default status: "needs-human"')
          }

          if (!result.message) {
            result.message =
              'Verification produced incomplete results. Human review recommended.'
            //console.log('Added default message')
          }

          if (!result.reference) {
            result.reference = reference
            //console.log('Used original reference as fallback')
          }

          // Track performed checks if missing
          if (!result.checks_performed) {
            // Extract used functions from the message history
            const tools = new Set<string>()
            messages.forEach((msg) => {
              if (
                msg.role === 'assistant' &&
                'tool_calls' in msg &&
                msg.tool_calls
              ) {
                msg.tool_calls.forEach((call: any) => {
                  if (call.function?.name === 'check_doi')
                    tools.add('DOI Lookup')
                  if (call.function?.name === 'search_reference')
                    tools.add('Literature Search')
                  if (call.function?.name === 'check_url')
                    tools.add('URL Verification')
                })
              }
            })

            if (tools.size > 0) {
              result.checks_performed = Array.from(tools)
              //console.log(
              //  `Added checks_performed: ${result.checks_performed.join(', ')}`
              //)
            } else {
              result.checks_performed = ['Reference Analysis']
            }
          }
        }

        return NextResponse.json({
          status: 'complete',
          result,
          resultWasRepaired: extractedJson || missingFields.length > 0,
          messages: [...messages, message],
          tokenUsage: tokenUsage
        })
      } catch (e) {
        // Log detailed error information
        console.error('JSON parsing error:', {
          error: e instanceof Error ? e.message : String(e),
          content: message.content?.substring(0, 500) || '[null content]',
          reference: reference?.substring(0, 100) + '...'
        })

        // Create a fallback result
        const fallbackResult = {
          status: 'needs-human',
          message:
            "The verification process produced an invalid response format that couldn't be automatically fixed. Human review required.",
          reference: reference,
          checks_performed: [] as string[]
        }

        // Extract function calls from message history
        messages.forEach((msg) => {
          if (
            msg.role === 'assistant' &&
            'tool_calls' in msg &&
            msg.tool_calls
          ) {
            msg.tool_calls.forEach((call: any) => {
              if (
                call.function?.name === 'check_doi' &&
                !fallbackResult.checks_performed.includes('DOI Lookup')
              )
                fallbackResult.checks_performed.push('DOI Lookup')
              if (
                call.function?.name === 'search_reference' &&
                !fallbackResult.checks_performed.includes('Literature Search')
              )
                fallbackResult.checks_performed.push('Literature Search')
              if (
                call.function?.name === 'check_url' &&
                !fallbackResult.checks_performed.includes('URL Verification')
              )
                fallbackResult.checks_performed.push('URL Verification')
            })
          }
        })

        //console.log('Created fallback result due to parsing failure')

        // CHANGED: Return parsingError flag instead of changing status to error
        return NextResponse.json({
          status: 'complete',
          result: fallbackResult,
          parsingError: true, // Add this flag for the service to detect
          parseErrorMessage: e instanceof Error ? e.message : String(e),
          rawContent: message.content,
          messages: [...messages, message],
          tokenUsage: tokenUsage
        })
      }
    }

    // If we have tool calls, return the first one to be executed
    const toolCall = message.tool_calls[0]
    //console.log('Function to call:', toolCall.function.name)

    // Return what we need for the next iteration
    return NextResponse.json({
      status: 'pending',
      messages: [...messages, message], // Include the assistant's message with tool calls
      iteration: iteration + 1,
      functionToCall: {
        name: toolCall.function.name,
        arguments: JSON.parse(toolCall.function.arguments)
      },
      lastToolCallId: toolCall.id,
      tokenUsage: tokenUsage // Add the token usage information
    })
  } catch (error) {
    console.error('Error in o3-agent endpoint:', error)

    // Create a more detailed error response
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