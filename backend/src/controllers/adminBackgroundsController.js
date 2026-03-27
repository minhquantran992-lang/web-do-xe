const mongoose = require('mongoose');

const BackgroundPreset = require('../models/BackgroundPreset');
const { asyncHandler } = require('../middleware/asyncHandler');

const normalizeKey = (raw) => {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

const listBackgroundsAdmin = asyncHandler(async (_req, res) => {
  const items = await BackgroundPreset.find({})
    .sort({ sortOrder: 1, createdAt: -1 })
    .select('key label kind color css imageUrl enabled sortOrder createdAt updatedAt')
    .lean();
  res.json({ items });
});

const createBackgroundAdmin = asyncHandler(async (req, res) => {
  const key = normalizeKey(req.body?.key);
  const label = String(req.body?.label || '').trim();
  const kind = String(req.body?.kind || '').trim();
  const color = String(req.body?.color || '').trim();
  const css = String(req.body?.css || '').trim();
  const imageUrl = String(req.body?.imageUrl || req.body?.image_url || '').trim();
  const enabledRaw = req.body?.enabled;
  const enabled = enabledRaw === undefined || enabledRaw === null ? true : Boolean(enabledRaw);
  const sortOrderRaw = req.body?.sortOrder ?? req.body?.sort_order;
  const sortOrderNum = sortOrderRaw === '' || sortOrderRaw === null || sortOrderRaw === undefined ? 0 : Number(sortOrderRaw);
  const sortOrder = Number.isFinite(sortOrderNum) ? sortOrderNum : 0;

  if (!key) return res.status(400).json({ error: 'MISSING_KEY' });
  if (!label) return res.status(400).json({ error: 'MISSING_LABEL' });
  if (!['color', 'gradient', 'image'].includes(kind)) return res.status(400).json({ error: 'INVALID_KIND' });
  if (kind === 'color' && !color) return res.status(400).json({ error: 'MISSING_COLOR' });
  if (kind === 'gradient' && !css) return res.status(400).json({ error: 'MISSING_CSS' });
  if (kind === 'image' && !imageUrl) return res.status(400).json({ error: 'MISSING_IMAGE_URL' });

  const created = await BackgroundPreset.create({ key, label, kind, color, css, imageUrl, enabled, sortOrder });
  res.status(201).json({ item: created });
});

const updateBackgroundAdmin = asyncHandler(async (req, res) => {
  const id = String(req.params.id || '');
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const patch = {};
  if (req.body?.label !== undefined) patch.label = String(req.body.label || '').trim();
  if (req.body?.enabled !== undefined) patch.enabled = Boolean(req.body.enabled);

  const kind = req.body?.kind !== undefined ? String(req.body.kind || '').trim() : undefined;
  if (kind !== undefined) patch.kind = kind;

  if (req.body?.color !== undefined) patch.color = String(req.body.color || '').trim();
  if (req.body?.css !== undefined) patch.css = String(req.body.css || '').trim();
  if (req.body?.imageUrl !== undefined || req.body?.image_url !== undefined) {
    patch.imageUrl = String(req.body?.imageUrl || req.body?.image_url || '').trim();
  }
  const sortOrderRaw = req.body?.sortOrder ?? req.body?.sort_order;
  if (sortOrderRaw !== undefined) {
    const n = sortOrderRaw === '' || sortOrderRaw === null ? 0 : Number(sortOrderRaw);
    patch.sortOrder = Number.isFinite(n) ? n : 0;
  }

  if (patch.kind && !['color', 'gradient', 'image'].includes(patch.kind)) return res.status(400).json({ error: 'INVALID_KIND' });

  const existing = await BackgroundPreset.findById(id).lean();
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND' });

  const nextKind = patch.kind ?? existing.kind;
  const nextColor = patch.color ?? existing.color;
  const nextCss = patch.css ?? existing.css;
  const nextImageUrl = patch.imageUrl ?? existing.imageUrl;

  if (nextKind === 'color' && !String(nextColor || '').trim()) return res.status(400).json({ error: 'MISSING_COLOR' });
  if (nextKind === 'gradient' && !String(nextCss || '').trim()) return res.status(400).json({ error: 'MISSING_CSS' });
  if (nextKind === 'image' && !String(nextImageUrl || '').trim()) return res.status(400).json({ error: 'MISSING_IMAGE_URL' });

  const updated = await BackgroundPreset.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
  res.json({ item: updated });
});

const deleteBackgroundAdmin = asyncHandler(async (req, res) => {
  const id = String(req.params.id || '');
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });
  const deleted = await BackgroundPreset.findByIdAndDelete(id).lean();
  if (!deleted) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ ok: true });
});

const uploadBackgroundImageAdmin = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'MISSING_FILE' });
  res.status(201).json({ url: `/uploads/backgrounds/${file.filename}` });
});

module.exports = {
  listBackgroundsAdmin,
  createBackgroundAdmin,
  updateBackgroundAdmin,
  deleteBackgroundAdmin,
  uploadBackgroundImageAdmin
};

