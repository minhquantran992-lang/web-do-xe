const mongoose = require('mongoose');

const normalizeObjectIdArray = (value) => {
  const arr = Array.isArray(value) ? value : [];
  return arr.map((x) => String(x || '').trim()).filter((id) => mongoose.isValidObjectId(id));
};

module.exports = { normalizeObjectIdArray };
