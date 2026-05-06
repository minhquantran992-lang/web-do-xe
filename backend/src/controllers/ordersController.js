const mongoose = require('mongoose');

const Configuration = require('../models/Configuration');
const Vendor = require('../models/Vendor');
const Order = require('../models/Order');
const OrderProgress = require('../models/OrderProgress');
const VendorReview = require('../models/VendorReview');
const { asyncHandler } = require('../middleware/asyncHandler');
const { createNotification } = require('../services/notifications');

const STATUSES = ['REQUESTED', 'QUOTED', 'REJECTED', 'CANCELLED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'];
const MAIN_FLOW = ['REQUESTED', 'QUOTED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'];

const STATUS_LABEL = {
  REQUESTED: 'Yêu cầu báo giá',
  QUOTED: 'Đã có báo giá (chờ khách xác nhận)',
  REJECTED: 'Khách từ chối báo giá',
  CANCELLED: 'Đơn bị hủy',
  CONFIRMED: 'Khách đã xác nhận (chờ thi công)',
  IN_PROGRESS: 'Đang thi công',
  COMPLETED: 'Hoàn tất'
};

const normalizeId = (v) => String(v || '').trim();
const normalizeText = (v, maxLen = 1000) => String(v || '').trim().slice(0, maxLen);
const statusIndex = (s) => {
  const v = String(s || '').trim().toUpperCase();
  const idx = MAIN_FLOW.indexOf(v);
  return idx >= 0 ? idx : 0;
};

const logEvent = async ({ orderId, fromStatus, toStatus, actorRole, actorId, note, imageUrl, at }) => {
  const happenedAt = at instanceof Date ? at : new Date();
  return OrderProgress.create({
    orderId: new mongoose.Types.ObjectId(String(orderId)),
    fromStatus: fromStatus ? String(fromStatus) : null,
    toStatus: String(toStatus || ''),
    actorRole: String(actorRole || ''),
    actorId: actorId && mongoose.isValidObjectId(String(actorId)) ? new mongoose.Types.ObjectId(String(actorId)) : null,
    note: normalizeText(note),
    imageUrl: normalizeText(imageUrl),
    happenedAt
  });
};

const getVendorUserId = async (vendorId) => {
  if (!mongoose.isValidObjectId(String(vendorId || ''))) return '';
  const v = await Vendor.findById(vendorId).select('userId').lean();
  return String(v?.userId || '').trim();
};

const quoteTimeoutHours = () => {
  const raw = Number(process.env.ORDER_QUOTE_TIMEOUT_HOURS || process.env.QUOTE_TIMEOUT_HOURS || 24);
  return Number.isFinite(raw) ? Math.max(1, Math.floor(raw)) : 24;
};

const createOrder = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const shopId = normalizeId(req.body?.shopId || req.body?.shop_id);
  const buildId = normalizeId(req.body?.buildId || req.body?.build_id);
  if (!mongoose.isValidObjectId(shopId) || !mongoose.isValidObjectId(buildId)) return res.status(400).json({ error: 'INVALID_INPUT' });

  const [vendor, build] = await Promise.all([
    Vendor.findOne({ _id: shopId, status: 'approved' }).select('_id shopName logo userId').lean(),
    Configuration.findOne({ _id: buildId, userId: new mongoose.Types.ObjectId(userId) }).select('_id name thumbnailUrl').lean()
  ]);
  if (!vendor) return res.status(404).json({ error: 'SHOP_NOT_FOUND' });
  if (!build) return res.status(404).json({ error: 'BUILD_NOT_FOUND' });

  const now = new Date();
  const order = await Order.create({
    userId,
    shopId,
    buildId,
    status: 'REQUESTED',
    quotedPrice: null,
    quoteNote: '',
    quotedAt: null,
    quoteExpiresAt: null,
    confirmedAt: null,
    rejectedAt: null,
    cancelledAt: null,
    cancelReason: '',
    startedAt: null,
    completedAt: null
  });

  await logEvent({
    orderId: order._id,
    fromStatus: null,
    toStatus: 'REQUESTED',
    actorRole: 'USER',
    actorId: userId,
    note: normalizeText(req.body?.note || 'Yêu cầu báo giá'),
    imageUrl: '',
    at: now
  });

  try {
    const workshopUserId = String(vendor?.userId || '').trim();
    if (mongoose.isValidObjectId(workshopUserId)) {
      const title = String(build?.name || '').trim() || String(buildId);
      await createNotification({
        userId: workshopUserId,
        type: 'ORDER_REQUESTED',
        content: `Có yêu cầu báo giá mới: ${title}`,
        meta: { orderId: String(order._id), buildId: String(buildId) }
      });
    }
  } catch {}

  res.status(201).json({
    ok: true,
    item: {
      _id: order._id,
      status: order.status,
      currentStepIndex: statusIndex(order.status),
      quotedPrice: order.quotedPrice,
      quotedAt: order.quotedAt,
      quoteExpiresAt: order.quoteExpiresAt,
      shop: { _id: vendor._id, shopName: vendor.shopName || '', logo: vendor.logo || '' },
      build: { _id: build._id, name: build.name || '', thumbnailUrl: build.thumbnailUrl || '' }
    }
  });
});

