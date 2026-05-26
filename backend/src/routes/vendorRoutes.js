const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { authRequired, requireVendor, requireVendorApproved } = require('../middleware/auth');
const { validateAvatarFile, moderateImageFile } = require('../security/uploadValidation');
const {
  getMyShop,
  upsertMyShop,
  setMyAcceptingBookings,
  setMyClosedToday,
  setMyCapacity,
  getMyStats,
  listMyReviews,
  listMyShopPosts,
  createMyShopPost,
  updateMyShopPost,
  deleteMyShopPost,
  listMyBlockedUsers,
  blockUser,
  unblockUser,
  reportSpamUser,
  uploadMyShopImage,
  uploadMyShopPostMedia
} = require('../controllers/vendorController');
const { getVendorBuildDetail } = require('../controllers/vendorBuildsController');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'vendor-shop');
fs.mkdirSync(uploadDir, { recursive: true });
const postsUploadDir = path.join(__dirname, '..', '..', 'uploads', 'vendor-posts');
fs.mkdirSync(postsUploadDir, { recursive: true });

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
    if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp')) return cb(null, true);
    return cb(new Error('INVALID_FILE_TYPE'));
  }
});

const uploadOneShopImage = (req, res, next) => {
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

const validateShopImageUploaded = async (req, res, next) => {
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

const sanitizeExt = (originalname) => {
  const name = String(originalname || '').trim().toLowerCase();
  if (name.endsWith('.png')) return '.png';
  if (name.endsWith('.jpg')) return '.jpg';
  if (name.endsWith('.jpeg')) return '.jpeg';
  if (name.endsWith('.webp')) return '.webp';
  if (name.endsWith('.gif')) return '.gif';
  if (name.endsWith('.mp4')) return '.mp4';
  if (name.endsWith('.webm')) return '.webm';
  if (name.endsWith('.mov')) return '.mov';
  if (name.endsWith('.m4v')) return '.m4v';
  return '';
};

const postsStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, postsUploadDir),
  filename: (req, file, cb) => {
    const vid = String(req.vendor?._id || 'vendor').replace(/[^\w-]/g, '');
    const ext = sanitizeExt(file?.originalname);
    const base = `post-${vid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    cb(null, `${base}${ext || '.bin'}`);
  }
});

const postsUpload = multer({
  storage: postsStorage,
  limits: { fileSize: 60 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const m = String(file?.mimetype || '').toLowerCase();
    const ext = sanitizeExt(file?.originalname);
    if (!ext) return cb(new Error('INVALID_FILE_TYPE'));
    if (m.startsWith('image/') || m.startsWith('video/')) return cb(null, true);
    return cb(new Error('INVALID_FILE_TYPE'));
  }
});

const uploadOnePostMedia = (req, res, next) => {
  postsUpload.single('file')(req, res, (err) => {
    if (!err) return next();
    const code = String(err?.code || '');
    const msg = String(err?.message || '');
    if (code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'FILE_TOO_LARGE' });
    if (msg === 'INVALID_FILE_TYPE') return res.status(400).json({ error: 'INVALID_FILE_TYPE' });
    if (msg.toLowerCase().includes('unexpected field')) return res.status(400).json({ error: 'INVALID_FORMDATA' });
    return next(err);
  });
};

const validatePostMediaUploaded = async (req, res, next) => {
  const file = req.file;
  if (!file?.path) return next();
  const m = String(file?.mimetype || '').toLowerCase();
  if (!m.startsWith('image/')) return next();
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

router.get('/shop', authRequired, getMyShop);
router.post('/shop', authRequired, upsertMyShop);
router.put('/shop', authRequired, upsertMyShop);
router.post('/shop/upload-image', requireVendor, uploadOneShopImage, validateShopImageUploaded, uploadMyShopImage);
router.post('/shop/accepting-bookings', requireVendor, setMyAcceptingBookings);
router.post('/shop/closed-today', requireVendor, setMyClosedToday);
router.post('/shop/capacity', requireVendor, setMyCapacity);
router.get('/stats', requireVendor, getMyStats);
router.get('/builds/:id', requireVendorApproved, getVendorBuildDetail);
router.get('/reviews', requireVendor, listMyReviews);
router.get('/posts', requireVendor, listMyShopPosts);
router.post('/posts', requireVendor, createMyShopPost);
router.post('/posts/upload', requireVendor, uploadOnePostMedia, validatePostMediaUploaded, uploadMyShopPostMedia);
router.put('/posts/:id', requireVendor, updateMyShopPost);
router.delete('/posts/:id', requireVendor, deleteMyShopPost);
router.get('/spam/blocks', requireVendor, listMyBlockedUsers);
router.post('/spam/block', requireVendor, blockUser);
router.delete('/spam/block/:userId', requireVendor, unblockUser);
router.post('/spam/report', requireVendor, reportSpamUser);

module.exports = router;
