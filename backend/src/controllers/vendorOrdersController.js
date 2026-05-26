const mongoose = require('mongoose');

const Order = require('../models/Order');
const OrderProgress = require('../models/OrderProgress');
const { asyncHandler } = require('../middleware/asyncHandler');
const { createNotification } = require('../services/notifications');

const MAIN_FLOW = ['REQUESTED', 'QUOTED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'];
const STATUS_LABEL = {
  REQUESTED: 'Yêu cầu báo giá',
  SHOP_REJECTED: 'Shop từ chối nhận',
  QUOTED: 'Đã có báo giá (chờ khách xác nhận)',
  REJECTED: 'Khách từ chối báo giá',
  CANCELLED: 'Đơn bị hủy',
  CONFIRMED: 'Khách đã xác nhận (chờ thi công)',
  IN_PROGRESS: 'Đang thi công',
  QUALITY_CHECK: 'Kiểm tra hoàn thiện',
  COMPLETED: 'Hoàn tất',
  DISPUTED: 'Tranh chấp'
};

const normalizeText = (v, maxLen = 1000) => String(v || '').trim().slice(0, maxLen);
const statusIndex = (s) => {
  const v = String(s || '').trim().toUpperCase();
  const idx = MAIN_FLOW.indexOf(v);
  return idx >= 0 ? idx : 0;
};

const quoteTimeoutHours = () => {
  const raw = Number(process.env.ORDER_QUOTE_TIMEOUT_HOURS || process.env.QUOTE_TIMEOUT_HOURS || 24);
  return Number.isFinite(raw) ? Math.max(1, Math.floor(raw)) : 24;
};

const PROJECT_STATUS = Object.freeze({
  DESIGN_DRAFT: 'DESIGN_DRAFT',
  DESIGN_SUBMITTED: 'DESIGN_SUBMITTED',
  WAITING_SHOP_RESPONSE: 'WAITING_SHOP_RESPONSE',
  SHOP_REJECTED: 'SHOP_REJECTED',
  QUOTE_SENT: 'QUOTE_SENT',
  WAITING_USER_CONFIRMATION: 'WAITING_USER_CONFIRMATION',
  USER_REJECTED_QUOTE: 'USER_REJECTED_QUOTE',
  QUOTE_CONFIRMED: 'QUOTE_CONFIRMED',
  WAITING_PRODUCTION: 'WAITING_PRODUCTION',
  IN_PROGRESS: 'IN_PROGRESS',
  QUALITY_CHECK: 'QUALITY_CHECK',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  DISPUTED: 'DISPUTED'
});

const mapOrderToProjectStatus = (order) => {
  const status = String(order?.status || '').trim().toUpperCase();
  if (status === 'REQUESTED') return { status: PROJECT_STATUS.WAITING_SHOP_RESPONSE };
  if (status === 'SHOP_REJECTED') return { status: PROJECT_STATUS.SHOP_REJECTED };
  if (status === 'QUOTED') return { status: PROJECT_STATUS.WAITING_USER_CONFIRMATION };
  if (status === 'REJECTED') return { status: PROJECT_STATUS.USER_REJECTED_QUOTE };
  if (status === 'CONFIRMED') return { status: PROJECT_STATUS.WAITING_PRODUCTION };
  if (status === 'IN_PROGRESS') return { status: PROJECT_STATUS.IN_PROGRESS };
  if (status === 'QUALITY_CHECK') return { status: PROJECT_STATUS.QUALITY_CHECK };
  if (status === 'COMPLETED') return { status: PROJECT_STATUS.COMPLETED };
  if (status === 'CANCELLED') return { status: PROJECT_STATUS.CANCELLED };
  if (status === 'DISPUTED') return { status: PROJECT_STATUS.DISPUTED };
  return { status: PROJECT_STATUS.WAITING_SHOP_RESPONSE };
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

const listVendorOrders = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '').trim();
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });

  const statusRaw = String(req.query?.status || '').trim().toUpperCase();
  const status = statusRaw ? statusRaw : '';

  const limitRaw = Number(req.query?.limit);
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.floor(limitRaw))) : 30;

  const q = { shopId: new mongoose.Types.ObjectId(vendorId), ...(status ? { status } : {}) };
  const items = await Order.find(q)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('userId', 'name email')
    .populate('buildId', 'name thumbnailUrl')
    .lean();

  res.json({
    ok: true,
    steps: MAIN_FLOW.map((k) => ({ key: k, label: STATUS_LABEL[k] || k })),
    items: (Array.isArray(items) ? items : []).map((o) => ({
      _id: o._id,
      status: String(o.status || ''),
      projectStatus: mapOrderToProjectStatus(o).status,
      currentStepIndex: statusIndex(o.status),
      quotedPrice: o.quotedPrice ?? null,
      quotedAt: o.quotedAt || null,
      quoteExpiresAt: o.quoteExpiresAt || null,
      confirmedAt: o.confirmedAt || null,
      startedAt: o.startedAt || null,
      completedAt: o.completedAt || null,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      user: {
        _id: String(o?.userId?._id || o?.userId || ''),
        name: String(o?.userId?.name || ''),
        email: String(o?.userId?.email || '')
      },
      build: {
        _id: String(o?.buildId?._id || o?.buildId || ''),
        name: String(o?.buildId?.name || ''),
        thumbnailUrl: String(o?.buildId?.thumbnailUrl || '')
      }
    }))
  });
});

