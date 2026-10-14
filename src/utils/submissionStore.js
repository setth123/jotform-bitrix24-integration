const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const STORE_FILE = path.join(__dirname, '..', '..', 'data', 'processed-submissions.json');
const MAX_ENTRIES = 10000;

fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });

// submissionID -> { contactId, at }. Insertion order = oldest first.
const processed = new Map();
try {
  for (const [id, entry] of Object.entries(JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')))) {
    processed.set(id, entry);
  }
} catch (err) {
  if (err.code !== 'ENOENT') logger.warn('Cannot read processed submissions file, starting empty', { error: err.message });
}

/** @returns {{ contactId: number, at: string } | undefined} */
function get(submissionId) {
  return processed.get(String(submissionId));
}

/** Remembers a successfully synced submission and saves the store to disk (atomic write). */
function set(submissionId, contactId) {
  processed.set(String(submissionId), { contactId, at: new Date().toISOString() });
  while (processed.size > MAX_ENTRIES) processed.delete(processed.keys().next().value);

  try {
    const tmp = `${STORE_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(processed)));
    fs.renameSync(tmp, STORE_FILE);
  } catch (err) {
    logger.error('Cannot save processed submissions file', { error: err.message });
  }
}

module.exports = { get, set };
