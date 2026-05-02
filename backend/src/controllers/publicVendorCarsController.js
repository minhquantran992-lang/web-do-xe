const mongoose = require('mongoose');

const VendorCar = require('../models/VendorCar');
const { asyncHandler } = require('../middleware/asyncHandler');

const listPublicCars = asyncHandler(async (req, res) => {
  const vendorId = String(req.query?.vendor || req.query?.vendorId || '').trim();
  const filter = {};
  if (vendorId) {
    if (!mongoose.isValidObjectId(vendorId)) return res.status(400).json({ error: 'INVALID_VENDOR_ID' });
    filter.vendorId = new mongoose.Types.ObjectId(vendorId);
  }

  const docs = await VendorCar.find(filter)
    .sort({ createdAt: -1 })
    .populate('vendorId', 'shopName description phone email address website facebook logo coverImage createdAt')
    .lean();

  if (docs.length) {
    await VendorCar.updateMany(
      { _id: { $in: docs.map((d) => d._id) } },
      { $inc: { viewCount: 1 } }
    );
  }

  const items = docs.map((d) => ({
    _id: d._id,
    title: d.title,
    price: Number.isFinite(d.price) ? d.price : d.price ?? 0,
    stock: Number.isFinite(d.stock) ? d.stock : d.stock ?? 0,
    soldCount: Number.isFinite(d.soldCount) ? d.soldCount : d.soldCount ?? 0,
    viewCount: Number.isFinite(d.viewCount) ? d.viewCount : d.viewCount ?? 0,
    description: d.description || '',
    images: Array.isArray(d.images) ? d.images : [],
    coverImage: d.coverImage || '',
    createdAt: d.createdAt,
    vendor: d.vendorId
      ? {
          _id: d.vendorId._id,
          shopName: d.vendorId.shopName || '',
          description: d.vendorId.description || '',
          phone: d.vendorId.phone || '',
          email: d.vendorId.email || '',
          address: d.vendorId.address || '',
          website: d.vendorId.website || '',
          facebook: d.vendorId.facebook || '',
          logo: d.vendorId.logo || '',
          coverImage: d.vendorId.coverImage || ''
        }
      : null
  }));

  res.json({ items });
});

const getPublicCarDetail = asyncHandler(async (req, res) => {
  const id = String(req.params.id || '');
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'INVALID_ID' });

  const d = await VendorCar.findOneAndUpdate({ _id: id }, { $inc: { viewCount: 1 } }, { new: true })
    .populate('vendorId', 'shopName description phone email address website facebook logo coverImage createdAt')
    .lean();
  if (!d) return res.status(404).json({ error: 'NOT_FOUND' });

  res.json({
    item: {
      _id: d._id,
      title: d.title,
      price: Number.isFinite(d.price) ? d.price : d.price ?? 0,
      stock: Number.isFinite(d.stock) ? d.stock : d.stock ?? 0,
      soldCount: Number.isFinite(d.soldCount) ? d.soldCount : d.soldCount ?? 0,
      viewCount: Number.isFinite(d.viewCount) ? d.viewCount : d.viewCount ?? 0,
      description: d.description || '',
      images: Array.isArray(d.images) ? d.images : [],
      coverImage: d.coverImage || '',
      createdAt: d.createdAt,
      vendor: d.vendorId
        ? {
            _id: d.vendorId._id,
            shopName: d.vendorId.shopName || '',
            description: d.vendorId.description || '',
            phone: d.vendorId.phone || '',
            email: d.vendorId.email || '',
            address: d.vendorId.address || '',
            website: d.vendorId.website || '',
            facebook: d.vendorId.facebook || '',
            logo: d.vendorId.logo || '',
            coverImage: d.vendorId.coverImage || ''
          }
        : null
    }
  });
});

module.exports = { listPublicCars, getPublicCarDetail };
