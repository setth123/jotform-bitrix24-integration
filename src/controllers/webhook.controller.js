const jotformService = require('../services/jotform.service');
const bitrix24Service = require('../services/bitrix24.service');
const { validateContact } = require('../utils/validator');
const logger = require('../utils/logger');
const submissionStore = require('../utils/submissionStore');

// Submissions being processed right now, so a second webhook for the same ID waits for the first.
const inFlight = new Map();

async function syncSubmission(submissionID) {
  const submission = await jotformService.getSubmission(submissionID);
  const { errors, contact } = validateContact(jotformService.extractContact(submission));

  if (errors.length) {
    logger.warn('Invalid submission data', { submissionID, errors });
    return { errors };
  }

  const contactId = await bitrix24Service.createContact(contact);
  submissionStore.set(submissionID, contactId);
  logger.info('Submission synced to Bitrix24', { submissionID, contactId });
  return { contactId };
}

/**
 * Handles a Jotform webhook call:
 * 1. read the submission ID sent by Jotform (skip if it was already synced)
 * 2. fetch the full submission from the Jotform API
 * 3. validate the Full Name / Phone / Email values
 * 4. create a Contact in Bitrix24
 */
async function handleJotformWebhook(req, res) {
  const { submissionID, formID } = req.body || {};
  logger.info('Received Jotform webhook', { submissionID, formID });

  if (!submissionID) {
    logger.warn('Webhook rejected: missing submissionID');
    return res.status(400).json({ success: false, error: 'Missing submissionID' });
  }

  try {
    const done = submissionStore.get(submissionID);
    if (done) {
      logger.info('Submission already processed, skipping', { submissionID, contactId: done.contactId });
      return res.status(200).json({ success: true, contactId: done.contactId, duplicate: true });
    }

    let task = inFlight.get(submissionID);
    if (!task) {
      task = syncSubmission(submissionID).finally(() => inFlight.delete(submissionID));
      inFlight.set(submissionID, task);
    }

    const result = await task;
    if (result.errors) return res.status(422).json({ success: false, errors: result.errors });
    return res.status(200).json({ success: true, contactId: result.contactId });
  } catch (err) {
    logger.error('Failed to sync submission', { submissionID, error: err.message });
    return res.status(502).json({ success: false, error: err.message });
  }
}

module.exports = { handleJotformWebhook };
