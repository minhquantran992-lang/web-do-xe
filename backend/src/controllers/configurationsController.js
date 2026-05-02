const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const Car = require('../models/Car');
const Part = require('../models/Part');
const Configuration = require('../models/Configuration');
const BuildVote = require('../models/BuildVote');
const BuildFavorite = require('../models/BuildFavorite');
const { asyncHandler } = require('../middleware/asyncHandler');

const SLOT_RULES = {
  exhaust: ['exhaust'],
  clutch: ['clutch'],
  wheels: ['wheels'],
  brake: ['brake'],
  suspension: ['suspension'],
  suspension_front: ['suspension'],
  suspension_rear: ['suspension'],
  tire: ['tire'],
  handlebar: ['handlebar'],
  bodykit: ['bodykit'],
  seat: ['seat'],
  lighting: ['lighting'],
  topbox: ['topbox'],
  throttle_housing: ['throttle_housing']
};

const normalizeSlot = (raw) => String(raw || '').trim().toLowerCase();

const validateSlot = (slot) => {
  if (!slot) return { ok: false, error: 'MISSING_SLOT' };
  if (!/^[a-z0-9_]+$/.test(slot)) return { ok: false, error: 'INVALID_SLOT' };
  if (!SLOT_RULES[slot]) return { ok: false, error: 'UNSUPPORTED_SLOT' };
  return { ok: true };
};

const normalizeHex = (value) => {
  const v = String(value || '').trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) return v;
  return '';
};

const normalizeSlotColors = (raw) => {
  const src = raw && typeof raw === 'object' ? raw : null;
  if (!src) return {};
  const out = {};
  for (const [k, v] of Object.entries(src)) {
    const slot = normalizeSlot(k);
    const slotCheck = validateSlot(slot);
    if (!slotCheck.ok) continue;
    const c = normalizeHex(v);
    if (!c) continue;
    out[slot] = c;
  }
  return out;
};

const buildLegacyFromPartsMap = (partsMap) => {
  const partsObj = partsMap && typeof partsMap === 'object' ? partsMap : {};
  const wheels = partsObj.wheels ? String(partsObj.wheels) : null;
  const selectedParts = Object.entries(partsObj)
    .filter(([k]) => k !== 'wheels')
    .map(([, v]) => String(v || ''))
    .filter((id) => mongoose.isValidObjectId(id));
  return { selectedWheels: wheels && mongoose.isValidObjectId(wheels) ? wheels : null, selectedParts };
};

const toSafeArray3 = (value) => {
  const arr = Array.isArray(value) ? value : [];
  const out = arr.slice(0, 3).map((n) => Number(n));
  if (out.length !== 3) return null;
  if (out.some((n) => !Number.isFinite(n))) return null;
  return out;
};

const normalizeCamera = (raw) => {
  const cam = raw && typeof raw === "object" ? raw : null;
  if (!cam) return null;
  const position = toSafeArray3(cam.position);
  const target = toSafeArray3(cam.target);
  if (!position || !target) return null;
  return { position, target };
};

const buildPublicCard = (doc) => {
  const carThumb = doc?.carId?.thumbnailUrl ? String(doc.carId.thumbnailUrl) : '';
  const thumb = doc?.thumbnailUrl ? String(doc.thumbnailUrl) : '';
  const imageUrl = thumb || carThumb;
  return { ...doc, imageUrl, votes: doc?.likesCount || 0, favorites: doc?.favoritesCount || 0, views: doc?.viewsCount || 0 };
};

const leaderboardCache = new Map();
const LEADERBOARD_TTL_MS = 10_000;

const getRangeSince = (range) => {
  const r = String(range || '').trim().toLowerCase();
  if (r === 'day' || r === 'daily') return new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (r === 'week' || r === 'weekly') return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (r === 'month' || r === 'monthly') return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return null;
};

