/**
 * Unified API fetch wrapper
 * Handles credentials, response parsing, and error handling
 */

/**
 * Fetch wrapper that includes credentials: 'include' and parses JSON response
 * @param {string} url - The URL to fetch
 * @param {object} options - Fetch options (method, headers, body, etc.)
 * @returns {Promise<{response: Response, data: any}>} Object containing response and parsed data
 * @throws {Error} If network error or invalid JSON
 */
export const apiFetch = async (url, options = {}) => {
  // Ensure credentials are included
  const fetchOptions = {
    ...options,
    credentials: 'include',
  }

  // Perform the fetch
  const response = await fetch(url, fetchOptions)

  // Parse JSON response
  let data
  try {
    data = await response.json()
  } catch {
    // If JSON parsing fails, create error data
    data = { ok: false, error: 'Invalid response format' }
  }

  return { response, data }
}
