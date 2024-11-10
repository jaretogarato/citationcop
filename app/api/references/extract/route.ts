// app/api/references/extract/route.ts
import OpenAI from "openai"
import { NextResponse } from "next/server"

export const runtime = 'edge'

const openAI = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  try {
    console.log("Extracting references request received:", request)
    const { text } = await request.json()

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 })
    }

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

    const response = await openAI.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    })

    let content = response.choices[0]?.message?.content

    if (!content) {
      return NextResponse.json(
        { error: "No content received from LLM" },
        { status: 500 }
      )
    }

    // Extract JSON content
    const jsonStartIndex = content.indexOf("{")
    const jsonEndIndex = content.lastIndexOf("}")

    if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
      content = content.slice(jsonStartIndex, jsonEndIndex + 1)
    } else {
      return NextResponse.json(
        { error: "Response does not contain recognizable JSON structure" },
        { status: 500 }
      )
    }

    const parsedContent = JSON.parse(content)

    if (!parsedContent.references || !Array.isArray(parsedContent.references)) {
      return NextResponse.json(
        { error: "Parsed JSON does not contain a references array" },
        { status: 500 }
      )
    }

    return NextResponse.json(parsedContent)
  } catch (error) {
    console.error("Error in reference extraction:", error)
    return NextResponse.json(
      { error: "Failed to extract references" },
      { status: 500 }
    )
  }
}
