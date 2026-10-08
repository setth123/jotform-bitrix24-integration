const jotformService = require('../services/jotform.service');
const bitrix24Service = require('../services/bitrix24.service');
const { validateContact } = require('../utils/validator');
const logger = require('../utils/logger');

/**
 * Handles a Jotform webhook call:
 * 1. read the submission ID sent by Jotform
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
    const submission = await jotformService.getSubmission(submissionID);
    const { errors, contact } = validateContact(jotformService.extractContact(submission));

    if (errors.length) {
      logger.warn('Invalid submission data', { submissionID, errors });
      return res.status(422).json({ success: false, errors });
    }

    const contactId = await bitrix24Service.createContact(contact);
    logger.info('Submission synced to Bitrix24', { submissionID, contactId });
    return res.status(200).json({ success: true, contactId });
  } catch (err) {
    logger.error('Failed to sync submission', { submissionID, error: err.message });
    return res.status(502).json({ success: false, error: err.message });
  }
}

module.exports = { handleJotformWebhook };
