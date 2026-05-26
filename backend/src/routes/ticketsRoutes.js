const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const { authRequired } = require('../middleware/auth');
const { moderateImageFile } = require('../security/uploadValidation');
const {
  ensureTicketUploadDir,
  listMyTickets,
  getMyTicket,
  createMyTicket,
  addMyTicketEvidence
} = require('../controllers/ticketsController');

const router = express.Router();

const uploadDir = ensureTicketUploadDir();
fs.mkdirSync(uploadDir, { recursive: true });

const sanitizeExt = (name) => {
  const n = String(name || '').toLowerCase().trim();
  if (n.endsWith('.png')) return '.png';
  if (n.endsWith('.webp')) return '.webp';
  if (n.endsWith('.gif')) return '.gif';
  if (n.endsWith('.jpeg') || n.endsWith('.jpg')) return '.jpg';
  if (n.endsWith('.mp4')) return '.mp4';
  if (n.endsWith('.webm')) return '.webm';
  if (n.endsWith('.mov')) return '.mov';
  return '';
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uid = String(req.user?.id || 'user').replace(/[^\w-]/g, '');
    const ext = sanitizeExt(file?.originalname);
    const base = `ticket-${uid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    cb(null, `${base}${ext || '.bin'}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 8 },
  fileFilter: (req, file, cb) => {
    const m = String(file?.mimetype || '').toLowerCase();
    const ext = sanitizeExt(file?.originalname);
    if (!ext) return cb(new Error('INVALID_FILE_TYPE'));
    if (m.startsWith('image/') || m.startsWith('video/')) return cb(null, true);
    return cb(new Error('INVALID_FILE_TYPE'));
  }
});

const moderateUploadedImages = async (req, res, next) => {
  const files = Array.isArray(req.files) ? req.files : [];
  if (!files.length) return next();
  try {
    for (const f of files) {
      const p = String(f?.path || '').trim();
      if (!p) continue;
      const m = String(f?.mimetype || '').toLowerCase();
      if (!m.startsWith('image/')) continue;
      const mod = await moderateImageFile({ filePath: p, originalName: f?.originalname });
      if (!mod.ok) {
        for (const x of files) {
          const xp = String(x?.path || '').trim();
          if (!xp) continue;
          try {
            await fs.promises.unlink(xp);
          } catch {}
        }
        return res.status(400).json({ error: mod.error || 'SENSITIVE_IMAGE' });
      }
    }
    return next();
  } catch (e) {
    return next(e);
  }
};

router.get('/my', authRequired, listMyTickets);
router.get('/:id', authRequired, getMyTicket);
router.post('/', authRequired, upload.array('files', 8), moderateUploadedImages, createMyTicket);
router.post('/:id/evidence', authRequired, upload.array('files', 8), moderateUploadedImages, addMyTicketEvidence);

module.exports = router;
