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
    hidden: {
      type: Boolean,
      default: false,
    },
    hiddenReason: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    embeddingStale: {
      type: Boolean,
      default: false,
    },
    isCurated: {
      type: Boolean,
      default: false,
    },
    source: {
      type: String,
      default: 'kaggle',
      trim: true,
    },
    placeId: {
      type: String,
      default: null,
      trim: true,
    },
    latitude: {
      type: Number,
      default: undefined,
    },
    longitude: {
      type: Number,
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index on name + city to facilitate duplicate avoidance and fast lookups
TouristPlaceSchema.index({ name: 1, city: 1 }, { unique: true });

// Secondary indexes for queries by city, state, category/type, and hidden status
TouristPlaceSchema.index({ city: 1 });
TouristPlaceSchema.index({ state: 1 });
TouristPlaceSchema.index({ type: 1 });
TouristPlaceSchema.index({ hidden: 1 });

const TouristPlace = mongoose.model('TouristPlace', TouristPlaceSchema);

export default TouristPlace;
export { TouristPlace };
