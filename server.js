require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json({ limit: '1mb' }));

// ─── Public health check (no auth) ───────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'IrfanLM Relay Server running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Status endpoint (with auth)
const auth = require('./middleware/auth');
app.get('/status', auth, (req, res) => {
  res.json({
    status: 'ok',
    services: {
      telegram: !!process.env.TELEGRAM_BOT_TOKEN,
      cloudinary: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY)
    }
  });
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/telegram',  auth, require('./routes/telegram'));
app.use('/cloudinary', auth, require('./routes/cloudinary'));
app.use('/media', auth, require('./routes/media'));

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ IrfanLM Relay Server listening on port ${PORT}`);
});
