const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const { requireVendorApproved } = require('../middleware/auth');
const { listVendorOrders, getVendorOrderDetail, quoteOrder, startOrder, completeOrder, uploadOrderProof } = require('../controllers/vendorOrdersController');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'order-progress');
fs.mkdirSync(uploadDir, { recursive: true });

const sanitizeExt = (name) => {
  const s = String(name || '').trim().toLowerCase();
  if (s.endsWith('.png')) return '.png';
  if (s.endsWith('.jpg') || s.endsWith('.jpeg')) return '.jpg';
  if (s.endsWith('.webp')) return '.webp';
  return '';
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const vid = String(req.vendor?._id || 'vendor').replace(/[^\w-]/g, '');
    const ext = sanitizeExt(file?.originalname);
    const base = `order-proof-${vid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    cb(null, `${base}${ext || '.jpg'}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = sanitizeExt(file?.originalname);
    if (!ext) return cb(new Error('INVALID_FILE_TYPE'));
    return cb(null, true);
  }
});

const uploadOne = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    const code = String(err?.code || '');
    const msg = String(err?.message || '');
    if (code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'FILE_TOO_LARGE' });
    if (msg === 'INVALID_FILE_TYPE') return res.status(400).json({ error: 'INVALID_FILE_TYPE' });
    if (msg.toLowerCase().includes('unexpected field')) return res.status(400).json({ error: 'INVALID_FORMDATA' });
    return next(err);
  });
};

router.get('/', requireVendorApproved, listVendorOrders);
router.get('/:id', requireVendorApproved, getVendorOrderDetail);
router.post('/:id/quote', requireVendorApproved, quoteOrder);
router.post('/:id/start', requireVendorApproved, startOrder);
router.post('/:id/complete', requireVendorApproved, completeOrder);
router.post('/:id/upload-proof', requireVendorApproved, uploadOne, uploadOrderProof);

module.exports = router;