const createConfiguration = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const carId = String(req.body?.car_id || req.body?.carId || '');
  const selectedColor = String(req.body?.selected_color || req.body?.selectedColor || '#ffffff');
  const slotColors = normalizeSlotColors(req.body?.slot_colors || req.body?.slotColors || {});
  const selectedWheels = req.body?.selected_wheels || req.body?.selectedWheels || null;
  const selectedParts = req.body?.selected_parts || req.body?.selectedParts || [];
  const name = String(req.body?.name || '').trim();

  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!carId) return res.status(400).json({ error: 'MISSING_CAR' });
  if (!mongoose.isValidObjectId(carId)) return res.status(400).json({ error: 'INVALID_CAR' });

  const car = await Car.findById(carId).lean();
  if (!car) return res.status(404).json({ error: 'CAR_NOT_FOUND' });

  const partIds = [];
  if (selectedWheels && mongoose.isValidObjectId(String(selectedWheels))) {
    partIds.push(String(selectedWheels));
  }
  if (Array.isArray(selectedParts)) {
    for (const id of selectedParts) {
      if (mongoose.isValidObjectId(String(id))) partIds.push(String(id));
    }
  }

  if (partIds.length) {
    const rows = await Part.find({ _id: { $in: partIds } })
      .select('_id type')
      .lean();
    const byId = new Map(rows.map((r) => [String(r._id), r]));
    if (rows.length !== new Set(partIds).size) return res.status(400).json({ error: 'INVALID_PARTS' });

    const parts = {};
    const wheelsId = selectedWheels && mongoose.isValidObjectId(String(selectedWheels)) ? String(selectedWheels) : '';
    if (wheelsId) parts.wheels = wheelsId;

    if (Array.isArray(selectedParts)) {
      for (const rawId of selectedParts) {
        const id = String(rawId || '').trim();
        if (!mongoose.isValidObjectId(id)) continue;
        const p = byId.get(id);
        if (!p) continue;
        const slot = normalizeSlot(p.type);
        if (!SLOT_RULES[slot]) continue;
        if (slot === 'wheels') continue;
        parts[slot] = id;
      }
    }

    const legacy = buildLegacyFromPartsMap(parts);
    const doc = await Configuration.create({
      userId,
      carId,
      selectedColor,
      slotColors,
      selectedWheels: legacy.selectedWheels,
      selectedParts: legacy.selectedParts,
      parts,
      name
    });

    return res.status(201).json({ item: doc });
  }

  const doc = await Configuration.create({
    userId,
    carId,
    selectedColor,
    slotColors,
    selectedWheels: selectedWheels && mongoose.isValidObjectId(String(selectedWheels)) ? String(selectedWheels) : null,
    selectedParts: Array.isArray(selectedParts) ? selectedParts.filter((id) => mongoose.isValidObjectId(String(id))) : [],
    parts: {},
    name
  });

  res.status(201).json({ item: doc });
});

const updateConfigurationPart = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const configId = String(req.params?.id || '').trim();
  let slot = normalizeSlot(req.body?.slot || req.body?.type || '');
  const partIdRaw = req.body?.partId ?? req.body?.part_id ?? req.body?.part;
  const partId = partIdRaw === null || partIdRaw === undefined || partIdRaw === '' ? null : String(partIdRaw).trim();

  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!mongoose.isValidObjectId(configId)) return res.status(400).json({ error: 'INVALID_CONFIG' });

  if (partId !== null) {
    if (!mongoose.isValidObjectId(partId)) return res.status(400).json({ error: 'INVALID_PART' });
    const part = await Part.findById(partId).select('_id type').lean();
    if (!part) return res.status(404).json({ error: 'PART_NOT_FOUND' });
    if (!slot) slot = normalizeSlot(part.type);
    const slotCheck = validateSlot(slot);
    if (!slotCheck.ok) return res.status(400).json({ error: slotCheck.error });
    const allowedTypes = SLOT_RULES[slot] || [];
    if (!allowedTypes.includes(String(part.type || ''))) return res.status(400).json({ error: 'PART_TYPE_MISMATCH' });
  } else {
    const slotCheck = validateSlot(slot);
    if (!slotCheck.ok) return res.status(400).json({ error: slotCheck.error });
  }

  const update = partId === null ? { $unset: { [`parts.${slot}`]: 1 } } : { $set: { [`parts.${slot}`]: partId } };
  const base = await Configuration.findOneAndUpdate({ _id: configId, userId }, update, { new: true }).lean();
  if (!base) return res.status(404).json({ error: 'CONFIG_NOT_FOUND' });

  const legacy = buildLegacyFromPartsMap(base.parts || {});
  const updated = await Configuration.findOneAndUpdate(
    { _id: configId, userId },
    { $set: { selectedWheels: legacy.selectedWheels, selectedParts: legacy.selectedParts } },
    { new: true }
  )
    .populate('carId', 'name thumbnailUrl modelUrl model3d emissions')
    .populate('selectedWheels', 'name type price thumbnailUrl modelUrl emissions')
    .populate('selectedParts', 'name type price thumbnailUrl modelUrl emissions');

  res.json({ item: updated });
});

