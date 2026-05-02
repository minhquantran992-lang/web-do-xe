const express = require('express');
const fs = require('fs');
const multer = require('multer');

const { requireVendorApproved } = require('../middleware/auth');
const { ensureTicketUploadDir, listVendorTickets, getVendorTicket, respondVendorTicket } = require('../controllers/ticketsController');

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
    const vid = String(req.vendor?._id || 'vendor').replace(/[^\w-]/g, '');
    const ext = sanitizeExt(file?.originalname);
    const base = `ticket-vendor-${vid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

router.get('/', requireVendorApproved, listVendorTickets);
router.get('/:id', requireVendorApproved, getVendorTicket);
router.post('/:id/respond', requireVendorApproved, upload.array('files', 8), respondVendorTicket);

module.exports = router;
