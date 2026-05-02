const mongoose = require('mongoose');
const { asyncHandler } = require('../middleware/asyncHandler');
const ChatThread = require('../models/ChatThread');
const ChatMessage = require('../models/ChatMessage');
const Vendor = require('../models/Vendor');
const User = require('../models/User');

const clampLimit = (v, def = 30, min = 1, max = 100) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
};

const safeText = (v) => String(v || '').trim();

const toPreviewText = (v) => {
  const s = safeText(v);
  if (!s) return '';
  return s.length > 180 ? `${s.slice(0, 180)}…` : s;
};

const notHiddenExpr = (field) => ({ $or: [{ [field]: { $exists: false } }, { [field]: null }] });

const hardDeleteThread = async ({ threadId }) => {
  await Promise.all([ChatMessage.deleteMany({ threadId }), ChatThread.deleteOne({ _id: threadId })]);
  return true;
};

const listMyThreads = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '');
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const items = await ChatThread.find({ userId, ...notHiddenExpr('userHiddenAt') })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .populate('shopId', 'shopName logo coverImage bookingPreferences.acceptingBookings')
    .lean();

  res.json({
    items: items.map((t) => ({
      _id: t._id,
      userId: t.userId,
      shopId: t.shopId?._id || t.shopId,
      shop: t.shopId
        ? {
            _id: t.shopId._id,
            shopName: String(t.shopId.shopName || ''),
            logo: String(t.shopId.logo || ''),
            coverImage: String(t.shopId.coverImage || ''),
            acceptingBookings: t.shopId?.bookingPreferences?.acceptingBookings !== false
          }
        : null,
      lastMessageAt: t.lastMessageAt || null,
      lastMessageText: String(t.lastMessageText || ''),
      lastMessageSenderType: String(t.lastMessageSenderType || ''),
      createdAt: t.createdAt,
      updatedAt: t.updatedAt
    }))
  });
});

const getOrCreateMyThread = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '');
  const shopId = String(req.body?.shopId || req.body?.vendorId || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!mongoose.isValidObjectId(shopId)) return res.status(400).json({ error: 'INVALID_SHOP' });

  const vendor = await Vendor.findOne({ _id: shopId, status: 'approved' })
    .select('_id shopName logo coverImage bookingPreferences.acceptingBookings')
    .lean();
  if (!vendor) return res.status(404).json({ error: 'SHOP_NOT_FOUND' });

  await ChatThread.updateOne({ userId, shopId }, { $setOnInsert: { userId, shopId }, $set: { userHiddenAt: null } }, { upsert: true });
  const thread = await ChatThread.findOne({ userId, shopId }).lean();
  if (!thread) return res.status(500).json({ error: 'THREAD_CREATE_FAILED' });

  res.json({
    item: {
      _id: thread._id,
      userId: thread.userId,
      shopId: thread.shopId,
      shop: {
        _id: vendor._id,
        shopName: String(vendor.shopName || ''),
        logo: String(vendor.logo || ''),
        coverImage: String(vendor.coverImage || ''),
        acceptingBookings: vendor?.bookingPreferences?.acceptingBookings !== false
      },
      lastMessageAt: thread.lastMessageAt || null,
      lastMessageText: String(thread.lastMessageText || ''),
      lastMessageSenderType: String(thread.lastMessageSenderType || ''),
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt
    }
  });
});

const listMyMessages = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '');
  const threadId = String(req.params?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!mongoose.isValidObjectId(threadId)) return res.status(400).json({ error: 'INVALID_THREAD' });

  const thread = await ChatThread.findOne({ _id: threadId, userId }).lean();
  if (!thread) return res.status(404).json({ error: 'NOT_FOUND' });

  const limit = clampLimit(req.query?.limit, 40, 1, 120);
  const beforeRaw = String(req.query?.before || '').trim();
  const before = beforeRaw ? new Date(beforeRaw) : null;
  const beforeOk = before && !Number.isNaN(before.getTime());
  const q = { threadId, ...(beforeOk ? { createdAt: { $lt: before } } : {}) };
  const rows = await ChatMessage.find(q).sort({ createdAt: -1 }).limit(limit).lean();
  const items = rows.slice().reverse();
  const nextBefore = rows.length ? rows[rows.length - 1].createdAt : null;

  res.json({
    items: items.map((m) => ({
      _id: m._id,
      threadId: m.threadId,
      senderType: m.senderType,
      senderId: m.senderId,
      text: String(m.text || ''),
      createdAt: m.createdAt
    })),
    nextBefore
  });
});

const sendMyMessage = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '');
  const threadId = String(req.params?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!mongoose.isValidObjectId(threadId)) return res.status(400).json({ error: 'INVALID_THREAD' });

  const thread = await ChatThread.findOne({ _id: threadId, userId }).lean();
  if (!thread) return res.status(404).json({ error: 'NOT_FOUND' });

  const text = safeText(req.body?.text);
  if (!text) return res.status(400).json({ error: 'EMPTY_MESSAGE' });
  if (text.length > 4000) return res.status(400).json({ error: 'MESSAGE_TOO_LONG' });

  const now = new Date();
  const msg = await ChatMessage.create({ threadId, senderType: 'user', senderId: userId, text });
  await ChatThread.updateOne(
    { _id: threadId },
    {
      $set: {
        lastMessageAt: now,
        lastMessageText: toPreviewText(text),
        lastMessageSenderType: 'user',
        updatedAt: now,
        userHiddenAt: null,
        shopHiddenAt: null
      }
    }
  );

  res.status(201).json({
    item: {
      _id: msg._id,
      threadId: msg.threadId,
      senderType: msg.senderType,
      senderId: msg.senderId,
      text: msg.text,
      createdAt: msg.createdAt
    }
  });
});

