'use server';

import OpenAI from 'openai'
import { Reference } from '@/types/reference'


export async function verifyGoogleSearchResultWithLLM(
  reference: Reference,
  searchResults: any,
  maxRetries: number = 1
): Promise<{ isValid: boolean; message: string }> {
  const openAI = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const model = process.env.LLM_MODEL_ID || 'gpt-4o-mini'

  const reference_string = [
    reference.authors?.join(' '),
    reference.title,
    reference.journal,
    reference.year,
    reference.volume,
    reference.pages,
    reference.publisher,
    reference.conference,
    reference.date_of_access,
    reference.issue
  ]
    .filter((field) => field !== null && field !== undefined)
    .join(' ')

  const prompt = `You are a machine that checks references/citations and uncovers false references in writing. Given the following search results, determine whether the provided reference refers to an actual article, conference paper, blog post, or other. Only use the information from the search results to determine the validity of the reference.
  
  Only one citation of the reference is not sufficient to determine validity. You must consider multiple search results to make a decision.

  Reference: ${reference_string}

  Google Search Results:
  ${JSON.stringify(searchResults, null, 2)}

  Answer in the following JSON format:
  {
    "isValid": true or false,
    "message": "Explain how the search results verify or not the given reference. Include links that support your conclusion.",
  }`

  let lastError: Error | null = null

  // Retry loop
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      //console.log(`Attempt ${attempt + 1}/${maxRetries + 1}... JSON!!`);
      const response = await openAI.chat.completions.create({
        model: model,
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.0,
        response_format: { type: "json_object" },
      })

      const content = response.choices[0]?.message?.content;
      if (!content) {
        console.warn(`Attempt ${attempt + 1}: No content received from LLM`);
        continue;  // Skip to next attempt instead of throwing
      }

      try {
        const result = JSON.parse(content);

        // Validate the result structure
        if (typeof result.isValid !== 'boolean' || typeof result.message !== 'string') {
          console.warn(`Attempt ${attempt + 1}: Invalid response structure`);
          continue;  // Skip to next attempt instead of throwing
        }

        // If we get here, we have a valid result
        return {
          isValid: result.isValid,
          message: result.message
        };

      } catch (parseError) {
        console.warn(`Attempt ${attempt + 1}: JSON parsing failed:`,
          parseError instanceof Error ? parseError.message : 'Unknown parsing error');
        lastError = parseError instanceof Error ? parseError : new Error('Unknown parsing error');
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;  // Skip to next attempt
        }
      }
    } catch (error) {
      console.warn(`Attempt ${attempt + 1}: Request failed:`,
        error instanceof Error ? error.message : 'Unknown error');
      lastError = error instanceof Error ? error : new Error('Unknown error');

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;  // Skip to next attempt
      }
    }
  }

  // If we've exhausted all retries, return an error result
  console.error('All verification attempts failed. Last error:', lastError?.message);
  return {
    isValid: false,
    message: `Verification failed after ${maxRetries + 1} attempts. Last error: ${lastError?.message}`
  };
}

export async function verifyURL(reference: Reference): Promise<{ isValid: boolean; message: string }> {
  if (!reference.url) {
    return { isValid: false, message: "No URL provided." };
  }

  try {
    // Fetch the URL content
    const URLresponse = await fetch(reference.url);
    if (!URLresponse.ok) {
      return { isValid: false, message: "URL is inaccessible or broken." };
    }

    // Get the text content and clean it
    const htmlContent = await URLresponse.text();
    const cleanContent = extractTextContent(htmlContent);

    // Initialize OpenAI
    const openAI = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.LLM_MODEL_ID || 'gpt-4o-mini'
    
    // Create reference string
    const reference_string = [
      reference.authors?.join(' '),
      reference.title,
      reference.journal,
      reference.year,
      reference.volume,
      reference.pages,
      reference.publisher,
      reference.conference,
      reference.url,
    ]
      .filter((field) => field !== null && field !== undefined)
      .join(' ');

    // Create prompt for OpenAI
    const prompt = `Given the following webpage content and reference information, determine if this webpage contains or represents the referenced work. The webpage should contain information that confirms this is the correct source for the reference.

Reference: ${reference_string}

Webpage Content (truncated): ${cleanContent.slice(0, 2000)}...

Answer in the following format:
{
  "isValid": true or false,
  "message": "(If true start with: Confirmed UR and provide the url. Explain whether the given url content matches the reference. Include specific details that support your conclusion.",
}`

    // Get OpenAI response
    const response = await openAI.chat.completions.create({
      model: model,
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.0
    });

    let content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No content received from LLM');

    // Parse JSON response
    const jsonStartIndex = content.indexOf('{');
    const jsonEndIndex = content.lastIndexOf('}');
    if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
      content = content.slice(jsonStartIndex, jsonEndIndex + 1);
    } else {
      throw new Error('Response does not contain recognizable JSON structure.');
    }

    const result = JSON.parse(content);
    return {
      isValid: result.isValid,
      message: result.message
    };

  } catch (error) {
    //console.error('Error verifying URL with LLM:', error);
    return { isValid: false, message: 'URL verification failed due to an error.' };
  }
}

// Helper function to extract text content from HTML
function extractTextContent(html: string): string {
  // Remove script and style elements
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove HTML tags and decode entities
  return html.replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}