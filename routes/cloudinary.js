const express    = require('express');
const router     = express.Router();
const cloudinary = require('cloudinary').v2;
const { validateMediaUrl } = require('../middleware/media-url');

// Configure once from env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ─── POST /cloudinary/upload ──────────────────────────────────────────────────
// Cloudinary natively supports upload-from-URL, so no manual streaming needed.
// It fetches the signed NotebookLM URL server-to-server.
router.post('/upload', async (req, res) => {
  const { mediaUrl, title, type, folder } = req.body || {};
  if (typeof mediaUrl !== 'string' || typeof title !== 'string' || !mediaUrl || !title.trim()) {
    return res.status(400).json({ error: 'mediaUrl and title are required strings' });
  }
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    return res.status(500).json({ error: 'Cloudinary not configured' });
  }

  const resourceType = (type === '3' || type === 'video') ? 'video' : 'auto';
  const publicId     = title.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 60);

  try {
    const safeUrl = validateMediaUrl(mediaUrl);
    console.log(`[Cloudinary] Uploading: "${title}"`);
    const result = await cloudinary.uploader.upload(safeUrl, {
      resource_type:   resourceType,
      public_id:       publicId,
      folder:          folder || 'irfanlm',
      unique_filename: true,
      overwrite:       false
    });

    console.log(`[Cloudinary] ✅ Uploaded: "${title}" → ${result.secure_url}`);
    res.json({ success: true, url: result.secure_url, publicId: result.public_id, title });
  } catch (err) {
    console.error(`[Cloudinary] ❌ "${title}":`, err.message);
    res.status(500).json({ error: err.message, title });
  }
});

module.exports = router;
