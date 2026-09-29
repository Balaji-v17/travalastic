import mongoose from 'mongoose';

const TouristPlaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    zone: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      trim: true,
    },
    significance: {
      type: String,
      trim: true,
    },
    googleRating: {
      type: Number,
      min: 0,
      max: 5,
    },
    entranceFeeINR: {
      type: Number,
      default: 0,
    },
    timeNeededHours: {
      type: Number,
    },
    bestTimeToVisit: {
      type: String,
      trim: true,
    },
    embedding: {
      type: [Number],
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index on name + city to facilitate duplicate avoidance and fast lookups
TouristPlaceSchema.index({ name: 1, city: 1 }, { unique: true });

// Secondary indexes for queries by city, state, and category/type
TouristPlaceSchema.index({ city: 1 });
TouristPlaceSchema.index({ state: 1 });
TouristPlaceSchema.index({ type: 1 });

const TouristPlace = mongoose.model('TouristPlace', TouristPlaceSchema);

export default TouristPlace;
export { TouristPlace };
