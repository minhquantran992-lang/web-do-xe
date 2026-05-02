const mongoose = require('mongoose');

const buildVoteSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    buildId: { type: mongoose.Schema.Types.ObjectId, ref: 'Configuration', required: true, index: true }
  },
  { timestamps: true }
);

buildVoteSchema.index({ userId: 1, buildId: 1 }, { unique: true });

module.exports = mongoose.model('BuildVote', buildVoteSchema);

