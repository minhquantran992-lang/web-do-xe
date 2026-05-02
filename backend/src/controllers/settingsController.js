const AppSetting = require('../models/AppSetting');

const LEGACY_HERO_KEY = 'heroImages';
const LANDING_HERO_KEY = 'landingHeroImages';
const DASHBOARD_HERO_KEY = 'dashboardHeroImages';

const normalizeImages = (value) => {
  const arr = Array.isArray(value) ? value : [];
  const out = [];
  const seen = new Set();
  for (const v of arr) {
    const s = String(v || '').trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= 3) break;
  }
  return out;
};

const readHeroImages = async ({ key, fallbackToLegacy }) => {
  const doc = await AppSetting.findOne({ key }).select('value').lean();
  const images = normalizeImages(doc?.value?.images);
  if (images.length) return images;
  if (!fallbackToLegacy) return [];
  const legacy = await AppSetting.findOne({ key: LEGACY_HERO_KEY }).select('value').lean();
  return normalizeImages(legacy?.value?.images);
};

const getLandingHeroImagesPublic = async (req, res) => {
  const images = await readHeroImages({ key: LANDING_HERO_KEY, fallbackToLegacy: true });
  res.json({ ok: true, images });
};

const getDashboardHeroImagesPublic = async (req, res) => {
  const images = await readHeroImages({ key: DASHBOARD_HERO_KEY, fallbackToLegacy: true });
  res.json({ ok: true, images });
};

const getLandingHeroImagesAdmin = async (req, res) => {
  const images = await readHeroImages({ key: LANDING_HERO_KEY, fallbackToLegacy: true });
  res.json({ ok: true, images });
};

const getDashboardHeroImagesAdmin = async (req, res) => {
  const images = await readHeroImages({ key: DASHBOARD_HERO_KEY, fallbackToLegacy: true });
  res.json({ ok: true, images });
};

const setLandingHeroImagesAdmin = async (req, res) => {
  const images = normalizeImages(req.body?.images);
  await AppSetting.updateOne(
    { key: LANDING_HERO_KEY },
    { $set: { key: LANDING_HERO_KEY, value: { images } } },
    { upsert: true }
  );
  res.json({ ok: true, images });
};

const setDashboardHeroImagesAdmin = async (req, res) => {
  const images = normalizeImages(req.body?.images);
  await AppSetting.updateOne(
    { key: DASHBOARD_HERO_KEY },
    { $set: { key: DASHBOARD_HERO_KEY, value: { images } } },
    { upsert: true }
  );
  res.json({ ok: true, images });
};

const uploadHeroImageAdmin = async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'MISSING_FILE' });
  const url = `/uploads/hero/${file.filename}`;
  res.json({ ok: true, url });
};

const getHeroImagesPublic = getLandingHeroImagesPublic;
const getHeroImagesAdmin = getLandingHeroImagesAdmin;
const setHeroImagesAdmin = setLandingHeroImagesAdmin;

module.exports = {
  getHeroImagesPublic,
  getHeroImagesAdmin,
  setHeroImagesAdmin,
  getLandingHeroImagesPublic,
  getDashboardHeroImagesPublic,
  getLandingHeroImagesAdmin,
  getDashboardHeroImagesAdmin,
  setLandingHeroImagesAdmin,
  setDashboardHeroImagesAdmin,
  uploadHeroImageAdmin
};
