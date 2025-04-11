// app/api/o3-agent/route.ts
import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { ChatCompletionMessageParam } from 'openai/resources/chat'
import { referenceTools } from '@/app/lib/reference-tools'
import { logTokenUsage } from '@/app/lib/usage-logger'

export const maxDuration = 300

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const MODEL_NAME: string = 'o3-mini'

export async function POST(request: Request) {
  try {
    // Clone request body for deeper analysis
    const requestBody = await request.json()
    const diagnosticInfo = {
      messageCount: requestBody.previousMessages?.length || 0,
      hasFunctionResult: !!requestBody.functionResult,
      hasLastToolCallId: !!requestBody.lastToolCallId,
      hasWebSearchResults: !!requestBody.webSearchResults,
      iteration: requestBody.iteration || 0
    }

    //console.log('DIAGNOSTIC INFO - REQUEST:', diagnosticInfo)

    // Check for inconsistencies that might cause problems
    if (requestBody.functionResult && !requestBody.lastToolCallId) {
      console.warn(
        '⚠️ WARNING: functionResult provided but lastToolCallId is missing'
      )
    }
    if (!requestBody.functionResult && requestBody.lastToolCallId) {
      console.warn(
        '⚠️ WARNING: lastToolCallId provided but functionResult is missing'
      )
    }

    // Extract params with detailed logging
    const {
      reference,
      iteration = 0,
      previousMessages = [],
      functionResult = null,
      lastToolCallId = null,
      webSearchResults = null
    } = requestBody

    // Always ensure we have a valid messages array
    let messages: ChatCompletionMessageParam[] = []

    if (previousMessages?.length > 0) {
      messages = [...previousMessages]

      // DIAGNOSTIC: Check each message in history
      //console.log('ANALYZING MESSAGE HISTORY:')
      let toolCallCount = 0
      let toolResponseCount = 0
      let unresolvedToolCalls: string[] = []

      previousMessages.forEach((msg: any, i: number) => {
        if (
          msg.role === 'assistant' &&
          msg.tool_calls &&
          msg.tool_calls.length > 0
        ) {
          toolCallCount += msg.tool_calls.length

          msg.tool_calls.forEach((call: any) => {
            //console.log(`  - ${call.function.name} (ID: ${call.id})`)

            // Check if this tool call has a response
            const hasResponse = previousMessages.some(
              (m: any) => m.role === 'tool' && m.tool_call_id === call.id
            )
            if (!hasResponse) {
              unresolvedToolCalls.push(call.id)
            }
          })
        } else if (msg.role === 'tool') {
          toolResponseCount++
          //console.log(`Message ${i}: Tool response for ID: ${msg.tool_call_id}`)
        }
      })

      //console.log(
      //  `FOUND: ${toolCallCount} tool calls, $///{toolResponseCount} tool responses`
      //)
      if (unresolvedToolCalls.length > 0) {
        console.warn(
          `⚠️ UNRESOLVED TOOL CALLS: ${unresolvedToolCalls.join(', ')}`
        )
      }

      // Check if the current request is properly responding to a tool call
      if (lastToolCallId) {
        const isResolvingKnownCall = previousMessages.some(
          (msg: any) =>
            msg.role === 'assistant' &&
            msg.tool_calls &&
            msg.tool_calls.some((call: any) => call.id === lastToolCallId)
        )

        if (!isResolvingKnownCall) {
          console.warn(
            `⚠️ Current request is responding to tool_call_id ${lastToolCallId} but this ID wasn't found in message history!`
          )
        } else {
          //console.log(
          //  `✅ Current request is properly responding to //tool_call_id ${lastToolCallId}`
         // )
        }
      }

      // If we have a function result from previous iteration, add it
      if (functionResult && lastToolCallId) {
        //console.log(`Adding tool response for tool_call_id=${lastToolCallId}`)
        messages.push({
          role: 'tool',
          tool_call_id: lastToolCallId,
          content: JSON.stringify(functionResult)
        })
      }
    } else {
      // Initial messages if we don't have any previous ones
      //console.log('First request - initializing with system message')
      messages = [
        {
          role: 'system',
          content: `You are a reference verification assistant. Your task is to verify academic and web references using available tools.

A reference status must be one of:
- "verified": if validity can be confirmed with high confidence. You must actually find the reference either through a DIRECT DOI match or finding the article itself. A reference to the article is NOT SUFFICIENT. 
- "unverified": if there is no evidence of its existence
- "needs-human": if the reference might exist, but has discrepancies or missing information that requires human verification

Use as many tools as possible to verify the reference. ALWAYS use Reference Search as one of the tools. If you find minor typos or issues, you can correct them.

When searching, do multiple searches, and ALAWAYS try GOOGLE SEARCH. Make sure you try the full raw reference in one search, and just the title in another. 

**PROVIDE ALL LINKS THAT YOU USE IN YOUR RESPONSE.**

Return a final JSON response only when you have sufficient evidence:
{
  "status": "verified" | "unverified" | "needs-human",
  "message": "Detailed explanation of findings. Mention results from all chacks done.",
  "reference": "Reference in APA format including any new information or corrections found."
}

IMPORTANT: Your final response must be valid JSON. Do NOT include any additional text, markdown, or formatting outside the JSON object.

MAKE ONLY ONE TOOL CALL AT A TIME. Do NOT use multiple tool calls in a single response.

Do NOT use tool_calls when giving your final response. Make sure to try multiple searches if the first attempt is inconclusive.`
        },
        {
          role: 'user',
          content: `Please verify this reference: ${reference}`
        }
      ]

      // Add web search results if we have them (for first-time requests)
      if (webSearchResults) {
        // Format and add web search results to message history
        const webSearchMessage = formatWebSearchResultsMessage(webSearchResults)
        messages.push(webSearchMessage)
      }
    }

    // Log tool definitions for debugging
    //console.log('TOOL DEFINITIONS:')
    //referenceTools.forEach((tool: any, i: number) => {
    //  console.log(`Tool ${i + 1}: ${tool.function.name}`)
    //})

    //console.log('*** messages !!!! ::: ', messages)

    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages,
      tools: referenceTools,
      tool_choice: 'auto',
      store: true
    })

    // Capture the token usage for the completion
    if (completion.usage) {
      // Call the server action - DO NOT await if you don't want it to block the response
      logTokenUsage({
        //userId: null, // <--- Placeholder: API Route doesn't have user session easily
        modelName: MODEL_NAME,
        totalTokens: completion.usage.total_tokens,
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        apiEndpoint: '/api/o3-agent'
      }).catch((err: any) => {
        console.error('Error calling logTokenUsage server action:', err)
      })
    } else {
      console.warn('OpenAI response did not include usage data.')
    }

    const message = completion.choices[0].message
    //const links = completion.choices[0].message.annotations

    //console.log('RESPONSE FROM OPENAI:', message.content)
    //console.log('LINKS:', links)

    //console.log('RESPONSE FROM OPENAI:')
    //console.log(`- Content: ${message.content ? 'present' : 'null'}`)
    //console.log(
    //  `- Tool calls: ${message.tool_calls ? message.tool_calls.length : 0}`
    //)

    // DIAGNOSTIC: Validate no duplicate tool call IDs exist in history
    if (message.tool_calls && message.tool_calls.length > 0) {
      const newToolCallIds = message.tool_calls.map((call) => call.id)
      const existingIds = new Set()

      previousMessages.forEach((msg: any) => {
        if (msg.role === 'assistant' && msg.tool_calls) {
          msg.tool_calls.forEach((call: any) => {
            existingIds.add(call.id)
          })
        }
      })

      const duplicateIds = newToolCallIds.filter((id) => existingIds.has(id))
      if (duplicateIds.length > 0) {
        console.warn(
          `⚠️ DUPLICATE TOOL CALL IDS DETECTED: ${duplicateIds.join(', ')}`
        )
      }
    }

    // If no tool_calls, we have our final answer
    if (!message.tool_calls || message.tool_calls.length === 0) {
      //console.log('Processing final answer (no tool calls)')
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
            jsonContent = jsonMatch[0]
            extractedJson = true
          }
        }

        // Parse the JSON content
        const result = JSON.parse(jsonContent)

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
          }

          if (!result.message) {
            result.message =
              'Verification produced incomplete results. Human review recommended.'
          }

          if (!result.reference) {
            result.reference = reference
          }

          // Track performed checks if missing
          if (!result.checks_performed) {
            // Extract used functions from the message history
            const tools = new Set<string>()

            // Add web search check if it was performed
            if (webSearchResults) {
              tools.add('Web Search')
            }

            messages.forEach((msg) => {
              if (
                msg.role === 'assistant' &&
                'tool_calls' in msg &&
                msg.tool_calls
              ) {
                msg.tool_calls.forEach((call: any) => {
                  if (call.function?.name === 'check_doi')
                    tools.add('DOI Lookup')
                  if (call.function?.name === 'google_search')
                    tools.add('Google Search')
                  if (call.function?.name === 'check_url')
                    tools.add('URL Verification')
                  if (call.function?.name === 'scholar_search')
                    tools.add('Scholar Search')
                })
              }
            })

            if (tools.size > 0) {
              result.checks_performed = Array.from(tools)
            } else {
              result.checks_performed = ['Reference Analysis']
            }
          } else if (
            webSearchResults &&
            !result.checks_performed.includes('Web Search')
          ) {
            // Ensure web search is in the checks performed list
            result.checks_performed.push('Web Search')
          }
        }

        //console.log('Returning complete status with result:', result)
        return NextResponse.json({
          status: 'complete',
          result,
          resultWasRepaired: extractedJson || missingFields.length > 0,
          messages: [...messages, message],
          tokenUsage: completion.usage
        })
      } catch (e) {
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

        // Add web search to checks performed if it was done
        if (webSearchResults) {
          fallbackResult.checks_performed.push('Web Search')
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
                call.function?.name === 'google_search' &&
                !fallbackResult.checks_performed.includes('Google Search')
              )
                fallbackResult.checks_performed.push('Google Search')
              if (
                call.function?.name === 'check_url' &&
                !fallbackResult.checks_performed.includes('URL Verification')
              )
                fallbackResult.checks_performed.push('URL Verification')
              if (
                call.function?.name === 'scholar_search' &&
                !fallbackResult.checks_performed.includes('Scholar Search')
              )
                fallbackResult.checks_performed.push('Scholar Search')
            })
          }
        })

        return NextResponse.json({
          status: 'complete',
          result: fallbackResult,
          parsingError: true,
          parseErrorMessage: e instanceof Error ? e.message : String(e),
          rawContent: message.content,
          messages: [...messages, message],
          tokenUsage: completion.usage
        })
      }
    }

    // Take the first tool call
    const toolCall = message.tool_calls[0]

    // DIAGNOSTIC: More detailed tool call info
    //console.log('TOOL CALL DETAILS:')
    message.tool_calls.forEach((call, idx) => {
      //console.log(`Call ${idx + 1}: ${call.function.name} (ID: ${call.id})`)
      //console.log(`  Arguments: ${call.function.arguments}`)

      // Analyze arguments format
      try {
        const args = JSON.parse(call.function.arguments)
        /*console.log(
          `  Parsed args successfully: ${Object.keys(args).join(', ')}`
        )*/
      } catch (e) {
        console.warn(`  ⚠️ ERROR parsing arguments: ${e}`)
      }
    })

    //console.log('FINAL RESPONSE STRUCTURE:')
    const responseStructure = {
      status: 'pending',
      messages: `[${messages.length + 1} messages]`,
      iteration: iteration + 1,
      functionToCall: {
        name: toolCall.function.name,
        arguments: `[parsed JSON with ${Object.keys(JSON.parse(toolCall.function.arguments)).length} keys]`
      },
      lastToolCallId: toolCall.id,
      tokenUsage: `[Usage data with ${Object.keys(completion.usage || {}).length} properties]`
    }
    //console.log(JSON.stringify(responseStructure, null, 2))

    // Return what we need for the next iteration - simple approach
    return NextResponse.json({
      status: 'pending',
      messages: [...messages, message],
      iteration: iteration + 1,
      functionToCall: {
        name: toolCall.function.name,
        arguments: JSON.parse(toolCall.function.arguments)
      },
      lastToolCallId: toolCall.id,
      tokenUsage: completion.usage
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

/**
 * Format web search results into a message that can be added to the conversation
 */
function formatWebSearchResultsMessage(
  webSearchResults: any
): ChatCompletionMessageParam {
  // Check if we have valid web search results
  if (!webSearchResults || !webSearchResults.output_text) {
    return {
      role: 'system',
      content: 'Web search was attempted but did not return usable results.'
    }
  }

  // Format citations if available
  let citationsText = ''
  if (webSearchResults.citations && webSearchResults.citations.length > 0) {
    citationsText = '\n\nCitations found:\n'
    webSearchResults.citations.forEach((citation: any, index: number) => {
      citationsText +=
        `[${index + 1}] ${citation.url} - "${citation.title || 'No title'}"` +
        '\n'
    })
  }

  return {
    role: 'system',
    content: `Web search results for the reference:\n\n${webSearchResults.output_text}${citationsText}`
  }
}
