/**
 * Minimal logger that suppresses output in production.
 * In production, errors are still logged (for monitoring tools like Vercel logs)
 * but debug/info noise is silenced.
 */

const isProd = process.env.NODE_ENV === 'production';

export const logger = {
  info: (...args) => {
    if (!isProd) console.log('[INFO]', ...args);
  },
  warn: (...args) => {
    if (!isProd) console.warn('[WARN]', ...args);
  },
  error: (...args) => {
    // Always log errors — they appear in Vercel/server logs but not in browser
    console.error('[ERROR]', ...args);
  },
};
