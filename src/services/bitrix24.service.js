const logger = require('../utils/logger');

const REQUEST_TIMEOUT_MS = 10000;

/**
 * Creates a Contact in Bitrix24 CRM through an inbound webhook.
 * Docs: https://training.bitrix24.com/rest_help/crm/contacts/crm_contact_add.php
 * @param {{ fullName: string, phone: string, email: string }} contact
 * @returns {Promise<number>} ID of the new Bitrix24 contact
 */
async function createContact(contact) {
  const url = `${process.env.BITRIX24_WEBHOOK_URL.replace(/\/?$/, '/')}crm.contact.add.json`;

  // Field mapping: Full Name -> NAME, Phone -> PHONE, Email -> EMAIL.
  // PHONE and EMAIL are multi-value fields in Bitrix24, so they are sent as arrays.
  const payload = {
    fields: {
      NAME: contact.fullName,
      PHONE: [{ VALUE: contact.phone, VALUE_TYPE: 'WORK' }],
      EMAIL: [{ VALUE: contact.email, VALUE_TYPE: 'WORK' }],
      SOURCE_ID: 'WEB',
    },
  };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new Error(`Cannot connect to Bitrix24: ${err.message}`);
  }

  const body = await response.json().catch(() => null);

  // Bitrix24 returns { error, error_description } on failure (e.g. invalid webhook, missing scope).
  if (!response.ok || !body || body.error) {
    const reason = body?.error_description || body?.error || 'invalid response';
    throw new Error(`Bitrix24 API error (HTTP ${response.status}): ${reason}`);
  }

  logger.info('Created Bitrix24 contact', { contactId: body.result });
  return body.result;
}

module.exports = { createContact };
