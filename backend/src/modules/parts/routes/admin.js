const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const { adminRequired } = require('../../../middleware/auth');
const { validateModelFile } = require('../../../security/uploadValidation');
const {
  listPartsAdmin,
  createPartAdmin,
  updatePartAdmin,
  deletePartAdmin,
  uploadModelPartAdmin,
  bulkAssignCompatibleCars
} = require('../controllers/adminPartsController');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', '..', '..', '..', 'uploads', 'models');
fs.mkdirSync(uploadDir, { recursive: true });
const maxMbRaw = Number(process.env.UPLOAD_MODEL_MAX_MB || 200);
const maxBytes = Math.max(1, (Number.isFinite(maxMbRaw) ? maxMbRaw : 200)) * 1024 * 1024;

const sanitizeBaseName = (name) => {
  const cleaned = String(name || '')
    .toLowerCase()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  return cleaned || 'model';
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const original = String(file?.originalname || '').trim();
    const lower = original.toLowerCase();

    const ext = lower.endsWith('.gltf') ? '.gltf' : lower.endsWith('.glb') ? '.glb' : '';
    const doubleExt = lower.endsWith('.gltf.gltf') ? '.gltf.gltf' : lower.endsWith('.glb.glb') ? '.glb.glb' : '';

    const baseRaw = doubleExt ? original.slice(0, -doubleExt.length) : ext ? original.slice(0, -ext.length) : original;
    const base = sanitizeBaseName(baseRaw);
    const filename = `${base}${ext || '.glb'}`;

    const fullPath = path.join(uploadDir, filename);
    if (!fs.existsSync(fullPath)) return cb(null, filename);

    const uniq = `${base}-${Date.now()}${ext || '.glb'}`;
    return cb(null, uniq);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: maxBytes },
  fileFilter: (req, file, cb) => {
    const name = String(file?.originalname || '').toLowerCase();
    if (name.endsWith('.glb') || name.endsWith('.gltf') || name.endsWith('.glb.glb') || name.endsWith('.gltf.gltf')) {
      return cb(null, true);
    }
    return cb(new Error('INVALID_FILE_TYPE'));
  }
});

const uploadOneModel = (req, res, next) => {
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

const validateModelUploaded = async (req, res, next) => {
  const file = req.file;
  if (!file?.path) return next();
  try {
    const checked = await validateModelFile({ filePath: file.path, originalName: file.originalname, maxBytes });
    if (!checked.ok) {
      try {
        await fs.promises.unlink(file.path);
      } catch {}
      const status = checked.error === 'FILE_TOO_LARGE' || checked.error === 'GLTF_TOO_LARGE' ? 413 : 400;
      return res.status(status).json({ error: checked.error });
    }
    req.uploadStats = checked.stats || null;
    return next();
  } catch (e) {
    try {
      await fs.promises.unlink(file.path);
    } catch {}
    return next(e);
  }
};

router.get('/', adminRequired, listPartsAdmin);
router.post('/', adminRequired, createPartAdmin);
router.put('/:id', adminRequired, updatePartAdmin);
router.post('/bulk-assign-compat', adminRequired, bulkAssignCompatibleCars);
router.post('/upload-model', adminRequired, uploadOneModel, validateModelUploaded, uploadModelPartAdmin);
router.delete('/:id', adminRequired, deletePartAdmin);

module.exports = router;