const listMyOrders = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const statusRaw = String(req.query?.status || '').trim().toUpperCase();
  const status = STATUSES.includes(statusRaw) ? statusRaw : '';

  const limitRaw = Number(req.query?.limit);
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.floor(limitRaw))) : 30;

  const items = await Order.find({ userId: new mongoose.Types.ObjectId(userId), ...(status ? { status } : {}) })
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(limit)
    .populate('shopId', 'shopName logo')
    .populate('buildId', 'name thumbnailUrl')
    .lean();

  res.json({
    ok: true,
    steps: MAIN_FLOW.map((k) => ({ key: k, label: STATUS_LABEL[k] || k })),
    items: (Array.isArray(items) ? items : []).map((o) => ({
      _id: o._id,
      status: String(o.status || ''),
      currentStepIndex: statusIndex(o.status),
      quotedPrice: o.quotedPrice ?? null,
      quotedAt: o.quotedAt || null,
      quoteExpiresAt: o.quoteExpiresAt || null,
      confirmedAt: o.confirmedAt || null,
      startedAt: o.startedAt || null,
      completedAt: o.completedAt || null,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      shop: {
        _id: String(o?.shopId?._id || o?.shopId || ''),
        shopName: String(o?.shopId?.shopName || ''),
        logo: String(o?.shopId?.logo || '')
      },
      build: {
        _id: String(o?.buildId?._id || o?.buildId || ''),
        name: String(o?.buildId?.name || ''),
        thumbnailUrl: String(o?.buildId?.thumbnailUrl || '')
      }
    }))
  });
});

const getMyOrderDetail = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  const id = String(req.params?.id || '').trim();
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const order = await Order.findOne({ _id: id, userId: new mongoose.Types.ObjectId(userId) })
    .populate('shopId', 'shopName logo address phone userId')
    .populate('buildId', 'name thumbnailUrl carId')
    .lean();
  if (!order) return res.status(404).json({ error: 'NOT_FOUND' });

  const history = await OrderProgress.find({ orderId: new mongoose.Types.ObjectId(id) })
    .sort({ happenedAt: -1, createdAt: -1 })
    .lean();

  res.json({
    ok: true,
    steps: MAIN_FLOW.map((k) => ({ key: k, label: STATUS_LABEL[k] || k })),
    item: {
      _id: order._id,
      status: String(order.status || ''),
      currentStepIndex: statusIndex(order.status),
      quotedPrice: order.quotedPrice ?? null,
      quoteNote: String(order.quoteNote || ''),
      quotedAt: order.quotedAt || null,
      quoteExpiresAt: order.quoteExpiresAt || null,
      confirmedAt: order.confirmedAt || null,
      rejectedAt: order.rejectedAt || null,
      cancelledAt: order.cancelledAt || null,
      cancelReason: String(order.cancelReason || ''),
      startedAt: order.startedAt || null,
      completedAt: order.completedAt || null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      shop: {
        _id: String(order?.shopId?._id || ''),
        shopName: String(order?.shopId?.shopName || ''),
        logo: String(order?.shopId?.logo || ''),
        address: String(order?.shopId?.address || ''),
        phone: String(order?.shopId?.phone || '')
      },
      build: {
        _id: String(order?.buildId?._id || ''),
        name: String(order?.buildId?.name || ''),
        thumbnailUrl: String(order?.buildId?.thumbnailUrl || '')
      },
      history: (Array.isArray(history) ? history : []).map((h) => ({
        _id: h._id,
        fromStatus: h.fromStatus ? String(h.fromStatus) : null,
        toStatus: String(h.toStatus || ''),
        actorRole: String(h.actorRole || ''),
        note: String(h.note || ''),
        imageUrl: String(h.imageUrl || ''),
        happenedAt: h.happenedAt || h.createdAt || null
      }))
    }
  });
});

