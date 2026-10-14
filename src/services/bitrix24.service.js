const logger = require('../utils/logger');
const { withRetry, httpError, isRetryableStatus } = require('../utils/retry');

const REQUEST_TIMEOUT_MS = 10000;
// Bitrix24 error codes that are temporary.
const RETRYABLE_ERRORS = new Set(['QUERY_LIMIT_EXCEEDED', 'INTERNAL_SERVER_ERROR']);

/**
 * Calls a Bitrix24 REST method through the inbound webhook.
 * Errors are flagged `retryable` for network failures, timeouts, 429/5xx and rate-limit codes.
 */
async function callBitrix(method, payload) {
  const url = `${process.env.BITRIX24_WEBHOOK_URL.replace(/\/?$/, '/')}${method}.json`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    // A timeout is ambiguous (Bitrix24 may have created the contact), so only other network errors are retried.
    throw httpError(`Cannot connect to Bitrix24: ${err.message}`, err.name !== 'TimeoutError');
  }

  const body = await response.json().catch(() => null);

  // Bitrix24 returns { error, error_description } on failure (e.g. invalid webhook, missing scope).
  if (!response.ok || !body || body.error) {
    const reason = body?.error_description || body?.error || 'invalid response';
    const retryable = isRetryableStatus(response.status) || RETRYABLE_ERRORS.has(body?.error);
    throw httpError(`Bitrix24 API error (HTTP ${response.status}): ${reason}`, retryable);
  }
  return body.result;
}

/**
 * Creates a Contact in Bitrix24 CRM.
 * Docs: https://training.bitrix24.com/rest_help/crm/contacts/crm_contact_add.php
 * @param {{ fullName: string, phone: string, email: string }} contact
 * @returns {Promise<number>} ID of the new Bitrix24 contact
 */
function createContact(contact) {
  return withRetry(() => addContact(contact), { label: 'Bitrix24 createContact' });
}

async function addContact(contact) {
  // Field mapping: Full Name -> NAME, Phone -> PHONE, Email -> EMAIL.
  // PHONE and EMAIL are multi-value fields in Bitrix24, so they are sent as arrays.
  const contactId = await callBitrix('crm.contact.add', {
    fields: {
      NAME: contact.fullName,
      PHONE: [{ VALUE: contact.phone, VALUE_TYPE: 'WORK' }],
      EMAIL: [{ VALUE: contact.email, VALUE_TYPE: 'WORK' }],
      SOURCE_ID: 'WEB',
    },
  });

  logger.info('Created Bitrix24 contact', { contactId });
  return contactId;
}

module.exports = { createContact };
