const logger = require('./logger');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs `fn`, retrying with exponential backoff while it throws an error flagged `retryable`.
 * Errors without `retryable: true` (e.g. bad API key, 4xx) are thrown immediately.
 * @param {() => Promise<T>} fn
 * @param {{ label?: string, retries?: number, baseDelayMs?: number }} [options]
 * @returns {Promise<T>}
 * @template T
 */
async function withRetry(fn, { label = 'operation', retries = 3, baseDelayMs = 500 } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!err.retryable || attempt > retries) throw err;
      const delay = baseDelayMs * 2 ** (attempt - 1);
      logger.warn(`${label} failed, retrying in ${delay}ms (${attempt}/${retries})`, { error: err.message });
      await sleep(delay);
    }
  }
}

/** Creates an Error flagged as retryable (or not). */
function httpError(message, retryable) {
  const err = new Error(message);
  err.retryable = retryable;
  return err;
}

/** True for HTTP statuses worth retrying: rate limit and server errors. */
const isRetryableStatus = (status) => status === 429 || status >= 500;

module.exports = { withRetry, httpError, isRetryableStatus };