const confirmOrder = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '').trim();
  const id = String(req.params?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const order = await Order.findOne({ _id: id, userId: new mongoose.Types.ObjectId(userId) }).lean();
  if (!order) return res.status(404).json({ error: 'NOT_FOUND' });
  const status = String(order.status || '');
  if (status !== 'QUOTED') return res.status(409).json({ error: 'INVALID_TRANSITION' });
  const exp = order?.quoteExpiresAt instanceof Date ? order.quoteExpiresAt : null;
  if (exp && exp.getTime() <= Date.now()) return res.status(409).json({ error: 'QUOTE_EXPIRED' });

  const now = new Date();
  const upd = await Order.updateOne(
    { _id: new mongoose.Types.ObjectId(id), userId: new mongoose.Types.ObjectId(userId), status: 'QUOTED' },
    { $set: { status: 'CONFIRMED', confirmedAt: now }, $unset: { quoteExpiresAt: '' } }
  );
  if (!upd?.modifiedCount) return res.status(409).json({ error: 'CONFLICT' });

  await logEvent({
    orderId: id,
    fromStatus: 'QUOTED',
    toStatus: 'CONFIRMED',
    actorRole: 'USER',
    actorId: userId,
    note: normalizeText(req.body?.note || 'Khách xác nhận báo giá'),
    imageUrl: '',
    at: now
  });

  try {
    const workshopUserId = await getVendorUserId(order?.shopId);
    if (mongoose.isValidObjectId(workshopUserId)) {
      await createNotification({
        userId: workshopUserId,
        type: 'ORDER_CONFIRMED',
        content: 'Khách đã xác nhận báo giá',
        meta: { orderId: id }
      });
    }
  } catch {}

  res.json({ ok: true });
});

const rejectOrder = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '').trim();
  const id = String(req.params?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const order = await Order.findOne({ _id: id, userId: new mongoose.Types.ObjectId(userId) }).lean();
  if (!order) return res.status(404).json({ error: 'NOT_FOUND' });
  const status = String(order.status || '');
  if (status !== 'QUOTED') return res.status(409).json({ error: 'INVALID_TRANSITION' });

  const now = new Date();
  const upd = await Order.updateOne(
    { _id: new mongoose.Types.ObjectId(id), userId: new mongoose.Types.ObjectId(userId), status: 'QUOTED' },
    { $set: { status: 'REJECTED', rejectedAt: now }, $unset: { quoteExpiresAt: '' } }
  );
  if (!upd?.modifiedCount) return res.status(409).json({ error: 'CONFLICT' });

  await logEvent({
    orderId: id,
    fromStatus: 'QUOTED',
    toStatus: 'REJECTED',
    actorRole: 'USER',
    actorId: userId,
    note: normalizeText(req.body?.note || 'Khách từ chối báo giá'),
    imageUrl: '',
    at: now
  });

  try {
    const workshopUserId = await getVendorUserId(order?.shopId);
    if (mongoose.isValidObjectId(workshopUserId)) {
      await createNotification({
        userId: workshopUserId,
        type: 'ORDER_REJECTED',
        content: 'Khách đã từ chối báo giá',
        meta: { orderId: id }
      });
    }
  } catch {}

  res.json({ ok: true });
});

