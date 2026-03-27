const mongoose = require('mongoose');

const Vendor = require('../models/Vendor');
const User = require('../models/User');
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
    zalo: v.zalo || '',
    logo: v.logo || '',
    coverImage: v.coverImage || '',
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

module.exports = { listVendorsAdmin, approveVendorAdmin, rejectVendorAdmin };

