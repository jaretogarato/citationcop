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
    reference.url,
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

    console.log('Raw Content from OpenAI:', content);

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
