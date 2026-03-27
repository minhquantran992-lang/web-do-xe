const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { adminRequired } = require('../middleware/auth');
const {
  listPartsAdmin,
  createPartAdmin,
  updatePartAdmin,
  deletePartAdmin,
  uploadModelPartAdmin
} = require('../controllers/adminPartsController');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'models');
fs.mkdirSync(uploadDir, { recursive: true });

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
    const doubleExt =
      lower.endsWith('.gltf.gltf') ? '.gltf.gltf' : lower.endsWith('.glb.glb') ? '.glb.glb' : '';

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
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = String(file?.originalname || '').toLowerCase();
    if (name.endsWith('.glb') || name.endsWith('.gltf') || name.endsWith('.glb.glb') || name.endsWith('.gltf.gltf')) {
      return cb(null, true);
    }
    return cb(new Error('INVALID_FILE_TYPE'));
  }
});

router.get('/', adminRequired, listPartsAdmin);
router.post('/', adminRequired, createPartAdmin);
router.put('/:id', adminRequired, updatePartAdmin);
router.post('/upload-model', adminRequired, upload.single('file'), uploadModelPartAdmin);
router.delete('/:id', adminRequired, deletePartAdmin);

module.exports = router;

