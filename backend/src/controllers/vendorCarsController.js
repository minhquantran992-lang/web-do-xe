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

  const priceRaw = req.body?.price;
  const price = Number(priceRaw);
  if (!Number.isFinite(price) || price <= 0) return res.status(400).json({ error: 'MISSING_PRICE' });

  const stockRaw = req.body?.stock ?? req.body?.quantity;
  const stockNum = stockRaw == null || stockRaw === '' ? 0 : Number(stockRaw);
  if (!Number.isFinite(stockNum) || stockNum < 0) return res.status(400).json({ error: 'INVALID_STOCK' });
  const stock = Math.floor(stockNum);

  const description = String(req.body?.description || '').trim();
  const coverImage = String(req.body?.coverImage || '').trim();
  const images = Array.isArray(req.body?.images)
    ? req.body.images.map((x) => String(x || '').trim()).filter(Boolean)
    : [];

  const doc = await VendorCar.create({ vendorId, title, price, stock, description, coverImage, images });
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
  if (req.body?.price !== undefined) {
    const price = Number(req.body?.price);
    if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: 'INVALID_PRICE' });
    patch.price = price;
  }
  if (req.body?.stock !== undefined || req.body?.quantity !== undefined) {
    const raw = req.body?.stock ?? req.body?.quantity;
    const n = raw === '' || raw == null ? 0 : Number(raw);
    if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: 'INVALID_STOCK' });
    patch.stock = Math.floor(n);
  }
  if (req.body?.soldCount !== undefined) {
    const n = req.body?.soldCount === '' || req.body?.soldCount == null ? 0 : Number(req.body?.soldCount);
    if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: 'INVALID_SOLD_COUNT' });
    patch.soldCount = Math.floor(n);
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
