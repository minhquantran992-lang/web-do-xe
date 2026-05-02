const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    shopName: { type: String, required: true, index: true },
    representativeName: { type: String, default: '' },
    province: { type: String, default: '', index: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    approvedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' },
    description: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    address: { type: String, default: '' },
    website: { type: String, default: '' },
    facebook: { type: String, default: '' },
    logo: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    locationLat: { type: Number, default: null },
    locationLng: { type: Number, default: null },
    quality: {
      flagged: { type: Boolean, default: false, index: true },
      flaggedAt: { type: Date, default: null },
      flagNote: { type: String, default: '' }
    },
    bookingPreferences: {
      acceptingBookings: { type: Boolean, default: true },
      locationText: { type: String, default: '' },
      locationLat: { type: Number, default: null },
      locationLng: { type: Number, default: null },
      scheduleType: { type: String, enum: ['asap', 'schedule'], default: 'asap' },
      scheduleAt: { type: Date, default: null },
      note: { type: String, default: '' },
      timezone: { type: String, default: '' },
      workingDays: { type: [Number], default: [] },
      closedDate: { type: String, default: '' },
      capacity: {
        maxSlots: { type: Number, default: 3 },
        mechanicCount: { type: Number, default: 1 }
      },
      workingHours: {
        start: { type: String, default: '' },
        end: { type: String, default: '' }
      },
      breakHours: {
        start: { type: String, default: '' },
        end: { type: String, default: '' }
      }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Vendor', vendorSchema);
