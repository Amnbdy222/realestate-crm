/**
 * In-memory webhook delivery log (last 100 entries).
 * For production, swap this for a DB table or external logging service.
 */

const MAX_LOGS = 100;
const logs = [];

/**
 * @param {'success'|'error'} status
 * @param {object} payload - The request body received
 * @param {string} [error]  - Error message if failed
 */
export function logWebhook(status, payload, error = null) {
  logs.unshift({
    id: Date.now(),
    timestamp: new Date().toISOString(),
    status,
    payload: {
      full_name: payload?.full_name,
      phone: payload?.phone,
      owner_email: payload?.owner_email,
      source: payload?.source,
    },
    error,
  });

  if (logs.length > MAX_LOGS) logs.pop();
}

export function getWebhookLogs() {
  return [...logs];
}
