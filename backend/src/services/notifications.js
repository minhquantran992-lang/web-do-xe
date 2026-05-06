const mongoose = require('mongoose');

const UserFollowItem = require('../models/UserFollowItem');
const Notification = require('../models/Notification');

const uniqueIds = (ids) => {
  const out = [];
  const seen = new Set();
  for (const v of Array.isArray(ids) ? ids : []) {
    const s = String(v || '').trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
};

const createNotification = async ({ userId, type, content, meta }) => {
  if (!mongoose.isValidObjectId(String(userId || ''))) return null;
  const t = String(type || '').trim();
  if (!t) return null;
  const c = String(content || '').trim().slice(0, 1000);
  const m = meta && typeof meta === 'object' ? meta : null;
  return Notification.create({ userId, type: t, content: c, isRead: false, meta: m });
};

const notifyFollowers = async ({ itemType, itemId, type, content, meta, excludeUserIds }) => {
  const it = String(itemType || '').trim().toLowerCase();
  if (it !== 'part' && it !== 'build') return { ok: false, created: 0 };
  if (!mongoose.isValidObjectId(String(itemId || ''))) return { ok: false, created: 0 };
  const t = String(type || '').trim();
  if (!t) return { ok: false, created: 0 };
  const c = String(content || '').trim().slice(0, 1000);
  const m = meta && typeof meta === 'object' ? meta : null;

  const excludes = new Set(uniqueIds(excludeUserIds));
  const rows = await UserFollowItem.find({ itemType: it, itemId: new mongoose.Types.ObjectId(String(itemId)) })
    .select('userId')
    .lean();
  const userIds = uniqueIds(rows.map((r) => String(r?.userId || ''))).filter((id) => !excludes.has(id));
  if (!userIds.length) return { ok: true, created: 0 };

  const docs = userIds.map((uid) => ({
    userId: new mongoose.Types.ObjectId(uid),
    type: t,
    content: c,
    isRead: false,
    meta: m
  }));
  const res = await Notification.insertMany(docs, { ordered: false });
  return { ok: true, created: Array.isArray(res) ? res.length : 0 };
};

module.exports = { createNotification, notifyFollowers };
