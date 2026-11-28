import mongoose from 'mongoose';

const TouristPlaceSchema = new mongoose.Schema(
  {
    sourceId: {
      type: String,
      trim: true,
      default: undefined,
    },
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
      default: null,
    },
    zone: {
      type: String,
      trim: true,
      default: null,
    },
    type: {
      type: String,
      trim: true,
    },
    significance: {
      type: String,
      trim: true,
      default: null,
    },
    googleRating: {
      type: Number,
      min: 0,
      max: 5,
      default: null,
    },
    entranceFeeINR: {
      type: Number,
      min: 0,
      default: null,
    },
    timeNeededHours: {
      type: Number,
      min: 0,
      max: 48,
      default: null,
    },
    bestTimeToVisit: {
      type: String,
      trim: true,
      default: null,
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
    reviewFlags: {
      type: [String],
      default: [],
    },
    heritage: {
      protectedBy: {
        type: String,
        trim: true,
        default: null,
      },
      asiCircle: {
        type: String,
        trim: true,
        default: null,
      },
      location: {
        type: String,
        trim: true,
        default: null,
      },
      coordsApprox: {
        type: Boolean,
        default: false,
      },
      mergedSourceIds: {
        type: [String],
        default: [],
      },
      extraCoords: {
        type: [
          {
            _id: false,
            lat: { type: Number, required: true },
            lng: { type: Number, required: true },
          },
        ],
        default: [],
      },
      matchedCuratedPlace: {
        type: new mongoose.Schema(
          {
            placeId: { type: String, trim: true, required: true },
            name: { type: String, trim: true, required: true },
            city: { type: String, trim: true, default: null },
            state: { type: String, trim: true, default: null },
            reason: { type: String, trim: true, default: 'same_state_name' },
            distanceMeters: { type: Number, default: null },
          },
          { _id: false }
        ),
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Sparse unique index on external sourceId (e.g. ASI/SOI entity_uid)
TouristPlaceSchema.index({ sourceId: 1 }, { unique: true, sparse: true });

// Secondary indexes for queries by name+city, city, state, category/type, visibility, and heritage review
TouristPlaceSchema.index({ name: 1, city: 1 });
TouristPlaceSchema.index({ city: 1 });
TouristPlaceSchema.index({ state: 1 });
TouristPlaceSchema.index({ type: 1 });
TouristPlaceSchema.index({ hidden: 1 });
TouristPlaceSchema.index({ source: 1, hiddenReason: 1, state: 1, name: 1 });
TouristPlaceSchema.index({ reviewFlags: 1 });

const TouristPlace = mongoose.model('TouristPlace', TouristPlaceSchema);

export default TouristPlace;
export { TouristPlace };
