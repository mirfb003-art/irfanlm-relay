const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();
const { validateMediaUrl } = require('../middleware/media-url');

function isMediaContentType(value) {
  return /^(audio|video)\//i.test(value) || /^(application\/octet-stream|application\/mp4|application\/ogg)$/i.test(value);
}

async function inspectCandidate(rawUrl) {
  const safeUrl = validateMediaUrl(rawUrl);
  let response;
  try {
    response = await fetch(safeUrl, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': 'IrfanLM-Relay/1.2' },
      timeout: 20000,
    });
    if (response.status === 405 || response.status === 501) {
      response = await fetch(safeUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'Range': 'bytes=0-0', 'User-Agent': 'IrfanLM-Relay/1.2' },
        timeout: 20000,
      });
    }
  } catch (error) {
    return { ok: false, error: error.message };
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const contentLength = Number(response.headers.get('content-length') || 0) || null;
  const finalUrl = response.url || safeUrl;
  const isMedia = response.ok && isMediaContentType(contentType) && (contentLength === null || contentLength > 0);
  if (response.body && typeof response.body.destroy === 'function') response.body.destroy();
  return {
    ok: isMedia,
    status: response.status,
    finalHost: (() => { try { return new URL(finalUrl).hostname; } catch { return null; } })(),
    contentType,
    contentLength,
    reason: isMedia ? 'media' : (!response.ok ? `HTTP ${response.status}` : `non-media content-type: ${contentType || 'missing'}`),
  };
}

router.post('/inspect', async (req, res) => {
  const candidates = req.body?.candidates;
  if (!Array.isArray(candidates) || candidates.length < 1 || candidates.length > 4 || candidates.some((u) => typeof u !== 'string')) {
    return res.status(400).json({ error: 'candidates[] with 1 to 4 URL strings is required' });
  }
  const results = [];
  for (const candidate of candidates) results.push(await inspectCandidate(candidate));
  const selectedIndex = results.findIndex((result) => result.ok);
  res.json({ success: true, selectedIndex, results });
});

module.exports = router;
