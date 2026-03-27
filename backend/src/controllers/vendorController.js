const Vendor = require('../models/Vendor');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/asyncHandler');

const getMyShop = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '');
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  const item = await Vendor.findOne({ userId }).lean();
  res.json({ item: item || null });
});

const upsertMyShop = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '');
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const shopName = String(req.body?.shopName || '').trim();
  if (!shopName) return res.status(400).json({ error: 'MISSING_SHOP_NAME' });

  const patch = {
    shopName,
    description: String(req.body?.description || '').trim(),
    phone: String(req.body?.phone || '').trim(),
    email: String(req.body?.email || '').trim(),
    address: String(req.body?.address || '').trim(),
    website: String(req.body?.website || '').trim(),
    facebook: String(req.body?.facebook || '').trim(),
    zalo: String(req.body?.zalo || '').trim(),
    logo: String(req.body?.logo || '').trim(),
    coverImage: String(req.body?.coverImage || '').trim()
  };

  const existing = await Vendor.findOne({ userId }).lean();
  await Vendor.updateOne({ userId }, { $set: patch, $setOnInsert: { userId } }, { upsert: true });

  const user = await User.findById(userId).select('role').lean();
  const role = String(user?.role || '').trim().toUpperCase();
  if (role !== 'VENDOR' && role !== 'ADMIN') {
    await User.updateOne({ _id: userId }, { $set: { role: 'VENDOR' } });
  }

  const item = await Vendor.findOne({ userId }).lean();
  res.status(existing ? 200 : 201).json({ item });
});

module.exports = { getMyShop, upsertMyShop };