const cancelOrder = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '').trim();
  const id = String(req.params?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const order = await Order.findOne({ _id: id, userId: new mongoose.Types.ObjectId(userId) }).lean();
  if (!order) return res.status(404).json({ error: 'NOT_FOUND' });

  const status = String(order.status || '');
  if (status === 'CANCELLED' || status === 'COMPLETED') return res.status(409).json({ error: 'INVALID_TRANSITION' });
  if (status === 'IN_PROGRESS') return res.status(409).json({ error: 'INVALID_TRANSITION' });

  const now = new Date();
  const reason = normalizeText(req.body?.reason || req.body?.note || 'Khách hủy');
  const upd = await Order.updateOne(
    { _id: new mongoose.Types.ObjectId(id), userId: new mongoose.Types.ObjectId(userId), status },
    { $set: { status: 'CANCELLED', cancelledAt: now, cancelReason: reason }, $unset: { quoteExpiresAt: '' } }
  );
  if (!upd?.modifiedCount) return res.status(409).json({ error: 'CONFLICT' });

  await logEvent({
    orderId: id,
    fromStatus: status,
    toStatus: 'CANCELLED',
    actorRole: 'USER',
    actorId: userId,
    note: reason,
    imageUrl: '',
    at: now
  });

  try {
    const workshopUserId = await getVendorUserId(order?.shopId);
    if (mongoose.isValidObjectId(workshopUserId)) {
      await createNotification({
        userId: workshopUserId,
        type: 'ORDER_CANCELLED',
        content: 'Khách đã hủy đơn',
        meta: { orderId: id }
      });
    }
  } catch {}

  res.json({ ok: true });
});

const reviewOrder = asyncHandler(async (req, res) => {
  const userId = String(req.user?.id || '').trim();
  const id = String(req.params?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const ratingRaw = req.body?.rating;
  const rating = Number(ratingRaw);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'INVALID_RATING' });
  const comment = normalizeText(req.body?.comment || req.body?.note || '', 800);

  const order = await Order.findOne({ _id: new mongoose.Types.ObjectId(id), userId: new mongoose.Types.ObjectId(userId) })
    .select('_id status shopId')
    .lean();
  if (!order) return res.status(404).json({ error: 'NOT_FOUND' });
  if (String(order.status || '') !== 'COMPLETED') return res.status(409).json({ error: 'ORDER_NOT_COMPLETED' });

  await VendorReview.findOneAndUpdate(
    {
      vendorId: new mongoose.Types.ObjectId(String(order.shopId)),
      userId: new mongoose.Types.ObjectId(String(userId)),
      bookingId: new mongoose.Types.ObjectId(String(order._id))
    },
    { $set: { rating, comment } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.json({ ok: true });
});

const expireQuotedOrders = async () => {
  const now = new Date();
  const rows = await Order.find({ status: 'QUOTED', quoteExpiresAt: { $lte: now } })
    .select('_id userId shopId')
    .lean();
  if (!rows.length) return 0;

  let changed = 0;
  for (const o of rows) {
    const id = String(o?._id || '').trim();
    if (!mongoose.isValidObjectId(id)) continue;
    const r = await Order.updateOne(
      { _id: new mongoose.Types.ObjectId(id), status: 'QUOTED', quoteExpiresAt: { $lte: now } },
      { $set: { status: 'CANCELLED', cancelledAt: now, cancelReason: 'TIMEOUT' } }
    );
    if (!r?.modifiedCount) continue;
    changed += 1;

    try {
      await logEvent({
        orderId: id,
        fromStatus: 'QUOTED',
        toStatus: 'CANCELLED',
        actorRole: 'SYSTEM',
        actorId: null,
        note: 'Tự động hủy do quá thời gian phản hồi báo giá',
        imageUrl: '',
        at: now
      });
    } catch {}

    try {
      const uid = String(o?.userId || '').trim();
      if (mongoose.isValidObjectId(uid)) {
        await createNotification({
          userId: uid,
          type: 'ORDER_CANCELLED',
          content: 'Đơn hàng bị hủy do quá thời gian phản hồi báo giá',
          meta: { orderId: id, reason: 'TIMEOUT' }
        });
      }
    } catch {}

    try {
      const workshopUserId = await getVendorUserId(o?.shopId);
      if (mongoose.isValidObjectId(workshopUserId)) {
        await createNotification({
          userId: workshopUserId,
          type: 'ORDER_CANCELLED',
          content: 'Đơn hàng bị hủy do khách không phản hồi báo giá',
          meta: { orderId: id, reason: 'TIMEOUT' }
        });
      }
    } catch {}
  }
  return changed;
};

module.exports = { createOrder, listMyOrders, getMyOrderDetail, confirmOrder, rejectOrder, cancelOrder, reviewOrder, expireQuotedOrders, quoteTimeoutHours };
