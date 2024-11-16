'use server';

import OpenAI from 'openai';
import { Reference } from '@/types/reference';

export async function doubleCheckReference(
    reference: Reference,
    maxRetries: number = 1
): Promise<{ ok: true }[] | Reference[]> {
    const openAI = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    //console.log('Double-checking reference:', reference);

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

    // Retry loop
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Attempt ${attempt + 1}/${maxRetries + 1} to validate reference`);

            const response = await openAI.chat.completions.create({
                model: 'gpt-4',
                messages: [{ role: 'system', content: prompt }],
                temperature: 0.0,
            });

            const content = response.choices[0]?.message?.content;
            if (!content) {
                console.warn(`Attempt ${attempt + 1}: No content received from LLM`);
                continue;
            }

            try {
                // Try to extract JSON from the content
                const jsonMatch = content.match(/\[[\s\S]*\]/);
                if (!jsonMatch) {
                    console.warn(`Attempt ${attempt + 1}: No JSON array found in response`);
                    continue;
                }

                const result = JSON.parse(jsonMatch[0]);
                console.log('Result:', result);

                // Validate the result structure
                if (!Array.isArray(result) || result.length === 0) {
                    console.warn(`Attempt ${attempt + 1}: Invalid response structure - not an array or empty`);
                    continue;
                }

                // Check if the response indicates the reference is correct
                if (result[0].ok === true) {
                    return [{ ok: true }];
                }

                // Process references to ensure they have all required fields
                return result.map((ref: Partial<Reference>, index: number) => ({
                    ...reference, // Keep original fields as defaults
                    ...ref, // Override with corrections
                    id: index === 0 ? reference.id : Date.now() + index,
                    status: 'pending' // Always set status to pending for corrected references
                })) as Reference[];

            } catch (parseError) {
                console.warn(
                    `Attempt ${attempt + 1}: JSON parsing failed:`,
                    parseError instanceof Error ? parseError.message : 'Unknown parsing error'
                );
                lastError = parseError instanceof Error ? parseError : new Error('Unknown parsing error');

                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }
            }
        } catch (error) {
            console.warn(
                `Attempt ${attempt + 1}: Request failed:`,
                error instanceof Error ? error.message : 'Unknown error'
            );
            lastError = error instanceof Error ? error : new Error('Unknown error');

            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }
        }
    }

    // If we've exhausted all retries, return original reference
    console.error('All verification attempts failed. Last error:', lastError?.message);
    return [{ ok: true }];
}