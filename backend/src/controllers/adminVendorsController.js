const mongoose = require('mongoose');

const Vendor = require('../models/Vendor');
const User = require('../models/User');
const Booking = require('../models/Booking');
const { asyncHandler } = require('../middleware/asyncHandler');

const normalizeStatus = (raw) => {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'pending' || v === 'approved' || v === 'rejected') return v;
  return '';
};

const listVendorsAdmin = asyncHandler(async (req, res) => {
  const status = normalizeStatus(req.query?.status);
  const q = status ? { status } : {};
  const rows = await Vendor.find(q).sort({ createdAt: -1 }).populate('userId', 'email name role createdAt').lean();

  const tz = String(process.env.TIMEZONE || '').trim() || 'Asia/Ho_Chi_Minh';
  const now = new Date();
  let start = new Date(now);
  start.setHours(0, 0, 0, 0);
  let end = new Date(start);
  end.setDate(end.getDate() + 1);
  try {
    const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const mm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
    if (mm) {
      const y = Number(mm[1]);
      const m = Number(mm[2]);
      const d = Number(mm[3]);
      const approxUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(approxUtc);
      const token = String(parts.find((p) => p.type === 'timeZoneName')?.value || '').trim();
      const off = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(token);
      if (off) {
        const sign = off[1] === '-' ? -1 : 1;
        const hh = Number(off[2]);
        const mn = Number(off[3] || 0);
        const offsetMin = sign * (hh * 60 + mn);
        start = new Date(approxUtc.getTime() - offsetMin * 60 * 1000);
        end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      }
    }
  } catch {}

  const vendorIds = rows.map((v) => v?._id).filter(Boolean);
  const counts = vendorIds.length
    ? await Booking.aggregate([
        {
          $match: {
            shopId: { $in: vendorIds },
            timeSlot: { $gte: start, $lt: end },
            $or: [{ status: { $in: ['accepted', 'in_progress'] } }, { status: 'pending', expiresAt: { $gt: now } }]
          }
        },
        { $group: { _id: '$shopId', activeBookingsToday: { $sum: 1 } } }
      ])
    : [];
  const countMap = new Map((Array.isArray(counts) ? counts : []).map((x) => [String(x?._id || ''), Number(x?.activeBookingsToday) || 0]));

  const items = rows.map((v) => ({
    _id: v._id,
    user: v.userId
      ? {
          _id: v.userId._id,
          email: v.userId.email || '',
          name: v.userId.name || '',
          role: v.userId.role || 'USER',
          createdAt: v.userId.createdAt
        }
      : null,
    shopName: v.shopName || '',
    representativeName: v.representativeName || '',
    status: v.status || 'pending',
    approvedAt: v.approvedAt || null,
    rejectedAt: v.rejectedAt || null,
    rejectionReason: v.rejectionReason || '',
    description: v.description || '',
    phone: v.phone || '',
    email: v.email || '',
    address: v.address || '',
    website: v.website || '',
    facebook: v.facebook || '',
    logo: v.logo || '',
    coverImage: v.coverImage || '',
    capacity: {
      maxSlots: Math.max(1, Math.floor(Number(v?.bookingPreferences?.capacity?.maxSlots) || 0)) || 1,
      mechanicCount: Math.max(1, Math.floor(Number(v?.bookingPreferences?.capacity?.mechanicCount) || 0)) || 1,
      activeBookingsToday: countMap.get(String(v._id)) || 0
    },
    overloaded: (countMap.get(String(v._id)) || 0) >= (Math.max(1, Math.floor(Number(v?.bookingPreferences?.capacity?.maxSlots) || 0)) || 1),
    createdAt: v.createdAt
  }));
  res.json({ items });
});

const approveVendorAdmin = asyncHandler(async (req, res) => {
  const id = String(req.params.id || '');
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const vendor = await Vendor.findById(id).lean();
  if (!vendor) return res.status(404).json({ error: 'NOT_FOUND' });

  await Vendor.updateOne(
    { _id: id },
    { $set: { status: 'approved', approvedAt: new Date(), rejectedAt: null, rejectionReason: '' } }
  );
  await User.updateOne({ _id: vendor.userId }, { $set: { role: 'VENDOR' } });

  const item = await Vendor.findById(id).populate('userId', 'email name role createdAt').lean();
  res.json({ item });
});

const rejectVendorAdmin = asyncHandler(async (req, res) => {
  const id = String(req.params.id || '');
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const vendor = await Vendor.findById(id).lean();
  if (!vendor) return res.status(404).json({ error: 'NOT_FOUND' });

  const reason = String(req.body?.reason || '').trim();
  await Vendor.updateOne(
    { _id: id },
    { $set: { status: 'rejected', rejectedAt: new Date(), rejectionReason: reason, approvedAt: null } }
  );

  const item = await Vendor.findById(id).populate('userId', 'email name role createdAt').lean();
  res.json({ item });
});

const updateVendorCapacityAdmin = asyncHandler(async (req, res) => {
  const id = String(req.params.id || '');
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const patch = {};
  if (req.body?.maxSlots !== undefined) {
    const n = Math.floor(Number(req.body.maxSlots));
    if (!Number.isFinite(n) || n < 1) return res.status(400).json({ error: 'INVALID_MAX_SLOTS' });
    patch['bookingPreferences.capacity.maxSlots'] = n;
  }
  if (req.body?.mechanicCount !== undefined) {
    const n = Math.floor(Number(req.body.mechanicCount));
    if (!Number.isFinite(n) || n < 1) return res.status(400).json({ error: 'INVALID_MECHANIC_COUNT' });
    patch['bookingPreferences.capacity.mechanicCount'] = n;
  }
  if (!Object.keys(patch).length) return res.status(400).json({ error: 'EMPTY_PATCH' });

  const vendor = await Vendor.findById(id).lean();
  if (!vendor) return res.status(404).json({ error: 'NOT_FOUND' });

  await Vendor.updateOne({ _id: id }, { $set: patch });
  const item = await Vendor.findById(id).populate('userId', 'email name role createdAt').lean();
  res.json({ item });
});

module.exports = { listVendorsAdmin, approveVendorAdmin, rejectVendorAdmin, updateVendorCapacityAdmin };
