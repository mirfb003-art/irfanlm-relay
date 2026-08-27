const express = require('express');
const router  = express.Router();
const fetch   = require('node-fetch');
const FormData = require('form-data');
const { validateMediaUrl } = require('../middleware/media-url');

const BOT_TOKEN      = () => process.env.TELEGRAM_BOT_TOKEN;
const DEFAULT_CHAT   = () => process.env.TELEGRAM_CHAT_ID;
const TG_API         = (method) => `https://api.telegram.org/bot${BOT_TOKEN()}/${method}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function resolveMethod(type) {
  // type '1' = Audio, type '3' = Video (matches IrfanLM artifact type IDs)
  if (type === '1' || type === 'audio') return 'sendAudio';
  if (type === '3' || type === 'video') return 'sendVideo';
  return 'sendDocument';
}

function resolveField(type) {
  if (type === '1' || type === 'audio') return 'audio';
  if (type === '3' || type === 'video') return 'video';
  return 'document';
}

function resolveExt(type, contentType = '') {
  if (contentType.includes('mp4'))  return 'mp4';
  if (contentType.includes('webm')) return 'webm';
  if (contentType.includes('mp3') || contentType.includes('mpeg')) return 'mp3';
  if (contentType.includes('ogg'))  return 'ogg';
  if (type === '1' || type === 'audio') return 'mp3';
  if (type === '3' || type === 'video') return 'mp4';
  return 'bin';
}

function safeFilename(title) {
  return title.replace(/[^a-zA-Z0-9_\- ]/g, '_').trim().slice(0, 60);
}

async function streamToTelegram({ mediaUrl, title, type, chatId, caption }) {
  const targetChat = chatId || DEFAULT_CHAT();
  if (!targetChat) throw new Error('No chatId provided and TELEGRAM_CHAT_ID not set');
  if (!BOT_TOKEN())  throw new Error('TELEGRAM_BOT_TOKEN not configured');

  const safeUrl = validateMediaUrl(mediaUrl);

  // 1. Fetch the signed NotebookLM URL (server-to-server, no mobile data used)
  const mediaRes = await fetch(safeUrl, {
    headers: { 'User-Agent': 'IrfanLM-Relay/1.0' },
    timeout: 60000
  });
  if (!mediaRes.ok) throw new Error(`Media fetch failed: ${mediaRes.status}`);

  const contentType = mediaRes.headers.get('content-type') || '';
  const ext      = resolveExt(type, contentType);
  const filename = `${safeFilename(title)}.${ext}`;
  const method   = resolveMethod(type);
  const field    = resolveField(type);

  // 2. Stream directly into a multipart form → Telegram (never fully buffered in RAM)
  const form = new FormData();
  form.append('chat_id', String(targetChat));
  form.append(field, mediaRes.body, {
    filename,
    contentType: contentType || 'application/octet-stream'
  });
  form.append('caption', caption || title);
  if (type === '3' || type === 'video') {
    form.append('supports_streaming', 'true');
  }

  // 3. POST to Telegram Bot API
  const tgRes  = await fetch(TG_API(method), {
    method: 'POST',
    body: form,
    headers: form.getHeaders()
  });
  const tgData = await tgRes.json();
  if (!tgData.ok) throw new Error(`Telegram API error: ${tgData.description}`);

  return tgData.result?.message_id;
}

// ─── POST /telegram/send ──────────────────────────────────────────────────────
// Single item — extension can await the response for status feedback
router.post('/send', async (req, res) => {
  const { mediaUrl, title, type, chatId, caption } = req.body || {};
  if (typeof mediaUrl !== 'string' || typeof title !== 'string' || !mediaUrl || !title.trim()) {
    return res.status(400).json({ error: 'mediaUrl and title are required strings' });
  }

  try {
    console.log(`[Telegram] Sending: "${title}"`);
    const messageId = await streamToTelegram({ mediaUrl, title, type, chatId, caption });
    console.log(`[Telegram] ✅ Sent: "${title}" → message_id ${messageId}`);
    res.json({ success: true, messageId, title });
  } catch (err) {
    console.error(`[Telegram] ❌ "${title}":`, err.message);
    res.status(500).json({ error: err.message, title });
  }
});

// ─── POST /telegram/send-bulk ─────────────────────────────────────────────────
// Multiple items — responds immediately, processes in background
// Extension sends: { items: [ { mediaUrl, title, type, caption? } ], chatId? }
router.post('/send-bulk', async (req, res) => {
  const { items, chatId } = req.body || {};
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    return res.status(400).json({ error: 'items[] array required (maximum 50 items)' });
  }
  if (items.some((item) => !item || typeof item.mediaUrl !== 'string' || typeof item.title !== 'string')) {
    return res.status(400).json({ error: 'each item requires mediaUrl and title strings' });
  }

  // Acknowledge immediately so the extension doesn't wait/timeout
  res.json({
    success: true,
    message: `Queued ${items.length} item(s) for Telegram delivery`,
    total: items.length
  });

  // Process sequentially in the background
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      console.log(`[Telegram Bulk] (${i + 1}/${items.length}) Sending: "${item.title}"`);
      await streamToTelegram({ ...item, chatId: item.chatId || chatId });
      console.log(`[Telegram Bulk] ✅ Sent: "${item.title}"`);
    } catch (err) {
      console.error(`[Telegram Bulk] ❌ "${item.title}":`, err.message);
    }
    // Respect Telegram's rate limit between files (3 sec gap)
    if (i < items.length - 1) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  console.log('[Telegram Bulk] ✅ All items processed');
});

module.exports = router;