const updateConfigurationPaint = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const configId = String(req.params?.id || '').trim();
  const selectedColorRaw = req.body?.selected_color ?? req.body?.selectedColor;
  const slotColorsRaw = req.body?.slot_colors ?? req.body?.slotColors;

  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!mongoose.isValidObjectId(configId)) return res.status(400).json({ error: 'INVALID_CONFIG' });

  const patch = {};
  if (selectedColorRaw !== undefined) {
    const c = normalizeHex(selectedColorRaw);
    if (!c) return res.status(400).json({ error: 'INVALID_COLOR' });
    patch.selectedColor = c;
  }

  if (slotColorsRaw !== undefined) {
    patch.slotColors = normalizeSlotColors(slotColorsRaw);
  }

  const updated = await Configuration.findOneAndUpdate({ _id: configId, userId }, { $set: patch }, { new: true })
    .populate('carId', 'name thumbnailUrl modelUrl model3d emissions')
    .populate('selectedWheels', 'name type price thumbnailUrl modelUrl emissions')
    .populate('selectedParts', 'name type price thumbnailUrl modelUrl emissions');

  if (!updated) return res.status(404).json({ error: 'CONFIG_NOT_FOUND' });
  res.json({ item: updated });
});

const listUserConfigurations = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const items = await Configuration.find({ userId })
    .sort({ createdAt: -1 })
    .populate('carId', 'name thumbnailUrl modelUrl model3d emissions combinedModels combinedModelSlots')
    .populate('selectedWheels', 'name type variantKey price thumbnailUrl modelUrl mountPoint mountPoints emissions')
    .populate('selectedParts', 'name type variantKey price thumbnailUrl modelUrl mountPoint mountPoints emissions')
    .lean();

  const toPlain = (v) => {
    if (!v) return v;
    if (v instanceof Map) return Object.fromEntries(v.entries());
    if (typeof v?.entries === 'function' && typeof v?.get === 'function') {
      try {
        return Object.fromEntries(Array.from(v.entries()));
      } catch {
        return v;
      }
    }
    return v;
  };

  const out = (Array.isArray(items) ? items : []).map((it) => {
    const next = it && typeof it === 'object' ? { ...it } : it;
    if (next?.carId && typeof next.carId === 'object') {
      next.carId = { ...next.carId, combinedModels: toPlain(next.carId.combinedModels) || {} };
    }
    next.slotColors = toPlain(next.slotColors) || {};
    return next;
  });

  res.json({ items: out });
});

