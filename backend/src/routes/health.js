const express = require('express');

const router = express.Router();

// GET /health endpoint returning {"status": "ok"}
router.get('/', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

module.exports = router;

