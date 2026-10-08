const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', '..', 'logs', 'app.log');

// Make sure the logs folder exists before the first write.
fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });

/**
 * Writes one line to the console and to logs/app.log.
 * Format: [ISO time] [LEVEL] message {optional JSON meta}
 */
function write(level, message, meta) {
  const line = `[${new Date().toISOString()}] [${level}] ${message}${meta ? ' ' + JSON.stringify(meta) : ''}`;

  if (level === 'ERROR') console.error(line);
  else console.log(line);

  fs.appendFile(LOG_FILE, line + '\n', (err) => {
    if (err) console.error('Cannot write log file:', err.message);
  });
}

module.exports = {
  info: (message, meta) => write('INFO', message, meta),
  warn: (message, meta) => write('WARN', message, meta),
  error: (message, meta) => write('ERROR', message, meta),
};
