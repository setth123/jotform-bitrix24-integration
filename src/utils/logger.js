const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', '..', 'logs', 'app.log');
// Rotate when app.log reaches this size; keep app.log.1 (newest) ... app.log.N (oldest).
const MAX_FILE_BYTES = (Number(process.env.LOG_MAX_SIZE_MB) || 5) * 1024 * 1024;
const MAX_FILES = Number(process.env.LOG_MAX_FILES) || 5;

// Make sure the logs folder exists before the first write.
fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });

let currentSize = fs.existsSync(LOG_FILE) ? fs.statSync(LOG_FILE).size : 0;

/** app.log.(N-1) -> app.log.N, ..., app.log -> app.log.1; the oldest file is dropped. */
function rotate() {
  try {
    fs.rmSync(`${LOG_FILE}.${MAX_FILES}`, { force: true });
    for (let i = MAX_FILES - 1; i >= 1; i--) {
      if (fs.existsSync(`${LOG_FILE}.${i}`)) fs.renameSync(`${LOG_FILE}.${i}`, `${LOG_FILE}.${i + 1}`);
    }
    fs.renameSync(LOG_FILE, `${LOG_FILE}.1`);
  } catch (err) {
    console.error('Cannot rotate log file:', err.message);
  }
  currentSize = 0;
}

/**
 * Writes one line to the console and to logs/app.log.
 * Format: [ISO time] [LEVEL] message {optional JSON meta}
 */
function write(level, message, meta) {
  const line = `[${new Date().toISOString()}] [${level}] ${message}${meta ? ' ' + JSON.stringify(meta) : ''}`;

  if (level === 'ERROR') console.error(line);
  else console.log(line);

  // Sync write keeps size accounting and rotation ordered; log volume here is low.
  const data = line + '\n';
  try {
    if (currentSize > 0 && currentSize + Buffer.byteLength(data) > MAX_FILE_BYTES) rotate();
    fs.appendFileSync(LOG_FILE, data);
    currentSize += Buffer.byteLength(data);
  } catch (err) {
    console.error('Cannot write log file:', err.message);
  }
}

module.exports = {
  info: (message, meta) => write('INFO', message, meta),
  warn: (message, meta) => write('WARN', message, meta),
  error: (message, meta) => write('ERROR', message, meta),
};