const getVendorOrderDetail = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '').trim();
  const id = String(req.params?.id || '').trim();
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const order = await Order.findOne({ _id: id, shopId: new mongoose.Types.ObjectId(vendorId) })
    .populate('userId', 'name email phone')
    .populate('buildId', 'name thumbnailUrl')
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
      projectStatus: mapOrderToProjectStatus(order).status,
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
      user: {
        _id: String(order?.userId?._id || ''),
        name: String(order?.userId?.name || ''),
        email: String(order?.userId?.email || ''),
        phone: String(order?.userId?.phone || '')
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

const quoteOrder = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '').trim();
  const id = String(req.params?.id || '').trim();
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const price = Number(req.body?.quotedPrice ?? req.body?.price);
  if (!Number.isFinite(price) || price <= 0) return res.status(400).json({ error: 'INVALID_PRICE' });
  const quoteNote = normalizeText(req.body?.note || req.body?.quoteNote || '', 1000);

  const order = await Order.findOne({ _id: id, shopId: new mongoose.Types.ObjectId(vendorId) }).lean();
  if (!order) return res.status(404).json({ error: 'NOT_FOUND' });
  const status = String(order.status || '');
  if (status !== 'REQUESTED') return res.status(409).json({ error: 'INVALID_TRANSITION' });

  const now = new Date();
  const exp = new Date(now.getTime() + quoteTimeoutHours() * 60 * 60 * 1000);
  const upd = await Order.updateOne(
    { _id: new mongoose.Types.ObjectId(id), shopId: new mongoose.Types.ObjectId(vendorId), status: 'REQUESTED' },
    { $set: { status: 'QUOTED', quotedPrice: price, quoteNote, quotedAt: now, quoteExpiresAt: exp } }
  );
  if (!upd?.modifiedCount) return res.status(409).json({ error: 'CONFLICT' });

  await logEvent({
    orderId: id,
    fromStatus: 'REQUESTED',
    toStatus: 'QUOTED',
    actorRole: 'WORKSHOP',
    actorId: vendorId,
    note: quoteNote ? `Báo giá: ${price} • ${quoteNote}` : `Báo giá: ${price}`,
    imageUrl: '',
    at: now
  });

  try {
    const userId = String(order?.userId || '').trim();
    if (mongoose.isValidObjectId(userId)) {
      await createNotification({
        userId,
        type: 'ORDER_QUOTED',
        content: `Shop đã gửi báo giá: ${Math.round(price)}đ`,
        meta: { orderId: id, quotedPrice: price, quoteExpiresAt: exp.toISOString() }
      });
    }
  } catch {}

  res.json({ ok: true });
});

