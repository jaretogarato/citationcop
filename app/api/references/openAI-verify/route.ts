// app/api/references/openAI-verify/route.ts
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const API_KEYS = [
  process.env.OPENAI_API_KEY_1,
  process.env.OPENAI_API_KEY_2,
  process.env.OPENAI_API_KEY_3
].filter((key): key is string => {
  if (!key) {
    console.warn('Missing OpenAI API key');
    return false;
  }
  return true;
});

const openAIInstances = API_KEYS.map((apiKey) => new OpenAI({ apiKey }));
const model = process.env.LLM_MODEL_ID || 'gpt-4o-mini';

export async function POST(request: Request) {
  try {
    const { reference, searchResults, keyIndex, maxRetries = 1 } = await request.json();

    if (!reference || !searchResults) {
      return NextResponse.json(
        { error: 'Reference and searchResults are required' },
        { status: 400 }
      );
    }

    if (keyIndex >= openAIInstances.length) {
      return NextResponse.json(
        { error: 'Invalid key index' },
        { status: 400 }
      );
    }

    const openAI = openAIInstances[keyIndex];
    const startTime = Date.now();

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
      .join(' ');

    const prompt = `You are a machine that checks references/citations and uncovers false references in writing. Given the following search results, determine whether the provided reference refers to an actual article, conference paper, blog post, or other. Only use the information from the search results to determine the validity of the reference.
    
    IMPORTANT: Only one citation of the reference is not sufficient to determine validity. You MUST CONSIDER EVIDENCE FROM MULTIPLE SEARCH RESULTS to make a decision.

    Reference: ${reference_string}

    Google Search Results:
    ${JSON.stringify(searchResults, null, 2)}

    Answer in the following JSON format:
    {
      "isValid": true or false,
      "message": "Explain how the search results verify or not the given reference. Include links that support your conclusion.",
    }`;

    let lastError: Error | null = null as Error | null;

    // Retry loop
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await openAI.chat.completions.create({
          model: model,
          messages: [{ role: 'system', content: prompt }],
          temperature: 0.0,
          response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          console.warn(`Attempt ${attempt + 1}: No content received from LLM`);
          continue;
        }

        try {
          const result = JSON.parse(content);

          // Validate the result structure
          if (typeof result.isValid !== 'boolean' || typeof result.message !== 'string') {
            console.warn(`Attempt ${attempt + 1}: Invalid response structure`);
            continue;
          }

          console.log(`Reference verified in ${Date.now() - startTime}ms with key ${keyIndex}`);
          return NextResponse.json(result);

        } catch (parseError) {
          console.warn(`Attempt ${attempt + 1}: JSON parsing failed:`,
            parseError instanceof Error ? parseError.message : 'Unknown parsing error');
          lastError = parseError instanceof Error ? parseError : new Error('Unknown parsing error');
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
        }
      } catch (error) {
        console.warn(`Attempt ${attempt + 1}: Request failed:`,
          error instanceof Error ? error.message : 'Unknown error');
        lastError = error instanceof Error ? error : new Error('Unknown error');

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
      }
    }

    // If we've exhausted all retries, return an error result
    console.error('All verification attempts failed. Last error:', lastError?.message);
    return NextResponse.json({
      isValid: false,
      message: `Verification failed after ${maxRetries + 1} attempts. Last error: ${lastError?.message}`
    }, { status: 500 });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Processing failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}