const setConfigurationPublic = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const configId = String(req.params?.id || '').trim();
  const isPublicRaw = req.body?.isPublic ?? req.body?.public ?? req.body?.published;
  const isPublic =
    isPublicRaw === true ||
    isPublicRaw === 1 ||
    isPublicRaw === '1' ||
    String(isPublicRaw || '').toLowerCase() === 'true';

  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!mongoose.isValidObjectId(configId)) return res.status(400).json({ error: 'INVALID_CONFIG' });

  const patch = isPublic ? { isPublic: true, publishedAt: new Date() } : { isPublic: false, publishedAt: null };

  const updated = await Configuration.findOneAndUpdate({ _id: configId, userId }, { $set: patch }, { new: true })
    .populate('userId', 'name avatar')
    .populate('carId', 'name thumbnailUrl modelUrl model3d emissions')
    .populate('selectedWheels', 'name type price thumbnailUrl modelUrl emissions')
    .populate('selectedParts', 'name type price thumbnailUrl modelUrl emissions')
    .lean();

  if (!updated) return res.status(404).json({ error: 'CONFIG_NOT_FOUND' });
  res.json({ item: updated });
});

const listPublicConfigurations = asyncHandler(async (req, res) => {
  const limitRaw = req.query?.limit ?? req.query?.take ?? 24;
  const limit = Math.max(1, Math.min(60, Number(limitRaw) || 24));
  const range = String(req.query?.range || req.query?.tab || '').trim().toLowerCase();
  const since = getRangeSince(range);
  const userId = String(req.user?.id || '').trim();

  const cacheKey = `${since ? String(since.getTime()) : 'all'}:${limit}`;
  const cached = leaderboardCache.get(cacheKey);
  const now = Date.now();

  let items = null;
  if (cached && now - cached.ts < LEADERBOARD_TTL_MS) {
    items = cached.items;
  } else {
    const q = { isPublic: true };
    if (since) q.publishedAt = { $gte: since };

    items = await Configuration.find(q)
      .sort({ likesCount: -1, publishedAt: -1, createdAt: -1 })
      .limit(limit)
      .populate('userId', 'name avatar')
      .populate('carId', 'name thumbnailUrl modelUrl model3d emissions')
      .populate('selectedWheels', 'name type price thumbnailUrl modelUrl emissions')
      .populate('selectedParts', 'name type price thumbnailUrl modelUrl emissions')
      .lean();

    leaderboardCache.set(cacheKey, { ts: now, items });
  }

  const ids = items.map((x) => x?._id).filter((x) => mongoose.isValidObjectId(String(x)));
  let votedByMe = new Set();
  let favoritedByMe = new Set();
  if (userId && ids.length) {
    const [votes, favs] = await Promise.all([
      BuildVote.find({ userId, buildId: { $in: ids } }).select('buildId').lean(),
      BuildFavorite.find({ userId, buildId: { $in: ids } }).select('buildId').lean()
    ]);
    votedByMe = new Set((votes || []).map((v) => String(v.buildId)));
    favoritedByMe = new Set((favs || []).map((f) => String(f.buildId)));
  }

  const out = items.map((it) => {
    const id = String(it?._id || '');
    const base = buildPublicCard(it);
    const next = { ...base, likedByMe: userId ? votedByMe.has(id) : false, favoritedByMe: userId ? favoritedByMe.has(id) : false };
    delete next.likedBy;
    return next;
  });

  res.json({ items: out });
});

const likeConfiguration = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const configId = String(req.params?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!mongoose.isValidObjectId(configId)) return res.status(400).json({ error: 'INVALID_CONFIG' });

  const build = await Configuration.findOne({ _id: configId, isPublic: true }).select('_id likesCount favoritesCount viewsCount thumbnailUrl carId userId').lean();
  if (!build) return res.status(404).json({ error: 'CONFIG_NOT_FOUND' });

  let created = false;
  try {
    await BuildVote.create({ userId, buildId: configId });
    created = true;
  } catch (e) {
    if (e?.code !== 11000) throw e;
  }

  if (created) await Configuration.updateOne({ _id: configId }, { $inc: { likesCount: 1 } });

  const updated = await Configuration.findById(configId)
    .populate('userId', 'name avatar')
    .populate('carId', 'name thumbnailUrl modelUrl model3d emissions')
    .populate('selectedWheels', 'name type price thumbnailUrl modelUrl emissions')
    .populate('selectedParts', 'name type price thumbnailUrl modelUrl emissions')
    .lean();

  if (!updated) return res.status(404).json({ error: 'CONFIG_NOT_FOUND' });
  const fav = await BuildFavorite.findOne({ userId, buildId: configId }).select('_id').lean();
  const out = { ...buildPublicCard(updated), likedByMe: true, favoritedByMe: Boolean(fav) };
  delete out.likedBy;
  res.json({ item: out });
});

