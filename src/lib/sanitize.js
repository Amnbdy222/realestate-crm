/**
 * Sanitizes user-supplied strings before they are injected into AI prompts.
 * Prevents prompt injection by stripping control characters and capping length.
 *
 * @param {string} value   - Raw user input
 * @param {number} maxLen  - Maximum allowed character length (default 500)
 * @returns {string}
 */
export function sanitizeForPrompt(value, maxLen = 500) {
  if (value == null) return '';
  return String(value)
    // Remove null bytes and other control characters (except newline/tab which are fine)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Truncate to max length
    .slice(0, maxLen)
    .trim();
}

/**
 * Sanitizes an object's string values for use in AI prompts.
 * Non-string values are passed through unchanged.
 *
 * @param {object} obj
 * @param {number} maxLen
 * @returns {object}
 */
export function sanitizeObjectForPrompt(obj, maxLen = 500) {
  if (!obj || typeof obj !== 'object') return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      typeof v === 'string' ? sanitizeForPrompt(v, maxLen) : v,
    ])
  );
}
