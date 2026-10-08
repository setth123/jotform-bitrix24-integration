const logger = require('../utils/logger');

const REQUEST_TIMEOUT_MS = 10000;

/**
 * Fetches a single submission from the Jotform API.
 * Docs: https://api.jotform.com/docs/#submission-id
 * @param {string} submissionId
 * @returns {Promise<object>} the submission object (contains `answers`)
 */
async function getSubmission(submissionId) {
  const baseUrl = process.env.JOTFORM_API_URL || 'https://api.jotform.com';
  const url = `${baseUrl}/submission/${encodeURIComponent(submissionId)}`;

  let response;
  try {
    response = await fetch(url, {
      headers: { APIKEY: process.env.JOTFORM_API_KEY },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    // Network error, DNS failure or timeout.
    throw new Error(`Cannot connect to Jotform API: ${err.message}`);
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error('Jotform authentication failed: check JOTFORM_API_KEY');
  }

  const body = await response.json().catch(() => null);
  if (!response.ok || !body || body.responseCode !== 200) {
    throw new Error(`Jotform API error (HTTP ${response.status}): ${body?.message || 'invalid response'}`);
  }

  logger.info('Fetched submission from Jotform', { submissionId });
  return body.content;
}

/**
 * Turns a Jotform answer value into plain text.
 * Full Name fields return { first, last }, Phone fields return { full } or { area, phone }.
 */
function answerToText(answer) {
  if (!answer) return '';
  if (typeof answer === 'string') return answer;
  if (answer.full) return answer.full;
  if (answer.first !== undefined || answer.last !== undefined) {
    return [answer.first, answer.middle, answer.last].filter(Boolean).join(' ');
  }
  return Object.values(answer).filter(Boolean).join(' ');
}

/**
 * Picks Full Name, Phone and Email out of the submission answers,
 * based on each question's field type.
 * @param {object} submission
 * @returns {{ fullName: string, phone: string, email: string }}
 */
function extractContact(submission) {
  const answers = Object.values(submission.answers || {});
  const findByType = (...types) => answers.find((a) => types.includes(a.type) && a.answer);

  return {
    fullName: answerToText(findByType('control_fullname', 'control_textbox')?.answer),
    phone: answerToText(findByType('control_phone')?.answer),
    email: answerToText(findByType('control_email')?.answer),
  };
}

module.exports = { getSubmission, extractContact };
