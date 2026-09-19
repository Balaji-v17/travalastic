import mongoose from 'mongoose';

const DayPlanSchema = new mongoose.Schema(
  {
    dayNumber: {
      type: Number,
      required: true,
    },
    activities: [
      {
        type: String,
      },
    ],
    estimatedCostINR: {
      type: Number,
    },
    accommodationSuggestion: {
      type: String,
    },
  },
  { _id: false }
);

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
