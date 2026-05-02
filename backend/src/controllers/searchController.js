const mongoose = require('mongoose');

const Brand = require('../models/Brand');
const Car = require('../models/Car');
const Part = require('../models/Part');
const { asyncHandler } = require('../middleware/asyncHandler');
const { escapeRegex, normalizeForSearch } = require('../utils/search');

const scoreMatch = ({ haystack, needle }) => {
  const h = normalizeForSearch(haystack);
  const n = normalizeForSearch(needle);
  if (!h || !n) return 0;
  if (h === n) return 1000;
  if (h.startsWith(n)) return 800;
  const idx = h.indexOf(n);
  if (idx >= 0) return 500 - Math.min(200, idx);
  return 0;
};

const search = asyncHandler(async (req, res) => {
  const qRaw = String(req.query?.q || '').trim();
  const limitRaw = Number(req.query?.limit);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(10, Math.floor(limitRaw))) : 8;

  const qNorm = normalizeForSearch(qRaw);
  if (!qNorm) return res.json({ ok: true, items: [] });

  const rx = new RegExp(escapeRegex(qNorm), 'i');
  const isObjectId = mongoose.isValidObjectId(qRaw) && /^[a-f0-9]{24}$/i.test(qRaw);

  const [cars, parts, brands] = await Promise.all([
    isObjectId
      ? Car.find({ _id: qRaw }).limit(1).lean()
      : Car.find({ $or: [{ searchText: rx }, { name: new RegExp(escapeRegex(qRaw), 'i') }] })
          .limit(limit * 3)
          .lean(),
    isObjectId
      ? Part.find({ _id: qRaw }).limit(1).lean()
      : Part.find({ $or: [{ searchText: rx }, { name: new RegExp(escapeRegex(qRaw), 'i') }] })
          .limit(limit * 3)
          .lean(),
    Brand.find({
      $or: [{ searchText: rx }, { name: new RegExp(escapeRegex(qRaw), 'i') }, { key: new RegExp(escapeRegex(qRaw), 'i') }]
    })
      .limit(limit * 2)
      .lean()
  ]);

  const items = [];

  for (const c of Array.isArray(cars) ? cars : []) {
    const id = String(c?._id || '');
    items.push({
      kind: 'car',
      id,
      code: id,
      name: String(c?.name || ''),
      price: null,
      image: String(c?.thumbnailUrl || c?.image || ''),
      href: `/bikes/${encodeURIComponent(id)}`
    });
  }

  for (const p of Array.isArray(parts) ? parts : []) {
    const id = String(p?._id || '');
    items.push({
      kind: 'part',
      id,
      code: id,
      name: String(p?.name || ''),
      price: Number.isFinite(Number(p?.price)) ? Number(p.price) : null,
      image: String(p?.thumbnailUrl || ''),
      href: `/parts?focus=${encodeURIComponent(id)}`
    });
  }

  for (const b of Array.isArray(brands) ? brands : []) {
    const id = String(b?._id || '');
    items.push({
      kind: 'brand',
      id,
      code: String(b?.key || id),
      name: String(b?.name || ''),
      price: null,
      image: String(b?.logo || ''),
      href: `/bikes?brand=${encodeURIComponent(String(b?.name || ''))}`
    });
  }

  const scored = items
    .map((it) => ({
      ...it,
      _score:
        (it.code && normalizeForSearch(it.code) === qNorm ? 1200 : 0) +
        scoreMatch({ haystack: it.name, needle: qRaw }) +
        (it.kind === 'car' ? 10 : it.kind === 'part' ? 5 : 0)
    }))
    .sort((a, b) => b._score - a._score || String(a.name).localeCompare(String(b.name)))
    .slice(0, limit)
    .map(({ _score, ...rest }) => rest);

  res.json({ ok: true, items: scored });
});

module.exports = { search };
