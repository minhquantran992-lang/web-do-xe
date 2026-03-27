const mongoose = require('mongoose');

const connectDb = async (mongoUri) => {
  if (!mongoUri) {
    throw new Error('Missing MONGODB_URI');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(mongoUri);
  console.log('MongoDB connected');
};

module.exports = { connectDb };

