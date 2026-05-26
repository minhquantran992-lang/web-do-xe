const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { adminRequired } = require('../middleware/auth');
const { validateAvatarFile, moderateImageFile } = require('../security/uploadValidation');
const {
  listBackgroundsAdmin,
  createBackgroundAdmin,
  updateBackgroundAdmin,
  deleteBackgroundAdmin,
  uploadBackgroundImageAdmin
} = require('../controllers/adminBackgroundsController');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'backgrounds');
fs.mkdirSync(uploadDir, { recursive: true });

const sanitizeBaseName = (name) => {
  const cleaned = String(name || '')
    .toLowerCase()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  return cleaned || 'background';
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const original = String(file?.originalname || '').trim();
    const lower = original.toLowerCase();
    const ext = lower.endsWith('.png')
      ? '.png'
      : lower.endsWith('.jpg') || lower.endsWith('.jpeg')
        ? '.jpg'
        : lower.endsWith('.webp')
          ? '.webp'
          : '';
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
  fileFilter: (_req, file, cb) => {
    const name = String(file?.originalname || '').toLowerCase();
    if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp')) return cb(null, true);
    return cb(new Error('INVALID_FILE_TYPE'));
  }
});

const validateBackgroundImageUploaded = async (req, res, next) => {
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

router.get('/', adminRequired, listBackgroundsAdmin);
router.post('/', adminRequired, createBackgroundAdmin);
router.patch('/:id', adminRequired, updateBackgroundAdmin);
router.post('/upload-image', adminRequired, upload.single('file'), validateBackgroundImageUploaded, uploadBackgroundImageAdmin);
router.delete('/:id', adminRequired, deleteBackgroundAdmin);

module.exports = router;