const listVendorThreads = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '');
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });

  const items = await ChatThread.find({ shopId: vendorId, ...notHiddenExpr('shopHiddenAt') })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .populate('userId', 'name email')
    .lean();

  res.json({
    items: items.map((t) => ({
      _id: t._id,
      userId: t.userId?._id || t.userId,
      user: t.userId ? { _id: t.userId._id, name: String(t.userId.name || ''), email: String(t.userId.email || '') } : null,
      shopId: t.shopId,
      lastMessageAt: t.lastMessageAt || null,
      lastMessageText: String(t.lastMessageText || ''),
      lastMessageSenderType: String(t.lastMessageSenderType || ''),
      createdAt: t.createdAt,
      updatedAt: t.updatedAt
    }))
  });
});

const getOrCreateVendorThread = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '');
  const userId = String(req.body?.userId || '').trim();
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });
  if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ error: 'INVALID_USER' });

  const user = await User.findById(userId).select('name email').lean();
  if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });

  await ChatThread.updateOne(
    { userId, shopId: vendorId },
    { $setOnInsert: { userId, shopId: vendorId }, $set: { shopHiddenAt: null } },
    { upsert: true }
  );
  const thread = await ChatThread.findOne({ userId, shopId: vendorId }).lean();
  if (!thread) return res.status(500).json({ error: 'THREAD_CREATE_FAILED' });

  res.json({
    item: {
      _id: thread._id,
      userId: thread.userId,
      user: { _id: user._id, name: String(user.name || ''), email: String(user.email || '') },
      shopId: thread.shopId,
      lastMessageAt: thread.lastMessageAt || null,
      lastMessageText: String(thread.lastMessageText || ''),
      lastMessageSenderType: String(thread.lastMessageSenderType || ''),
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt
    }
  });
});

const listVendorMessages = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '');
  const threadId = String(req.params?.id || '').trim();
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });
  if (!mongoose.isValidObjectId(threadId)) return res.status(400).json({ error: 'INVALID_THREAD' });

  const thread = await ChatThread.findOne({ _id: threadId, shopId: vendorId }).lean();
  if (!thread) return res.status(404).json({ error: 'NOT_FOUND' });

  const limit = clampLimit(req.query?.limit, 40, 1, 120);
  const beforeRaw = String(req.query?.before || '').trim();
  const before = beforeRaw ? new Date(beforeRaw) : null;
  const beforeOk = before && !Number.isNaN(before.getTime());
  const q = { threadId, ...(beforeOk ? { createdAt: { $lt: before } } : {}) };
  const rows = await ChatMessage.find(q).sort({ createdAt: -1 }).limit(limit).lean();
  const items = rows.slice().reverse();
  const nextBefore = rows.length ? rows[rows.length - 1].createdAt : null;

  res.json({
    items: items.map((m) => ({
      _id: m._id,
      threadId: m.threadId,
      senderType: m.senderType,
      senderId: m.senderId,
      text: String(m.text || ''),
      createdAt: m.createdAt
    })),
    nextBefore
  });
});

const sendVendorMessage = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '');
  const threadId = String(req.params?.id || '').trim();
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });
  if (!mongoose.isValidObjectId(threadId)) return res.status(400).json({ error: 'INVALID_THREAD' });

  const thread = await ChatThread.findOne({ _id: threadId, shopId: vendorId }).lean();
  if (!thread) return res.status(404).json({ error: 'NOT_FOUND' });

  const text = safeText(req.body?.text);
  if (!text) return res.status(400).json({ error: 'EMPTY_MESSAGE' });
  if (text.length > 4000) return res.status(400).json({ error: 'MESSAGE_TOO_LONG' });

  const now = new Date();
  const msg = await ChatMessage.create({ threadId, senderType: 'shop', senderId: vendorId, text });
  await ChatThread.updateOne(
    { _id: threadId },
    {
      $set: {
        lastMessageAt: now,
        lastMessageText: toPreviewText(text),
        lastMessageSenderType: 'shop',
        updatedAt: now,
        userHiddenAt: null,
        shopHiddenAt: null
      }
    }
  );

  res.status(201).json({
    item: {
      _id: msg._id,
      threadId: msg.threadId,
      senderType: msg.senderType,
      senderId: msg.senderId,
      text: msg.text,
      createdAt: msg.createdAt
    }
  });
});

const deleteMyThread = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '');
  const id = String(req.params?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_THREAD' });
  const thread = await ChatThread.findOne({ _id: id, userId }).select('_id').lean();
  if (!thread) return res.status(404).json({ error: 'NOT_FOUND' });
  await hardDeleteThread({ threadId: String(thread._id) });
  res.json({ ok: true });
});

const deleteVendorThread = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '');
  const id = String(req.params?.id || '').trim();
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_THREAD' });
  const thread = await ChatThread.findOne({ _id: id, shopId: vendorId }).select('_id').lean();
  if (!thread) return res.status(404).json({ error: 'NOT_FOUND' });
  await hardDeleteThread({ threadId: String(thread._id) });
  res.json({ ok: true });
});

module.exports = {
  listMyThreads,
  getOrCreateMyThread,
  listMyMessages,
  sendMyMessage,
  listVendorThreads,
  getOrCreateVendorThread,
  listVendorMessages,
  sendVendorMessage,
  deleteMyThread,
  deleteVendorThread
};
