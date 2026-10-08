require('dotenv').config();

const express = require('express');
const webhookRoutes = require('./routes/webhook.routes');
const logger = require('./utils/logger');

// Stop early if required configuration is missing.
const REQUIRED_ENV = ['JOTFORM_API_KEY', 'BITRIX24_WEBHOOK_URL'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length) {
  logger.error(`Missing environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/webhook', webhookRoutes);

// Fallback error handler (e.g. malformed request body).
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({ success: false, error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => logger.info(`Server listening on port ${PORT}`));
