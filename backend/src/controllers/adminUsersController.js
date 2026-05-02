const mongoose = require('mongoose');

const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Configuration = require('../models/Configuration');
const { asyncHandler } = require('../middleware/asyncHandler');

const normalizeRole = (raw) => {
  const v = String(raw || '')
    .trim()
    .toUpperCase();
  if (v === 'ADMIN' || v === 'VENDOR' || v === 'USER') return v;
  return '';
};

const listUsersAdmin = asyncHandler(async (req, res) => {
  const q = String(req.query?.q || '').trim();
  const role = normalizeRole(req.query?.role);

  const query = {};
  if (role) query.role = role;
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ email: rx }, { phone: rx }, { name: rx }];
  }

  const users = await User.find(query)
    .select('name email phone role provider emailVerified registrationPending createdAt')
    .sort({ createdAt: -1 })
    .lean();

  const userIds = users.map((u) => u._id);
  const vendors = await Vendor.find({ userId: { $in: userIds } })
    .select('userId status shopName approvedAt rejectedAt')
    .lean();
  const vendorByUserId = new Map(vendors.map((v) => [String(v.userId), v]));

  const items = users.map((u) => {
    const vendor = vendorByUserId.get(String(u._id)) || null;
    return {
      _id: u._id,
      name: u.name || '',
      email: u.email || '',
      phone: u.phone || '',
      role: u.role || 'USER',
      provider: u.provider || 'local',
      emailVerified: Boolean(u.emailVerified),
      registrationPending: Boolean(u.registrationPending),
      createdAt: u.createdAt,
      vendor: vendor
        ? {
            _id: vendor._id,
            status: vendor.status || 'pending',
            shopName: vendor.shopName || '',
            approvedAt: vendor.approvedAt || null,
            rejectedAt: vendor.rejectedAt || null
          }
        : null
    };
  });

  res.json({ items });
});

const updateUserAdmin = asyncHandler(async (req, res) => {
  const id = String(req.params.id || '');
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });
  if (String(req.user?.id || '') === id) return res.status(400).json({ error: 'CANNOT_EDIT_SELF' });

  const patch = {};
  if (req.body?.role !== undefined) {
    const role = normalizeRole(req.body?.role);
    if (!role) return res.status(400).json({ error: 'INVALID_ROLE' });
    patch.role = role;
  }
  if (req.body?.emailVerified !== undefined) patch.emailVerified = Boolean(req.body.emailVerified);

  if (!Object.keys(patch).length) return res.status(400).json({ error: 'EMPTY_PATCH' });

  const updated = await User.findByIdAndUpdate(id, { $set: patch }, { new: true })
    .select('name email phone role provider emailVerified registrationPending createdAt')
    .lean();
  if (!updated) return res.status(404).json({ error: 'NOT_FOUND' });

  const vendor = await Vendor.findOne({ userId: updated._id }).select('status shopName approvedAt rejectedAt').lean();
  res.json({
    item: {
      _id: updated._id,
      name: updated.name || '',
      email: updated.email || '',
      phone: updated.phone || '',
      role: updated.role || 'USER',
      provider: updated.provider || 'local',
      emailVerified: Boolean(updated.emailVerified),
      registrationPending: Boolean(updated.registrationPending),
      createdAt: updated.createdAt,
      vendor: vendor
        ? {
            _id: vendor._id,
            status: vendor.status || 'pending',
            shopName: vendor.shopName || '',
            approvedAt: vendor.approvedAt || null,
            rejectedAt: vendor.rejectedAt || null
          }
        : null
    }
  });
});

const deleteUserAdmin = asyncHandler(async (req, res) => {
  const id = String(req.params.id || '');
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });
  if (String(req.user?.id || '') === id) return res.status(400).json({ error: 'CANNOT_DELETE_SELF' });

  const user = await User.findById(id).select('_id').lean();
  if (!user) return res.status(404).json({ error: 'NOT_FOUND' });

  await Configuration.deleteMany({ userId: id });

  const vendor = await Vendor.findOne({ userId: id }).select('_id').lean();
  if (vendor?._id) {
    await Vendor.deleteOne({ _id: vendor._id });
  }

  await User.deleteOne({ _id: id });
  res.json({ ok: true });
});

module.exports = { listUsersAdmin, updateUserAdmin, deleteUserAdmin };
