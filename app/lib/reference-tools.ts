// app/lib/reference-tools.ts
import type { ChatCompletionTool } from 'openai/resources/chat/completions'

export const referenceTools: ChatCompletionTool[] = [
  {
    type: 'function', // This must be literally "function", not a variable string
    function: {
      name: 'check_doi',
      description:
        'Verify a reference using its DOI via Crossref API. Returns what data is found for the given DOI.',
      parameters: {
        type: 'object',
        properties: {
          doi: {
            type: 'string',
            description: 'The DOI to verify'
          },
          title: {
            type: 'string',
            description: 'The title to compare against the DOI metadata'
          }
        },
        required: ['doi', 'title'],
        additionalProperties: false
      },
      strict: true
    }
  },
  {
    type: 'function',
    function: {
      name: 'google_search',
      description:
        "Search for a reference using Google search. Best for websites, blogs, or other gray literature. Returns up to 10 relevant search results that can be used to verify the reference's existence.",
      parameters: {
        type: 'object',
        properties: {
          reference: {
            type: 'string',
            description:
              'The reference text or key parts to search for. Be specific to get relevant results.'
          }
        },
        required: ['reference'],
        additionalProperties: false
      },
      strict: true
    }
  },
  {
    type: 'function',
    function: {
      name: 'scholar_search',
      description:
        "Search for a reference using Google scholar. Best for academic pieces. Returns up to 10 relevant search results that can be used to verify the reference's existence.",
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'The reference text or key parts to search for. Be specific to get relevant results.'
          }
        },
        required: ['query'],
        additionalProperties: false
      },
      strict: true
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_url',
      description:
        'If a reference contains a URL, then get the content from that page to see if it confirms the reference.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to check'
          },
          reference: {
            type: 'string',
            description: 'The reference text to verify against the URL content'
          }
        },
        required: ['url', 'reference'],
        additionalProperties: false
      },
      strict: true
    }
  }
   /* {
    type: 'function',
    function: {
      name: 'smart_search_reference',
      description:
        'Search for a reference using a search agent. The agent returns its assessment of whether or not the reference exists along with relevant details.',
      parameters: {
        type: 'object',
        properties: {
          reference: {
            type: 'string',
            description: 'The raw reference text.'
          }
        },
        required: ['reference'],
        additionalProperties: false
      },
      strict: true
    }
  },*/
   /*{
    type: 'function',
    function: {
      name: 'repair_reference',
      description: 'Find information to correct or complete a reference.',
      parameters: {
        type: 'object',
        properties: {
          reference: {
            type: 'string',
            description: 'The current reference text to repair.'
          }
        },
        required: ['reference'],
        additionalProperties: false
      },
      strict: true
    }
  } */
]

export const referencePageDetectionTools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'earlier_page',
      description:
        'Get the previous page to analyze. When calling this, include an explanation of why you need additional context (e.g. the current page does not contain enough information). DO NOT CALL IF YOU HAVE FOUND THE REFERENCE HEADER',
      parameters: {
        type: 'object',
        properties: {
          current_page: {
            type: 'number',
            description: 'The current page number being analyzed.'
          },
          explanation: {
            type: 'string',
            description:
              'Did you see references? Are they enumerated or in alphabetical order? If so, where are you in the alphabet/numbering? Are you sure you did not see a reference header? Explain why you need to see the previous page.'
          }
        },
        required: ['current_page', 'explanation'],
        additionalProperties: false
      },
      strict: true
    }
  }
]
