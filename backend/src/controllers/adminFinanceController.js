const mongoose = require('mongoose');

const Booking = require('../models/Booking');
const Vendor = require('../models/Vendor');
const AdminLog = require('../models/AdminLog');
const { asyncHandler } = require('../middleware/asyncHandler');

const parseDate = (v) => {
  const s = String(v || '').trim();
  if (!s) return null;
  const d = new Date(s);
  if (!d || Number.isNaN(d.getTime())) return null;
  return d;
};

const clampDateRange = ({ fromRaw, toRaw }) => {
  const now = new Date();
  const to = parseDate(toRaw) || now;
  const from = parseDate(fromRaw) || new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (from.getTime() >= to.getTime()) return { ok: false, error: 'INVALID_DATE_RANGE' };
  const maxDays = 366;
  const diffDays = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
  if (diffDays > maxDays) return { ok: false, error: 'DATE_RANGE_TOO_LARGE' };
  return { ok: true, from, to };
};

const parseShopId = (v) => {
  const s = String(v || '').trim();
  if (!s) return { ok: true, shopObjectId: null };
  if (!mongoose.isValidObjectId(s)) return { ok: false, error: 'INVALID_SHOP_ID' };
  return { ok: true, shopObjectId: new mongoose.Types.ObjectId(s) };
};

const getIpAddress = (req) => {
  const xfwd = String(req.headers['x-forwarded-for'] || '').trim();
  if (xfwd) return xfwd.split(',')[0].trim();
  return String(req.ip || req.connection?.remoteAddress || '').trim();
};

const logAdmin = async ({ req, action, meta }) => {
  const adminId = String(req.user?.id || '').trim();
  if (!mongoose.isValidObjectId(adminId)) return;
  await AdminLog.create({
    adminUserId: new mongoose.Types.ObjectId(adminId),
    action: String(action || '').trim().slice(0, 120),
    path: String(req.originalUrl || req.path || '').trim().slice(0, 500),
    ipAddress: getIpAddress(req).slice(0, 120),
    meta: meta && typeof meta === 'object' ? meta : {}
  }).catch(() => {});
};

const buildCompletedMatch = ({ from, to, shopObjectId }) => {
  const q = { status: 'completed' };
  if (shopObjectId) q.shopId = shopObjectId;
  q.$or = [{ completedAt: { $gte: from, $lt: to } }, { completedAt: null, timeSlot: { $gte: from, $lt: to } }];
  return q;
};

const getFinanceOverview = asyncHandler(async (req, res) => {
  const range = clampDateRange({ fromRaw: req.query?.from, toRaw: req.query?.to });
  if (!range.ok) return res.status(400).json({ error: range.error });
  const shopParsed = parseShopId(req.query?.shopId);
  if (!shopParsed.ok) return res.status(400).json({ error: shopParsed.error });

  const match = buildCompletedMatch({ from: range.from, to: range.to, shopObjectId: shopParsed.shopObjectId });

  const [agg] = await Booking.aggregate([
    { $match: match },
    {
      $addFields: {
        effectiveCompletedAt: { $ifNull: ['$completedAt', '$timeSlot'] },
        totalPrice: { $ifNull: ['$snapshot.totalPrice', 0] }
      }
    },
    {
      $group: {
        _id: null,
        completedBookingsCount: { $sum: 1 },
        totalRevenue: { $sum: '$totalPrice' }
      }
    }
  ]);

  const shopSummary = await Booking.aggregate([
    { $match: match },
    { $addFields: { totalPrice: { $ifNull: ['$snapshot.totalPrice', 0] } } },
    { $group: { _id: '$shopId', completedBookingsCount: { $sum: 1 }, totalRevenue: { $sum: '$totalPrice' } } },
    { $sort: { totalRevenue: -1 } },
    { $limit: 20 }
  ]);

  const shopIds = shopSummary.map((x) => x?._id).filter(Boolean);
  const shops = shopIds.length ? await Vendor.find({ _id: { $in: shopIds } }).select('shopName').lean() : [];
  const shopMap = new Map(shops.map((s) => [String(s._id), String(s.shopName || '')]));

  await logAdmin({
    req,
    action: 'view_dashboard',
    meta: { from: range.from.toISOString(), to: range.to.toISOString(), shopId: shopParsed.shopObjectId ? String(shopParsed.shopObjectId) : '' }
  });

  res.json({
    item: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      shopId: shopParsed.shopObjectId ? String(shopParsed.shopObjectId) : '',
      completedBookingsCount: Number(agg?.completedBookingsCount) || 0,
      totalRevenue: Number(agg?.totalRevenue) || 0,
      byShop: shopSummary.map((x) => ({
        shopId: String(x?._id || ''),
        shopName: shopMap.get(String(x?._id || '')) || '',
        completedBookingsCount: Number(x?.completedBookingsCount) || 0,
        totalRevenue: Number(x?.totalRevenue) || 0
      }))
    }
  });
});

