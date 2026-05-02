const Brand = require('../models/Brand');
const Car = require('../models/Car');
const Part = require('../models/Part');
const { buildSearchText } = require('./search');

const backfillModel = async ({ Model, pickText }) => {
  const docs = await Model.find({ $or: [{ searchText: { $exists: false } }, { searchText: '' }] })
    .select('_id')
    .lean();
  if (!Array.isArray(docs) || !docs.length) return;

  for (const d of docs) {
    const full = await Model.findById(d._id).lean();
    if (!full) continue;
    const next = pickText(full);
    await Model.updateOne({ _id: d._id }, { $set: { searchText: next } }).catch(() => {});
  }
};

const backfillSearchText = async () => {
  await backfillModel({
    Model: Car,
    pickText: (c) => buildSearchText(c?.name, c?.brand, c?.category, c?._id)
  });
  await backfillModel({
    Model: Part,
    pickText: (p) => buildSearchText(p?.name, p?.type, p?._id)
  });
  await backfillModel({
    Model: Brand,
    pickText: (b) => buildSearchText(b?.name, b?.key, b?.vehicleType, b?._id)
  });
};

module.exports = { backfillSearchText };

