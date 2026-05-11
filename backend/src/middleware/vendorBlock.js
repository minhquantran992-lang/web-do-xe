const mongoose = require('mongoose');

const VendorBlock = require('../models/VendorBlock');
const { asyncHandler } = require('./asyncHandler');
const { logSecurityEvent } = require('../security/securityLog');

const requireNotBlockedByShopFromBody = (opts = {}) => {
  const shopIdField = String(opts.shopIdField || 'shopId').trim() || 'shopId';
  return asyncHandler(async (req, res, next) => {
    const userId = String(req.user?.id || '').trim();
    if (!userId) return next();
    const shopId = String(req.body?.[shopIdField] || '').trim();
    if (!mongoose.isValidObjectId(shopId)) return next();

    const now = new Date();
    const block = await VendorBlock.findOne({
      shopId,
      userId,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }]
    }).lean();
    if (!block) return next();

    await logSecurityEvent({
      req,
      kind: 'VENDOR_BLOCK',
      outcome: 'blocked',
      meta: {
        shopId,
        userId,
        reason: String(block?.reason || '').slice(0, 200),
        expiresAt: block?.expiresAt || null
      }
    });
    return res.status(403).json({ error: 'USER_BLOCKED_BY_SHOP' });
  });
};

module.exports = { requireNotBlockedByShopFromBody };
