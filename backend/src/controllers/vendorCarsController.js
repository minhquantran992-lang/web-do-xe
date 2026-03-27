const mongoose = require('mongoose');

const VendorCar = require('../models/VendorCar');
const { asyncHandler } = require('../middleware/asyncHandler');

const listVendorCars = asyncHandler(async (req, res) => {
  const vendorId = req.vendor?._id;
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });
  const docs = await VendorCar.find({ vendorId }).sort({ createdAt: -1 }).lean();
  res.json({ items: docs });
});

const createVendorCar = asyncHandler(async (req, res) => {
  const vendorId = req.vendor?._id;
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });

  const title = String(req.body?.title || '').trim();
  if (!title) return res.status(400).json({ error: 'MISSING_TITLE' });

  const description = String(req.body?.description || '').trim();
  const coverImage = String(req.body?.coverImage || '').trim();
  const images = Array.isArray(req.body?.images)
    ? req.body.images.map((x) => String(x || '').trim()).filter(Boolean)
    : [];

  const doc = await VendorCar.create({ vendorId, title, description, coverImage, images });
  res.status(201).json({ item: doc });
});

const updateVendorCar = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '');
  const id = String(req.vendorCar?._id || req.params.id || '');
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });

  const patch = {};
  if (req.body?.title !== undefined) {
    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(400).json({ error: 'MISSING_TITLE' });
    patch.title = title;
  }
  if (req.body?.description !== undefined) patch.description = String(req.body?.description || '').trim();
  if (req.body?.coverImage !== undefined) patch.coverImage = String(req.body?.coverImage || '').trim();
  if (req.body?.images !== undefined) {
    patch.images = Array.isArray(req.body?.images)
      ? req.body.images.map((x) => String(x || '').trim()).filter(Boolean)
      : [];
  }

  const updated = await VendorCar.findOneAndUpdate({ _id: id, vendorId }, { $set: patch }, { new: true }).lean();
  if (!updated) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ item: updated });
});

const deleteVendorCar = asyncHandler(async (req, res) => {
  const vendorId = String(req.vendor?._id || '');
  const id = String(req.vendorCar?._id || req.params.id || '');
  if (!vendorId) return res.status(403).json({ error: 'FORBIDDEN' });

  const deleted = await VendorCar.findOneAndDelete({ _id: id, vendorId }).lean();
  if (!deleted) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json({ ok: true });
});

const uploadVendorCarImage = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'MISSING_FILE' });
  res.status(201).json({ url: `/uploads/vendor-cars/${file.filename}` });
});

module.exports = { listVendorCars, createVendorCar, updateVendorCar, deleteVendorCar, uploadVendorCarImage };
