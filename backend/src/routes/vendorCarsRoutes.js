const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { requireVendorApproved } = require('../middleware/auth');
const { requireVendorCarOwnership } = require('../middleware/vendorOwnership');
const { validateAvatarFile, moderateImageFile } = require('../security/uploadValidation');
const {
  listVendorCars,
  createVendorCar,
  updateVendorCar,
  deleteVendorCar,
  uploadVendorCarImage
} = require('../controllers/vendorCarsController');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'vendor-cars');
fs.mkdirSync(uploadDir, { recursive: true });

const sanitizeBaseName = (name) => {
  const cleaned = String(name || '')
    .toLowerCase()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  return cleaned || 'image';
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const original = String(file?.originalname || '').trim();
    const lower = original.toLowerCase();
    const ext =
      lower.endsWith('.png') ? '.png' : lower.endsWith('.jpg') ? '.jpg' : lower.endsWith('.jpeg') ? '.jpeg' : lower.endsWith('.webp') ? '.webp' : '';
    const baseRaw = ext ? original.slice(0, -ext.length) : original;
    const base = sanitizeBaseName(baseRaw);
    const filename = `${base}${ext || '.jpg'}`;

    const fullPath = path.join(uploadDir, filename);
    if (!fs.existsSync(fullPath)) return cb(null, filename);

    const uniq = `${base}-${Date.now()}${ext || '.jpg'}`;
    return cb(null, uniq);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = String(file?.originalname || '').toLowerCase();
    if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp')) {
      return cb(null, true);
    }
    return cb(new Error('INVALID_FILE_TYPE'));
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

const validateVendorCarImageUploaded = async (req, res, next) => {
  const file = req.file;
  if (!file?.path) return next();
  try {
    const checked = await validateAvatarFile({ filePath: file.path, originalName: file.originalname, maxBytes: 10 * 1024 * 1024 });
    if (!checked.ok) {
      try {
        await fs.promises.unlink(file.path);
      } catch {}
      const status = checked.error === 'FILE_TOO_LARGE' ? 413 : 400;
      return res.status(status).json({ error: checked.error });
    }
    const mod = await moderateImageFile({ filePath: file.path, originalName: file.originalname });
    if (!mod.ok) {
      try {
        await fs.promises.unlink(file.path);
      } catch {}
      return res.status(400).json({ error: mod.error || 'SENSITIVE_IMAGE' });
    }
    return next();
  } catch (e) {
    try {
      await fs.promises.unlink(file.path);
    } catch {}
    return next(e);
  }
};

router.get('/', requireVendorApproved, listVendorCars);
router.post('/', requireVendorApproved, createVendorCar);
router.post('/upload-image', requireVendorApproved, uploadOne, validateVendorCarImageUploaded, uploadVendorCarImage);
router.put('/:id', requireVendorApproved, requireVendorCarOwnership, updateVendorCar);
router.delete('/:id', requireVendorApproved, requireVendorCarOwnership, deleteVendorCar);

module.exports = router;
