const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const Brand = require('../models/Brand');
const Car = require('../models/Car');
const { asyncHandler } = require('../middleware/asyncHandler');

const toKey = (name) =>
  String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeBrandType = (raw) => {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'pkl' || v === 'scooter' || v === 'oto') return v;
  if (v === 'bike') return 'pkl';
  if (v === 'car') return 'oto';
  return 'pkl';
};

const listBrandsAdmin = asyncHandler(async (req, res) => {
  const vehicleType = normalizeBrandType(req.query?.vehicleType || req.query?.type);
  const hasFilter = Boolean(String(req.query?.vehicleType || req.query?.type || '').trim());
  const q = !hasFilter
    ? {}
    : vehicleType === 'pkl'
      ? { $or: [{ vehicleType: 'pkl' }, { vehicleType: 'bike' }, { vehicleType: { $exists: false } }] }
      : vehicleType === 'oto'
        ? { $or: [{ vehicleType: 'oto' }, { vehicleType: 'car' }] }
        : { vehicleType: 'scooter' };
  const items = await Brand.find(q).sort({ name: 1 }).lean();
  res.json({ items });
});

const createBrandAdmin = asyncHandler(async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const vehicleType = normalizeBrandType(req.body?.vehicleType || req.body?.type);
  const logo = String(req.body?.logo || '').trim();
  if (!name) return res.status(400).json({ error: 'MISSING_NAME' });

  const legacyKey = toKey(name);
  const key = `${vehicleType}:${legacyKey}`;
  if (!key) return res.status(400).json({ error: 'MISSING_NAME' });

  const existing = await Brand.findOne({ key }).lean();
  if (existing) return res.json({ item: existing });

  const legacyKeys = [legacyKey, `bike:${legacyKey}`, `car:${legacyKey}`];
  const legacy = await Brand.findOne({ key: { $in: legacyKeys } }).lean();
  if (legacy) {
    await Brand.updateOne({ _id: legacy._id }, { $set: { vehicleType, key, logo } });
    const updated = await Brand.findById(legacy._id).lean();
    return res.status(201).json({ item: updated });
  }

  const doc = await Brand.create({ name, key, vehicleType, logo });
  res.status(201).json({ item: doc });
});

const updateBrandAdmin = asyncHandler(async (req, res) => {
  const id = String(req.params.id || '');
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const patch = {};
  if (req.body?.name !== undefined) patch.name = String(req.body?.name || '').trim();
  if (req.body?.vehicleType !== undefined || req.body?.type !== undefined) {
    patch.vehicleType = normalizeBrandType(req.body?.vehicleType || req.body?.type);
  }
  if (req.body?.logo !== undefined) patch.logo = String(req.body?.logo || '').trim();

  if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'EMPTY_PATCH' });

  const existing = await Brand.findById(id).lean();
  if (!existing) return res.status(404).json({ error: 'NOT_FOUND' });

  if (patch.name || patch.vehicleType) {
    const nextName = patch.name ?? existing.name;
    const nextType = patch.vehicleType ?? existing.vehicleType;
    const legacyKey = toKey(nextName);
    patch.key = `${nextType}:${legacyKey}`;
  }

  const updated = await Brand.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
  res.json({ item: updated });
});

const importBrandLogoFromUrl = asyncHandler(async (req, res) => {
  const rawUrl = String(req.body?.url || '').trim();
  if (!rawUrl) return res.status(400).json({ error: 'MISSING_URL' });
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (_e) {
    return res.status(400).json({ error: 'INVALID_URL' });
  }
  const proto = parsed.protocol === 'https:' ? https : http;
  const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'brands');
  fs.mkdirSync(uploadDir, { recursive: true });

  const pickExt = (contentType, pathname) => {
    const t = String(contentType || '').toLowerCase();
    if (t.includes('image/png')) return '.png';
    if (t.includes('image/jpeg') || t.includes('image/jpg')) return '.jpg';
    if (t.includes('image/webp')) return '.webp';
    const p = String(pathname || '').toLowerCase();
    if (p.endsWith('.png')) return '.png';
    if (p.endsWith('.jpg') || p.endsWith('.jpeg')) return '.jpg';
    if (p.endsWith('.webp')) return '.webp';
    return '';
  };

  const filename = `brand-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const download = () =>
    new Promise((resolve, reject) => {
      const req2 = proto.get(
        {
          hostname: parsed.hostname,
          path: parsed.pathname + (parsed.search || ''),
          protocol: parsed.protocol,
          headers: { 'User-Agent': 'carbanana-bot' }
        },
        (resp) => {
          if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
            parsed = new URL(resp.headers.location, parsed);
            resp.resume();
            return reject(new Error('REDIRECT'));
          }
          const ext = pickExt(resp.headers['content-type'], parsed.pathname);
          if (!ext) {
            resp.resume();
            return reject(new Error('UNSUPPORTED_TYPE'));
          }
          const final = path.join(uploadDir, `${filename}${ext}`);
          const out = fs.createWriteStream(final);
          resp.pipe(out);
          out.on('finish', () => out.close(() => resolve(final)));
          out.on('error', (e) => reject(e));
        }
      );
      req2.on('error', (e) => reject(e));
    });

  try {
    await download();
  } catch (e) {
    if (e && e.message === 'REDIRECT') {
      try {
        const proto2 = parsed.protocol === 'https:' ? https : http;
        await new Promise((resolve, reject) => {
          const req3 = proto2.get(parsed, (resp) => {
            const ext = pickExt(resp.headers['content-type'], parsed.pathname);
            if (!ext) {
              resp.resume();
              return reject(new Error('UNSUPPORTED_TYPE'));
            }
            const final = path.join(uploadDir, `${filename}${ext}`);
            const out = fs.createWriteStream(final);
            resp.pipe(out);
            out.on('finish', () => out.close(() => resolve(final)));
            out.on('error', (err) => reject(err));
          });
          req3.on('error', (err) => reject(err));
        });
      } catch (e2) {
        return res.status(400).json({ error: 'DOWNLOAD_FAILED' });
      }
    } else {
      return res.status(400).json({ error: 'DOWNLOAD_FAILED' });
    }
  }

  const files = fs
    .readdirSync(uploadDir)
    .filter((n) => /^brand-/.test(n))
    .sort((a, b) => fs.statSync(path.join(uploadDir, b)).mtimeMs - fs.statSync(path.join(uploadDir, a)).mtimeMs);
  const latest = files[0];
  if (!latest) return res.status(500).json({ error: 'DOWNLOAD_FAILED' });
  return res.status(201).json({ url: `/uploads/brands/${latest}` });
});

const uploadBrandLogoAdmin = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'MISSING_FILE' });
  res.status(201).json({ url: `/uploads/brands/${file.filename}` });
});

const deleteBrandAdmin = asyncHandler(async (req, res) => {
  const id = String(req.params.id || '');
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const brand = await Brand.findByIdAndDelete(id).lean();
  if (!brand) return res.status(404).json({ error: 'NOT_FOUND' });

  const rx = new RegExp(`^${escapeRegex(brand.name)}$`, 'i');
  await Car.updateMany({ brand: rx }, { $set: { brand: '' } });

  res.json({ ok: true });
});

module.exports = { listBrandsAdmin, createBrandAdmin, updateBrandAdmin, deleteBrandAdmin, uploadBrandLogoAdmin, importBrandLogoFromUrl };
