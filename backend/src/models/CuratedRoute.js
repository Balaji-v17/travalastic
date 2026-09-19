import mongoose from 'mongoose';

const CuratedRouteSchema = new mongoose.Schema({
  mode: {
    type: String,
    required: true,
    enum: ['train', 'bus'],
  },
  origin: {
    type: String,
    required: true,
    trim: true,
  },
  destination: {
    type: String,
    required: true,
    trim: true,
  },
  approxDurationHours: {
    type: Number,
  },
  frequency: {
    type: String,
    trim: true,
  },
  note: {
    type: String,
    trim: true,
    default: 'Approximate schedule - verify before travel',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index on origin, destination, and mode for efficient search and upsert
CuratedRouteSchema.index({ origin: 1, destination: 1, mode: 1 });

const CuratedRoute = mongoose.model('CuratedRoute', CuratedRouteSchema);

export default CuratedRoute;
export { CuratedRoute };

