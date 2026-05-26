const mongoose = require('mongoose');
const { asyncHandler } = require('../../../middleware/asyncHandler');
const { httpError } = require('../../../shared/errors/httpError');
const adminPartsService = require('../services/adminPartsService');

const listPartsAdmin = asyncHandler(async (req, res) => {
  const type = String(req.query?.type || '').trim();
  const items = await adminPartsService.listPartsAdmin({ type });
  res.json({ items });
});

const createPartAdmin = asyncHandler(async (req, res) => {
  const item = await adminPartsService.createPartAdmin(req.body);
  res.status(201).json({ item });
});

const updatePartAdmin = asyncHandler(async (req, res) => {
  const id = String(req.params.id || '');
  if (!mongoose.isValidObjectId(id)) throw httpError(400, 'INVALID_ID');
  const item = await adminPartsService.updatePartAdmin({ id, body: req.body });
  res.json({ item });
});

const deletePartAdmin = asyncHandler(async (req, res) => {
  const id = String(req.params.id || '');
  if (!mongoose.isValidObjectId(id)) throw httpError(400, 'INVALID_ID');
  await adminPartsService.deletePartAdmin({ id });
  res.json({ ok: true });
});

const uploadModelPartAdmin = asyncHandler(async (req, res) => {
  const data = await adminPartsService.uploadModelPartAdmin({ file: req.file });
  res.status(201).json(data);
});

const bulkAssignCompatibleCars = asyncHandler(async (req, res) => {
  const partIds = Array.isArray(req.body?.partIds) ? req.body.partIds : req.body?.ids;
  const compatibleCars = req.body?.compatibleCars || req.body?.compatible_cars || req.body?.carIds || req.body?.cars;
  const out = await adminPartsService.bulkAssignCompatibleCars({ partIds, compatibleCars });
  res.json({ ok: true, ...out });
});

module.exports = { listPartsAdmin, createPartAdmin, updatePartAdmin, deletePartAdmin, uploadModelPartAdmin, bulkAssignCompatibleCars };
