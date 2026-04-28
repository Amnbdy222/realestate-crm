/**
 * Simple in-memory rate limiter using a sliding window.
 * Suitable for single-instance deployments (Vercel serverless per-region).
 * For multi-region production, swap the store for Redis (e.g. @upstash/ratelimit).
 */

const store = new Map(); // key -> [timestamp, ...]

/**
 * @param {string} key       - Identifier (e.g. IP address or API key)
 * @param {number} limit     - Max requests allowed in the window
 * @param {number} windowMs  - Window size in milliseconds
 * @returns {{ allowed: boolean, remaining: number, resetInMs: number }}
 */
export function rateLimit(key, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Get existing timestamps for this key, prune old ones
  const timestamps = (store.get(key) || []).filter(t => t > windowStart);

  if (timestamps.length >= limit) {
    const oldestInWindow = timestamps[0];
    const resetInMs = windowMs - (now - oldestInWindow);
    return { allowed: false, remaining: 0, resetInMs };
  }

  timestamps.push(now);
  store.set(key, timestamps);

  // Cleanup keys that have no recent activity to prevent memory leaks
  if (store.size > 10_000) {
    for (const [k, ts] of store.entries()) {
      if (ts[ts.length - 1] < windowStart) store.delete(k);
    }
  }

  return { allowed: true, remaining: limit - timestamps.length, resetInMs: 0 };
}