const unlikeConfiguration = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const configId = String(req.params?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!mongoose.isValidObjectId(configId)) return res.status(400).json({ error: 'INVALID_CONFIG' });

  const del = await BuildVote.deleteOne({ userId, buildId: configId });
  if (del.deletedCount) {
    const updated = await Configuration.findOneAndUpdate({ _id: configId }, { $inc: { likesCount: -1 } }, { new: true })
      .populate('userId', 'name avatar')
      .populate('carId', 'name thumbnailUrl modelUrl model3d emissions')
      .populate('selectedWheels', 'name type price thumbnailUrl modelUrl emissions')
      .populate('selectedParts', 'name type price thumbnailUrl modelUrl emissions')
      .lean();

    if (updated && (updated.likesCount || 0) < 0) {
      await Configuration.updateOne({ _id: configId }, { $set: { likesCount: 0 } });
      updated.likesCount = 0;
    }
    if (updated) {
      const fav = await BuildFavorite.findOne({ userId, buildId: configId }).select('_id').lean();
      const out = { ...buildPublicCard(updated), likedByMe: false, favoritedByMe: Boolean(fav) };
      delete out.likedBy;
      return res.json({ item: out });
    }
  }

  const existing = await Configuration.findById(configId).select('isPublic likesCount').lean();
  if (!existing) return res.status(404).json({ error: 'CONFIG_NOT_FOUND' });
  if (!existing.isPublic) return res.status(403).json({ error: 'NOT_PUBLIC' });
  res.json({ item: { _id: existing._id, likesCount: existing.likesCount || 0, likedByMe: false } });
});

const favoriteConfiguration = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const configId = String(req.params?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!mongoose.isValidObjectId(configId)) return res.status(400).json({ error: 'INVALID_CONFIG' });

  const build = await Configuration.findOne({ _id: configId, isPublic: true }).select('_id favoritesCount').lean();
  if (!build) return res.status(404).json({ error: 'CONFIG_NOT_FOUND' });

  let created = false;
  try {
    await BuildFavorite.create({ userId, buildId: configId });
    created = true;
  } catch (e) {
    if (e?.code !== 11000) throw e;
  }
  if (created) await Configuration.updateOne({ _id: configId }, { $inc: { favoritesCount: 1 } });

  const updated = await Configuration.findById(configId)
    .populate('userId', 'name avatar')
    .populate('carId', 'name thumbnailUrl modelUrl model3d emissions')
    .populate('selectedWheels', 'name type price thumbnailUrl modelUrl emissions')
    .populate('selectedParts', 'name type price thumbnailUrl modelUrl emissions')
    .lean();
  if (!updated) return res.status(404).json({ error: 'CONFIG_NOT_FOUND' });

  const vote = await BuildVote.findOne({ userId, buildId: configId }).select('_id').lean();
  const out = { ...buildPublicCard(updated), likedByMe: Boolean(vote), favoritedByMe: true };
  delete out.likedBy;
  res.json({ item: out });
});

