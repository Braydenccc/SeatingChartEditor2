/**
 * Fetch with automatic retry on network errors
 * @param {string} url - URL to fetch
 * @param {RequestInit} options - Fetch options
 * @param {number} retries - Number of retries (default: 3)
 * @param {number} delay - Delay between retries in ms (default: 1000)
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(url, options = {}, retries = 3, delay = 1000) {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url, options)
      if (!response.ok && i < retries) {
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      return response
    } catch (error) {
      if (i === retries) throw error
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}
