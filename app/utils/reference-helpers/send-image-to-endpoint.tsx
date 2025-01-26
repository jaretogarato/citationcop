

async function sendImageToEndpoint(imageData: string, pageNum: number) {
  try {
    const response = await fetch('/api/open-ai-vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData })
    })

    const result = await response.json()
    console.log(`Page ${pageNum} processed:`, result)
  } catch (error) {
    console.error(`Failed to send image from page ${pageNum}:`, error)
  }
}