const unfavoriteConfiguration = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const configId = String(req.params?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!mongoose.isValidObjectId(configId)) return res.status(400).json({ error: 'INVALID_CONFIG' });

  const del = await BuildFavorite.deleteOne({ userId, buildId: configId });
  if (del.deletedCount) {
    const updated = await Configuration.findOneAndUpdate({ _id: configId }, { $inc: { favoritesCount: -1 } }, { new: true })
      .populate('userId', 'name avatar')
      .populate('carId', 'name thumbnailUrl modelUrl model3d emissions')
      .populate('selectedWheels', 'name type price thumbnailUrl modelUrl emissions')
      .populate('selectedParts', 'name type price thumbnailUrl modelUrl emissions')
      .lean();

    if (updated && (updated.favoritesCount || 0) < 0) {
      await Configuration.updateOne({ _id: configId }, { $set: { favoritesCount: 0 } });
      updated.favoritesCount = 0;
    }
    if (updated) {
      const vote = await BuildVote.findOne({ userId, buildId: configId }).select('_id').lean();
      const out = { ...buildPublicCard(updated), likedByMe: Boolean(vote), favoritedByMe: false };
      delete out.likedBy;
      return res.json({ item: out });
    }
  }

  const existing = await Configuration.findById(configId).select('isPublic favoritesCount').lean();
  if (!existing) return res.status(404).json({ error: 'CONFIG_NOT_FOUND' });
  if (!existing.isPublic) return res.status(403).json({ error: 'NOT_PUBLIC' });
  res.json({ item: { _id: existing._id, favoritesCount: existing.favoritesCount || 0, favoritedByMe: false } });
});

const shareBuild = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const configId = String(req.body?.configId || req.body?.configurationId || req.body?.id || '').trim();
  const name = String(req.body?.name || '').trim();
  const backgroundKey = String(req.body?.backgroundKey || req.body?.background || '').trim();
  const camera = normalizeCamera(req.body?.camera);
  const imageData = String(req.body?.imageData || '').trim();

  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!mongoose.isValidObjectId(configId)) return res.status(400).json({ error: 'INVALID_CONFIG' });

  const base = await Configuration.findOne({ _id: configId, userId }).select('_id').lean();
  if (!base) return res.status(404).json({ error: 'CONFIG_NOT_FOUND' });

  const patch = { isPublic: true, publishedAt: new Date() };
  if (name) patch.name = name;
  if (backgroundKey) patch.backgroundKey = backgroundKey;
  if (camera) patch.camera = camera;

  if (imageData && imageData.startsWith('data:image/')) {
    const m = imageData.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
    if (m) {
      const ext = m[1].toLowerCase() === 'png' ? 'png' : 'jpg';
      const b64 = m[2];
      const buf = Buffer.from(b64, 'base64');
      const dir = path.join(__dirname, '..', '..', 'uploads', 'builds');
      fs.mkdirSync(dir, { recursive: true });
      const file = `${configId}-${Date.now()}.${ext}`;
      fs.writeFileSync(path.join(dir, file), buf);
      patch.thumbnailUrl = `/uploads/builds/${file}`;
    }
  }

  await Configuration.updateOne({ _id: configId, userId }, { $set: patch });

  const updated = await Configuration.findById(configId)
    .populate('userId', 'name avatar')
    .populate('carId', 'name thumbnailUrl modelUrl model3d emissions')
    .populate('selectedWheels', 'name type price thumbnailUrl modelUrl emissions')
    .populate('selectedParts', 'name type price thumbnailUrl modelUrl emissions')
    .lean();
  if (!updated) return res.status(404).json({ error: 'CONFIG_NOT_FOUND' });

  const out = { ...buildPublicCard(updated), likedByMe: false, favoritedByMe: false };
  delete out.likedBy;
  res.json({ item: out });
});

