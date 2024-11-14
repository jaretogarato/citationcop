'use server';

import OpenAI from 'openai';
import { Reference } from '@/types/reference';

export async function verifyGoogleSearchResultWithLLM(
  reference: Reference,
  searchResults: any
): Promise<{ isValid: boolean; message: string }> {
  //console.log(`LLM Verification for reference: ${reference.title} | Google Results: ${searchResults}`);

  const openAI = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // create reference string
  const reference_string = [
    reference.authors?.join(' '),
    //reference.type,
    reference.title,
    reference.journal,
    reference.year,
    reference.volume,
    reference.pages,
    //reference.DOI,
    reference.publisher,
    reference.conference,
    //reference.url,
    reference.date_of_access,
    reference.issue
  ]
    .filter((field) => field !== null && field !== undefined) // Only include non-null and defined fields
    .join(' ');

  const prompt = `Given the following search results, determine whether the provided reference is a valid reference. The search results should confirm the existence of the article, conference paper, blog post, or other reference. Note that sometimes things don't match up perfectly, so use your best judgment. Do not use properties of the reference itself to verify the reference. 

Reference: ${reference_string}

Google Search Results:
${JSON.stringify(searchResults, null, 2)}

Answer in the following format:
{
  "isValid": true or false,
  "message": "Explain how the search results verify or not the given refernece. Include any links that support your conclusion.",
}`;

  try {
    const response = await openAI.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1
    });

    let content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No content received from LLM');

    //console.log('Raw Content from OpenAI:', content);

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
    console.error('Error verifying reference with LLM:', error);
    return { isValid: false, message: 'Verification failed due to an error.' };
  }
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
  "message": "(If true start with: Confirmed URL) Explain whether the given url content matches the reference. Include specific details that support your conclusion.",
}`

    // Get OpenAI response
    const response = await openAI.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1
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
    console.error('Error verifying URL with LLM:', error);
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