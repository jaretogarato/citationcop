'use server'

import OpenAI from "openai"
import { Reference } from "@/types/types"

export async function getReferences(text: string): Promise<string> {
  const openAI = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const prompt = `Extract the references from the following text and provide them in the following JSON format:

{
  "references": [
    {
      "authors": ["author name 1", "author name 2"],
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
      "date_of_access": "date of access if applicable"
    }
  ]
}

Note: do not include the title and information about this particular text in the references. Note Date of Access generally will come just after the url.

Text:

${text}

References (in JSON format):`

  let attempts = 0
  while (attempts < 1) {
    try {
      const response = await openAI.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      })

      let content = response.choices[0]?.message?.content;
      //console.log("Raw Content from OpenAI:", content);

      if (!content) {
        throw new Error("No content received from LLM")
      }

      // Step 1: Extract JSON content by trimming text before the first '{' and after the last '}'
      const jsonStartIndex = content.indexOf("{");
      const jsonEndIndex = content.lastIndexOf("}");
      if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
        content = content.slice(jsonStartIndex, jsonEndIndex + 1);
      } else {
        console.error("Failed to locate JSON structure in response.");
        throw new Error("Response does not contain recognizable JSON structure.");
      }
      content = content.trim();
      // Step 2: Validate JSON format using regex
      //const isValidJsonFormat = /^[\[{].*[\]}]$/.test(content);
      /*if (!isValidJsonFormat) {
        console.error("Content does not match basic JSON structure:", content);
        throw new Error("Response does not have a valid JSON structure.");
      }*/

      // Step 3: Parse JSON to confirm it's valid
      try {
        const parsedContent = JSON.parse(content);

        // Check for the expected "references" array structure
        if (!parsedContent.references || !Array.isArray(parsedContent.references)) {
          console.error("Parsed JSON lacks expected 'references' array:", parsedContent);
          throw new Error("Parsed JSON does not contain a 'references' array.");
        }

        return JSON.stringify(parsedContent); // Return validated JSON as a string
      } catch (jsonError) {
        console.error("JSON parsing failed after structure validation. Retrying...", jsonError);
        attempts++;
      }
    } catch (error) {
      console.error(`Error fetching chat (attempt ${attempts + 1}):`, error);
      attempts++;
    }
  }

  throw new Error("Failed to get valid JSON from LLM after 2 attempts");
}


export async function verifyGoogleSearchResultWithLLM(reference: Reference, searchResults: any): Promise<{ isValid: boolean, message: string }> {

  //console.log(`LLM Verification for reference: ${reference.title} | Google Results: ${searchResults}`);

  const openAI = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // create reference string
  const reference_string = [
    reference.authors?.join(" "), // Join author array into a single string if not null
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
    reference.issue,
  ]
    .filter((field) => field !== null && field !== undefined) // Only include non-null and defined fields
    .join(" ")
 
  const prompt = `Given the following search results, determine whether the provided reference is a valid academic reference. The search results must confirm the existance of the article, do not use properties of the refernece itself to verify the reference.

Reference: ${reference_string}

Google Search Results:
${JSON.stringify(searchResults, null, 2)}

Answer in the following format:
{
  "isValid": true or false,
  "message": "Explain how the search results verify or not the given refernece. The links must CONFIRM the existence of the result. Provide your degree of confidence (high, medium, or low).",
}`

  try {
    const response = await openAI.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    })

    let content = response.choices[0]?.message?.content
    if (!content) throw new Error("No content received from LLM")

    console.log("Raw Content from OpenAI:", content);

    const jsonStartIndex = content.indexOf("{")
    const jsonEndIndex = content.lastIndexOf("}")
    if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
      content = content.slice(jsonStartIndex, jsonEndIndex + 1)
    } else {
      throw new Error("Response does not contain recognizable JSON structure.")
    }

    const result = JSON.parse(content)
    return {
      isValid: result.isValid,
      message: result.message,
    };
  } catch (error) {
    console.error("Error verifying reference with LLM:", error);
    return { isValid: false, message: "Verification failed due to an error." }
  }
}