const getFinanceRevenue = asyncHandler(async (req, res) => {
  const range = clampDateRange({ fromRaw: req.query?.from, toRaw: req.query?.to });
  if (!range.ok) return res.status(400).json({ error: range.error });
  const shopParsed = parseShopId(req.query?.shopId);
  if (!shopParsed.ok) return res.status(400).json({ error: shopParsed.error });

  const match = buildCompletedMatch({ from: range.from, to: range.to, shopObjectId: shopParsed.shopObjectId });

  const rows = await Booking.aggregate([
    { $match: match },
    {
      $addFields: {
        effectiveCompletedAt: { $ifNull: ['$completedAt', '$timeSlot'] },
        totalPrice: { $ifNull: ['$snapshot.totalPrice', 0] }
      }
    },
    {
      $group: {
        _id: {
          y: { $year: '$effectiveCompletedAt' },
          m: { $month: '$effectiveCompletedAt' },
          d: { $dayOfMonth: '$effectiveCompletedAt' }
        },
        revenue: { $sum: '$totalPrice' },
        completedBookingsCount: { $sum: 1 }
      }
    },
    { $sort: { '_id.y': 1, '_id.m': 1, '_id.d': 1 } }
  ]);

  await logAdmin({
    req,
    action: 'view_revenue',
    meta: { from: range.from.toISOString(), to: range.to.toISOString(), shopId: shopParsed.shopObjectId ? String(shopParsed.shopObjectId) : '' }
  });

  res.json({
    item: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      shopId: shopParsed.shopObjectId ? String(shopParsed.shopObjectId) : '',
      series: rows.map((r) => {
        const y = Number(r?._id?.y) || 0;
        const m = String(Number(r?._id?.m) || 0).padStart(2, '0');
        const d = String(Number(r?._id?.d) || 0).padStart(2, '0');
        return { date: `${y}-${m}-${d}`, revenue: Number(r?.revenue) || 0, completedBookingsCount: Number(r?.completedBookingsCount) || 0 };
      })
    }
  });
});

const listFinanceBookings = asyncHandler(async (req, res) => {
  const range = clampDateRange({ fromRaw: req.query?.from, toRaw: req.query?.to });
  if (!range.ok) return res.status(400).json({ error: range.error });
  const shopParsed = parseShopId(req.query?.shopId);
  if (!shopParsed.ok) return res.status(400).json({ error: shopParsed.error });

  const match = buildCompletedMatch({ from: range.from, to: range.to, shopObjectId: shopParsed.shopObjectId });

  const items = await Booking.find(match)
    .select('_id shopId userId status timeSlot completedAt snapshot.totalPrice')
    .sort({ completedAt: -1 })
    .limit(500)
    .populate('shopId', 'shopName')
    .lean();

  await logAdmin({
    req,
    action: 'view_bookings',
    meta: { from: range.from.toISOString(), to: range.to.toISOString(), shopId: shopParsed.shopObjectId ? String(shopParsed.shopObjectId) : '' }
  });

  res.json({
    items: (Array.isArray(items) ? items : []).map((b) => {
      const shop = b.shopId
        ? {
            shopId: String(b.shopId._id || ''),
            shopName: String(b.shopId.shopName || '')
          }
        : { shopId: String(b.shopId || ''), shopName: '' };

      const completedAt = b.completedAt || b.timeSlot || null;
      const totalRevenue = Number(b?.snapshot?.totalPrice) || 0;

      return {
        bookingId: String(b._id || ''),
        userId: String(b.userId || ''),
        status: String(b.status || ''),
        completedAt,
        totalRevenue,
        shop
      };
    })
  });
});

const exportFinanceReport = asyncHandler(async (req, res) => {
  const range = clampDateRange({ fromRaw: req.query?.from, toRaw: req.query?.to });
  if (!range.ok) return res.status(400).json({ error: range.error });
  const shopParsed = parseShopId(req.query?.shopId);
  if (!shopParsed.ok) return res.status(400).json({ error: shopParsed.error });

  const match = buildCompletedMatch({ from: range.from, to: range.to, shopObjectId: shopParsed.shopObjectId });

  const rows = await Booking.find(match)
    .select('_id shopId status timeSlot completedAt snapshot.totalPrice')
    .sort({ completedAt: -1 })
    .limit(5000)
    .populate('shopId', 'shopName')
    .lean();

  await logAdmin({
    req,
    action: 'export_report',
    meta: { from: range.from.toISOString(), to: range.to.toISOString(), shopId: shopParsed.shopObjectId ? String(shopParsed.shopObjectId) : '', rows: rows.length }
  });

  const header = ['booking_id', 'shop_id', 'shop_name', 'status', 'completed_at', 'total_revenue_vnd'];
  const lines = [header.join(',')];
  for (const b of rows) {
    const shopId = b.shopId?._id ? String(b.shopId._id) : String(b.shopId || '');
    const shopName = b.shopId?.shopName ? String(b.shopId.shopName).replaceAll('"', '""') : '';
    const completedAt = (b.completedAt || b.timeSlot || null) ? new Date(b.completedAt || b.timeSlot).toISOString() : '';
    const total = Number(b?.snapshot?.totalPrice) || 0;
    const fields = [
      String(b._id || ''),
      shopId,
      `"${shopName}"`,
      String(b.status || ''),
      completedAt,
      String(Math.round(total))
    ];
    lines.push(fields.join(','));
  }

  const filename = `finance-report-${range.from.toISOString().slice(0, 10)}-to-${range.to.toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(`${lines.join('\n')}\n`);
});

module.exports = { getFinanceOverview, getFinanceRevenue, listFinanceBookings, exportFinanceReport };
