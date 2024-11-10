// app/api/references/verify/route.ts
import OpenAI from 'openai';
import { NextResponse } from 'next/server';
//import { Reference } from "@/types/types"
import { Reference } from '@/types/reference';

export const runtime = 'edge';

const openAI = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(request: Request) {
  try {
    const { reference, searchResults } = await request.json();

    if (!reference || !searchResults) {
      return NextResponse.json(
        { error: 'Reference and search results are required' },
        { status: 400 }
      );
    }

    // Create reference string
    const reference_string = [
      reference.authors?.join(' '),
      reference.title,
      reference.journal,
      reference.year,
      reference.volume,
      reference.pages,
      reference.DOI,
      reference.publisher,
      reference.conference,
      reference.url,
      reference.date_of_access,
      reference.issue
    ]
      .filter((field) => field !== null && field !== undefined)
      .join(' ');

    const prompt = `Given the following search results, determine whether the provided reference is a valid academic reference. The search results must confirm the existance of the article, do not use properties of the refernece itself to verify the reference.

Reference: ${reference_string}

Google Search Results:
${JSON.stringify(searchResults, null, 2)}

Answer in the following format:
{
  "isValid": true or false,
  "message": "Explain how the search results verify or not the given refernece. The links must CONFIRM the existence of the result. Provide your degree of confidence (high, medium, or low).",
}`;

    const response = await openAI.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1
    });

    let content = response.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: 'No content received from LLM' },
        { status: 500 }
      );
    }

    const jsonStartIndex = content.indexOf('{');
    const jsonEndIndex = content.lastIndexOf('}');

    if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
      content = content.slice(jsonStartIndex, jsonEndIndex + 1);
    } else {
      return NextResponse.json(
        { error: 'Response does not contain recognizable JSON structure' },
        { status: 500 }
      );
    }

    const result = JSON.parse(content);
    return NextResponse.json({
      isValid: result.isValid,
      message: result.message
    });
  } catch (error) {
    console.error('Error in reference verification:', error);
    return NextResponse.json(
      { error: 'Failed to verify reference' },
      { status: 500 }
    );
  }
}
