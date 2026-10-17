import mongoose from 'mongoose';

const ActivityLocationSchema = new mongoose.Schema(
  {
    lat: { type: Number, default: null },
    lon: { type: Number, default: null },
    placeName: { type: String, default: null },
  },
  { _id: false }
);

const ActivitySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: '',
    },
    name: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    suggestedTime: {
      type: String,
      default: null,
    },
    placeId: {
      type: String,
      default: null,
    },
    location: {
      type: ActivityLocationSchema,
      default: null,
    },
    outdoor: {
      type: Boolean,
      default: null,
    },
    done: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false, strict: false }
);

const DayPlanSchema = new mongoose.Schema(
  {
    dayNumber: {
      type: Number,
      required: true,
    },
    activities: [ActivitySchema],
    estimatedCostINR: {
      type: Number,
    },
    accommodationSuggestion: {
      type: String,
    },
  },
  { _id: false }
);

const PackingCategorySchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
    },
    items: [
      {
        type: String,
      },
    ],
  },
  { _id: false }
);

const PackingCustomItemSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    default: 'My items',
    trim: true,
  },
});

const TravelerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
});

const EditHistorySchema = new mongoose.Schema({
  dayNumbers: [{ type: Number, required: true }],
  previousDays: [mongoose.Schema.Types.Mixed],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const ItinerarySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  rawRequest: {
    type: String,
    trim: true,
  },
  destination: {
    type: String,
    trim: true,
  },
  destinationCoordinates: {
    lat: { type: Number, default: null },
    lon: { type: Number, default: null },
  },
  startDate: {
    type: String,
    trim: true,
  },
  endDate: {
    type: String,
    trim: true,
  },
  budgetTier: {
    type: String,
    enum: ['budget', 'mid', 'luxury'],
  },
  interests: [
    {
      type: String,
      trim: true,
    },
  ],
  days: [DayPlanSchema],
  budgetEstimate: {
    type: Number,
  },
  packingList: {
    type: [PackingCategorySchema],
    default: null,
  },
  packingCustomItems: {
    type: [PackingCustomItemSchema],
    default: [],
  },
  packingChecked: {
    type: [String],
    default: [],
  },
  travelers: {
    type: [TravelerSchema],
    default: [],
  },
  editHistory: {
    type: [EditHistorySchema],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Itinerary = mongoose.model('Itinerary', ItinerarySchema);

/**
 * Reusable ownership check and retrieval helper.
 * Returns the Itinerary document if it exists and belongs to userId,
 * or null if invalid id, non-existent, or belonging to another user.
 *
 * @param {string|mongoose.Types.ObjectId} itineraryId
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<mongoose.Document|null>}
 */
export const findUserItinerary = async (itineraryId, userId) => {
  if (!itineraryId || !userId || !mongoose.Types.ObjectId.isValid(itineraryId)) {
    return null;
  }
  return Itinerary.findOne({
    _id: itineraryId,
    userId,
  });
};

export default Itinerary;
export { Itinerary };
