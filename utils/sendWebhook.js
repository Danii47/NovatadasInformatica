export async function sendWebhook (url, data) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      throw new Error('Error sending webhook')
    }

    return response
  } catch (error) {
    console.error(error)
  }
}
