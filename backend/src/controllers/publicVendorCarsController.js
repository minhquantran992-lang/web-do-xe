const mongoose = require('mongoose');

const VendorCar = require('../models/VendorCar');
const { asyncHandler } = require('../middleware/asyncHandler');

const listPublicCars = asyncHandler(async (req, res) => {
  const docs = await VendorCar.find({})
    .sort({ createdAt: -1 })
    .populate('vendorId', 'shopName description phone email address website facebook zalo logo coverImage createdAt')
    .lean();

  const items = docs.map((d) => ({
    _id: d._id,
    title: d.title,
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
          zalo: d.vendorId.zalo || '',
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

  const d = await VendorCar.findById(id)
    .populate('vendorId', 'shopName description phone email address website facebook zalo logo coverImage createdAt')
    .lean();
  if (!d) return res.status(404).json({ error: 'NOT_FOUND' });

  res.json({
    item: {
      _id: d._id,
      title: d.title,
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
            zalo: d.vendorId.zalo || '',
            logo: d.vendorId.logo || '',
            coverImage: d.vendorId.coverImage || ''
          }
        : null
    }
  });
});

module.exports = { listPublicCars, getPublicCarDetail };

