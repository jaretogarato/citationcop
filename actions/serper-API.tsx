'use server'

export async function fetchGoogleSearchResults(query: string) {
  const apiKey = process.env.SERPER_API_KEY as string;

  const data = JSON.stringify({
    "q": query,
    "num": 10
  });

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: data,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch search results: ${response.statusText}`)
    }

    const responseData = await response.json()
    return responseData

  } catch (error) {
    console.error("Error fetching search results:", error)
    throw new Error("Failed to fetch search results")
  }
}
