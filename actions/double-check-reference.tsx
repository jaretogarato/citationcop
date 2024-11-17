'use server';

// DOESN'T ALLOW PARALLEL?

import OpenAI from 'openai';
import { Reference } from '@/types/reference';

const API_KEYS = [
    process.env.OPENAI_API_KEY_1,
    process.env.OPENAI_API_KEY_2,
    process.env.OPENAI_API_KEY_3,
].filter(Boolean) as string[];

const openAIInstances = API_KEYS.map(apiKey => new OpenAI({ apiKey }));
let currentInstance = 0;

const getNextOpenAI = () => {
    const instance = openAIInstances[currentInstance];
    currentInstance = (currentInstance + 1) % openAIInstances.length;
    return instance;
};

const model: string = process.env.LLM_MODEL_ID || 'gpt-4o-mini';

export async function doubleCheckReference(
    reference: Reference,
    maxRetries: number = 1
): Promise<{ ok: true }[] | Reference[]> {
    const startTime = Date.now();
    const instanceIndex = currentInstance;
    const openAI = getNextOpenAI();

    console.log(`[Key ${instanceIndex}] Starting request at ${startTime}`);


    const prompt = `You are a machine that validates parsed academic references by comparing them to their original raw text. You need to verify if the parsing was accurate and suggest corrections if needed.

Raw Reference Text: "${reference.raw}"

Parsed Reference:
${JSON.stringify(reference, null, 2)}

Compare the raw reference text with the parsed version and:
1. Verify the accuracy of the parsed reference.
2. If the parsed reference is incorrect, suggest the corrected version.
3. If the raw text contains multiple references, parse them into separate references.

If the reference is correct, respond with:
[{ "ok": true }]

If the reference needs correction or contains multiple references, respond with an array of references:
[
    {
        "authors": ["author name 1", "author name 2"],
        "type": "type of reference (e.g., journal article, conference paper, etc.)",
        "title": "title of the reference",
        "journal": "journal name if applicable",
        "year": "year of publication",
        "DOI": "DOI if available",
        "publisher": "publisher name if available",
        "volume": "volume number if available",
        "issue": "issue number if available",
        "pages": "page range if available",
        "conference": "conference name if applicable",
        "url": "URL if available. Do NOT create a URL if it does not exist.",
        "date_of_access": "date of access if applicable",
        "raw": "raw reference text for this specific reference"
    }
]`;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[Key ${instanceIndex}] Sending API request at ${Date.now() - startTime}ms`);

            const response = await openAI.chat.completions.create({
                model: model,
                messages: [{ role: 'system', content: prompt }],
                temperature: 0.0,
            });

            console.log(`[Key ${instanceIndex}] Received API response at ${Date.now() - startTime}ms`);

            const content = response.choices[0]?.message?.content;
            if (!content) {
                console.warn(`[Key ${instanceIndex}] No content received at ${Date.now() - startTime}ms`);
                continue;
            }

            try {
                console.log(`[Key ${instanceIndex}] Processing response at ${Date.now() - startTime}ms`);

                const jsonMatch = content.match(/\[[\s\S]*\]/);
                if (!jsonMatch) {
                    console.warn(`[Key ${instanceIndex}] No JSON found at ${Date.now() - startTime}ms`);
                    continue;
                }

                const result = JSON.parse(jsonMatch[0]);

                if (!Array.isArray(result) || result.length === 0) {
                    console.warn(`[Key ${instanceIndex}] Invalid structure at ${Date.now() - startTime}ms`);
                    continue;
                }

                console.log(`[Key ${instanceIndex}] Completed successfully at ${Date.now() - startTime}ms`);

                if (result[0].ok === true) {
                    return [{ ok: true }];
                }

                return result.map((ref: Partial<Reference>, index: number) => ({
                    ...reference,
                    ...ref,
                    id: index === 0 ? reference.id : Date.now() + index,
                    status: 'pending'
                })) as Reference[];

            } catch (parseError) {
                console.warn(
                    `[Key ${instanceIndex}] JSON parsing failed at ${Date.now() - startTime}ms:`,
                    parseError instanceof Error ? parseError.message : 'Unknown parsing error'
                );
                lastError = parseError instanceof Error ? parseError : new Error('Unknown parsing error');

                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }
            }
        } catch (error) {
            // Log the full error object to see what's happening
            console.warn(
                `[Key ${instanceIndex}] Request failed at ${Date.now() - startTime}ms:`,
                error
            );
            lastError = error instanceof Error ? error : new Error('Unknown error');

            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }
        }
    }

    console.error(`[Key ${instanceIndex}] All attempts failed at ${Date.now() - startTime}ms. Last error:`, lastError?.message);
    return [{ ok: true }];
}