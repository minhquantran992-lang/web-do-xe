const mongoose = require('mongoose');

const Notification = require('../models/Notification');
const { asyncHandler } = require('../middleware/asyncHandler');

const listMyNotifications = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const limitRaw = Number(req.query?.limit);
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.floor(limitRaw))) : 20;
  const skipRaw = Number(req.query?.skip);
  const skip = Number.isFinite(skipRaw) ? Math.max(0, Math.floor(skipRaw)) : 0;

  const [items, unreadCount] = await Promise.all([
    Notification.find({ userId: new mongoose.Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments({ userId: new mongoose.Types.ObjectId(userId), isRead: false })
  ]);

  res.json({
    ok: true,
    unreadCount: Number(unreadCount) || 0,
    items: (Array.isArray(items) ? items : []).map((n) => ({
      _id: n._id,
      type: String(n.type || ''),
      content: String(n.content || ''),
      isRead: Boolean(n.isRead),
      meta: n.meta && typeof n.meta === 'object' ? n.meta : null,
      createdAt: n.createdAt
    }))
  });
});

const markRead = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  const id = String(req.params?.id || '').trim();
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });
  await Notification.updateOne({ _id: id, userId: new mongoose.Types.ObjectId(userId) }, { $set: { isRead: true } });
  res.json({ ok: true });
});

const markAllRead = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  await Notification.updateMany({ userId: new mongoose.Types.ObjectId(userId), isRead: false }, { $set: { isRead: true } });
  res.json({ ok: true });
});

module.exports = { listMyNotifications, markRead, markAllRead };