const setConfigurationThumbnail = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const configId = String(req.params?.id || '').trim();
  const backgroundKey = String(req.body?.backgroundKey || req.body?.background || '').trim();
  const camera = normalizeCamera(req.body?.camera);
  const imageData = String(req.body?.imageData || '').trim();

  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!mongoose.isValidObjectId(configId)) return res.status(400).json({ error: 'INVALID_CONFIG' });
  if (!imageData || !imageData.startsWith('data:image/')) return res.status(400).json({ error: 'INVALID_IMAGE' });

  const existing = await Configuration.findOne({ _id: configId, userId }).select('_id thumbnailUrl').lean();
  if (!existing) return res.status(404).json({ error: 'CONFIG_NOT_FOUND' });

  const m = imageData.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
  if (!m) return res.status(400).json({ error: 'INVALID_IMAGE' });

  const kind = m[1].toLowerCase();
  const ext = kind === 'png' ? 'png' : kind === 'webp' ? 'webp' : 'jpg';
  const b64 = m[2];
  const buf = Buffer.from(b64, 'base64');

  const dir = path.join(__dirname, '..', '..', 'uploads', 'builds');
  fs.mkdirSync(dir, { recursive: true });
  const file = `${configId}-${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(dir, file), buf);
  const nextUrl = `/uploads/builds/${file}`;

  const prev = String(existing?.thumbnailUrl || '').trim();
  if (prev.startsWith('/uploads/builds/')) {
    const rel = prev.replace(/^\/+/, '');
    const abs = path.join(__dirname, '..', '..', rel);
    try {
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    } catch {}
  }

  const patch = { thumbnailUrl: nextUrl };
  if (backgroundKey) patch.backgroundKey = backgroundKey;
  if (camera) patch.camera = camera;
  await Configuration.updateOne({ _id: configId, userId }, { $set: patch });

  res.json({ ok: true, thumbnailUrl: nextUrl });
});

const getPublicBuildDetail = asyncHandler(async (req, res) => {
  const id = String(req.params?.id || '').trim();
  const userId = String(req.user?.id || '').trim();
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_BUILD' });

  await Configuration.updateOne({ _id: id, isPublic: true }, { $inc: { viewsCount: 1 } });

  const q = userId ? { _id: id, $or: [{ isPublic: true }, { userId }] } : { _id: id, isPublic: true };
  const item = await Configuration.findOne(q)
    .populate('userId', 'name avatar')
    .populate('carId', 'name thumbnailUrl modelUrl model3d emissions')
    .populate('selectedWheels', 'name type price thumbnailUrl modelUrl emissions')
    .populate('selectedParts', 'name type price thumbnailUrl modelUrl emissions')
    .lean();
  if (!item) return res.status(404).json({ error: 'BUILD_NOT_FOUND' });

  let likedByMe = false;
  let favoritedByMe = false;
  if (userId) {
    const [vote, fav] = await Promise.all([
      BuildVote.findOne({ userId, buildId: id }).select('_id').lean(),
      BuildFavorite.findOne({ userId, buildId: id }).select('_id').lean()
    ]);
    likedByMe = Boolean(vote);
    favoritedByMe = Boolean(fav);
  }

  const out = { ...buildPublicCard(item), likedByMe, favoritedByMe };
  delete out.likedBy;
  res.json({ item: out });
});

const deleteConfiguration = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const configId = String(req.params?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!mongoose.isValidObjectId(configId)) return res.status(400).json({ error: 'INVALID_CONFIG' });

  const existing = await Configuration.findOne({ _id: configId, userId }).select('_id thumbnailUrl').lean();
  if (!existing) return res.status(404).json({ error: 'CONFIG_NOT_FOUND' });

  const thumb = String(existing?.thumbnailUrl || '').trim();
  if (thumb.startsWith('/uploads/builds/')) {
    const rel = thumb.replace(/^\/+/, '');
    const abs = path.join(__dirname, '..', '..', rel);
    try {
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    } catch {}
  }

  await Promise.all([
    Configuration.deleteOne({ _id: configId, userId }),
    BuildVote.deleteMany({ buildId: configId }),
    BuildFavorite.deleteMany({ buildId: configId })
  ]);

  res.json({ ok: true });
});

module.exports = {
  createConfiguration,
  updateConfigurationPart,
  updateConfigurationPaint,
  listUserConfigurations,
  setConfigurationPublic,
  listPublicConfigurations,
  likeConfiguration,
  unlikeConfiguration,
  favoriteConfiguration,
  unfavoriteConfiguration,
  shareBuild,
  setConfigurationThumbnail,
  getPublicBuildDetail,
  deleteConfiguration
};
