/**
 * Wraps a Groq API call with exponential backoff retry logic.
 * Retries on rate-limit (429) and transient server errors (5xx).
 *
 * @param {Function} fn        - Async function that calls Groq and returns a result
 * @param {number}   maxRetries - Max number of retry attempts (default 3)
 * @returns {Promise<*>}
 */
export async function groqWithRetry(fn, maxRetries = 3) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const status = err?.status ?? err?.statusCode ?? 0;
      const isRetryable = status === 429 || status >= 500;

      if (!isRetryable || attempt === maxRetries) {
        break;
      }

      // Exponential backoff: 500ms, 1s, 2s
      const delay = Math.min(500 * Math.pow(2, attempt), 4000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
