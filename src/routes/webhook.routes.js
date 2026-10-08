const express = require('express');
const multer = require('multer');
const { handleJotformWebhook } = require('../controllers/webhook.controller');

const router = express.Router();

// Jotform sends webhooks as multipart/form-data; multer().none() parses the text fields into req.body.
router.post('/jotform', multer().none(), handleJotformWebhook);

module.exports = router;
