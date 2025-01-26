import OpenAI from 'openai'
import { NextResponse } from 'next/server'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY_1 })

export async function POST(request: Request) {
  const prompt = `If there is a References section on this page, then extract all references to articles, books, etc into the following JSON format:

    {
      "references": [
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
          "date_of_access": "date of access if applicable, will come after url"
          "raw": the raw text of the reference itself. This is the text that was parsed to create this reference.
        }
      ]
    }
    
    References (in JSON format):`
  try {
    // Extract base64 image data from the request body
    const { imageData } = await request.json()

    if (!imageData) {
      return NextResponse.json(
        { error: 'Image data is required' },
        { status: 400 }
      )
    }

    // Validate the Base64 string and ensure it has the correct prefix
    const supportedFormats = [
      'data:image/png;base64,',
      'data:image/jpeg;base64,'
    ]
    const isValidFormat = supportedFormats.some((prefix) =>
      imageData.startsWith(prefix)
    )
    if (!isValidFormat) {
      console.log('not valid format.')
      return NextResponse.json(
        {
          error:
            'Invalid image format. Only Base64-encoded PNG or JPEG images are supported.'
        },
        { status: 400 }
      )
    }

    // Strip the Base64 metadata prefix
    const base64Content = imageData.split(',')[1]

    // Prepare the content for the API request
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Content}`
                //detail: 'low'
              }
            }
          ]
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.0
    })

    // Extract and return the response content
    let content = response.choices[0]?.message?.content

    //console.log('**** /n content from openai: ', content, '/n ****')

    if (!content) {
      return NextResponse.json(
        { error: 'No content received from LLM' },
        { status: 500 }
      )
    }

    // Extract JSON content
    const jsonStartIndex = content.indexOf('{')
    const jsonEndIndex = content.lastIndexOf('}')

    if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
      content = content.slice(jsonStartIndex, jsonEndIndex + 1)
    } else {
      return NextResponse.json(
        { error: 'Response does not contain recognizable JSON structure' },
        { status: 500 }
      )
    }

    const parsedContent = JSON.parse(content)

    if (!parsedContent.references || !Array.isArray(parsedContent.references)) {
      return NextResponse.json(
        { error: 'Parsed JSON does not contain a references array' },
        { status: 500 }
      )
    }
    //console.log('*** Extracted content :', parsedContent)
    return NextResponse.json(parsedContent)
  } catch (error) {
    console.error('Error in reference extraction:', error)
    return NextResponse.json(
      { error: 'Failed to extract references' },
      { status: 500 }
    )
  }
}