const rejectOrder = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '').trim();
  const id = String(req.params?.id || '').trim();
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const reasonRaw = normalizeText(req.body?.reason || req.body?.note || '', 500);
  const reason = reasonRaw.length > 500 ? reasonRaw.slice(0, 500) : reasonRaw;
  if (!reason || reason.length < 3) return res.status(400).json({ error: 'REASON_REQUIRED' });

  const order = await Order.findOne({ _id: id, shopId: new mongoose.Types.ObjectId(vendorId) }).lean();
  if (!order) return res.status(404).json({ error: 'NOT_FOUND' });
  const status = String(order.status || '');
  if (status !== 'REQUESTED') return res.status(409).json({ error: 'INVALID_TRANSITION' });

  const now = new Date();
  const upd = await Order.updateOne(
    { _id: new mongoose.Types.ObjectId(id), shopId: new mongoose.Types.ObjectId(vendorId), status: 'REQUESTED' },
    { $set: { status: 'SHOP_REJECTED', rejectedAt: now, cancelReason: reason } }
  );
  if (!upd?.modifiedCount) return res.status(409).json({ error: 'CONFLICT' });

  await logEvent({
    orderId: id,
    fromStatus: 'REQUESTED',
    toStatus: 'SHOP_REJECTED',
    actorRole: 'WORKSHOP',
    actorId: vendorId,
    note: reason ? `Từ chối nhận: ${reason}` : 'Từ chối nhận',
    imageUrl: '',
    at: now
  });

  try {
    const userId = String(order?.userId || '').trim();
    if (mongoose.isValidObjectId(userId)) {
      await createNotification({
        userId,
        type: 'ORDER_SHOP_REJECTED',
        content: reason ? `Shop đã từ chối yêu cầu: ${reason}` : 'Shop đã từ chối yêu cầu',
        meta: { orderId: id, reason }
      });
    }
  } catch {}

  res.json({ ok: true });
});

const startOrder = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '').trim();
  const id = String(req.params?.id || '').trim();
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const order = await Order.findOne({ _id: id, shopId: new mongoose.Types.ObjectId(vendorId) }).lean();
  if (!order) return res.status(404).json({ error: 'NOT_FOUND' });
  const status = String(order.status || '');
  if (status !== 'CONFIRMED') return res.status(409).json({ error: 'INVALID_TRANSITION' });

  const now = new Date();
  const upd = await Order.updateOne(
    { _id: new mongoose.Types.ObjectId(id), shopId: new mongoose.Types.ObjectId(vendorId), status: 'CONFIRMED' },
    { $set: { status: 'IN_PROGRESS', startedAt: now } }
  );
  if (!upd?.modifiedCount) return res.status(409).json({ error: 'CONFLICT' });

  await logEvent({
    orderId: id,
    fromStatus: 'CONFIRMED',
    toStatus: 'IN_PROGRESS',
    actorRole: 'WORKSHOP',
    actorId: vendorId,
    note: normalizeText(req.body?.note || 'Bắt đầu thi công'),
    imageUrl: normalizeText(req.body?.imageUrl || ''),
    at: now
  });

  try {
    const userId = String(order?.userId || '').trim();
    if (mongoose.isValidObjectId(userId)) {
      await createNotification({
        userId,
        type: 'ORDER_STARTED',
        content: 'Shop đã bắt đầu thi công',
        meta: { orderId: id }
      });
    }
  } catch {}

  res.json({ ok: true });
});

const completeOrder = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '').trim();
  const id = String(req.params?.id || '').trim();
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const order = await Order.findOne({ _id: id, shopId: new mongoose.Types.ObjectId(vendorId) }).lean();
  if (!order) return res.status(404).json({ error: 'NOT_FOUND' });
  const status = String(order.status || '');
  if (status !== 'IN_PROGRESS') return res.status(409).json({ error: 'INVALID_TRANSITION' });

  const now = new Date();
  const upd = await Order.updateOne(
    { _id: new mongoose.Types.ObjectId(id), shopId: new mongoose.Types.ObjectId(vendorId), status: 'IN_PROGRESS' },
    { $set: { status: 'COMPLETED', completedAt: now } }
  );
  if (!upd?.modifiedCount) return res.status(409).json({ error: 'CONFLICT' });

  await logEvent({
    orderId: id,
    fromStatus: 'IN_PROGRESS',
    toStatus: 'COMPLETED',
    actorRole: 'WORKSHOP',
    actorId: vendorId,
    note: normalizeText(req.body?.note || 'Hoàn tất'),
    imageUrl: normalizeText(req.body?.imageUrl || ''),
    at: now
  });

  try {
    const userId = String(order?.userId || '').trim();
    if (mongoose.isValidObjectId(userId)) {
      await createNotification({
        userId,
        type: 'ORDER_COMPLETED',
        content: 'Shop đã hoàn tất thi công',
        meta: { orderId: id }
      });
      await createNotification({
        userId,
        type: 'ORDER_REVIEW_REQUEST',
        content: 'Vui lòng đánh giá xưởng sau khi hoàn tất',
        meta: { orderId: id }
      });
    }
  } catch {}

  res.json({ ok: true });
});

const uploadOrderProof = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'MISSING_FILE' });
  res.status(201).json({ url: `/uploads/order-progress/${file.filename}` });
});

module.exports = { listVendorOrders, getVendorOrderDetail, quoteOrder, rejectOrder, startOrder, completeOrder, uploadOrderProof };
