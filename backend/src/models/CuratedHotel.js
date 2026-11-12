import mongoose from 'mongoose';

const CuratedHotelSchema = new mongoose.Schema({
  destination: {
    type: String,
    required: true,
    trim: true,
  },
  budgetTier: {
    type: String,
    required: true,
    enum: ['budget', 'mid', 'luxury'],
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  priceRangeINR: {
    type: String,
    trim: true,
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  hidden: {
    type: Boolean,
    default: false,
    index: true,
  },
  hiddenReason: {
    type: String,
    trim: true,
    maxlength: 200,
    default: null,
  },
  priceReviewedAt: {
    type: Date,
    default: null,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser',
    default: null,
  },
  updatedByEmail: {
    type: String,
    trim: true,
    default: null,
  },
}, {
  timestamps: true,
});

// Index on destination and name for efficient upserts and queries
CuratedHotelSchema.index({ destination: 1, name: 1 });
CuratedHotelSchema.index({ hidden: 1, destination: 1 });

const CuratedHotel = mongoose.model('CuratedHotel', CuratedHotelSchema);

export default CuratedHotel;
export { CuratedHotel };
