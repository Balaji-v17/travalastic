import mongoose from 'mongoose';

const DisruptionDetailsSchema = new mongoose.Schema(
  {
    oldDeparture: {
      type: String,
      default: null,
    },
    newDeparture: {
      type: String,
      default: null,
    },
    oldArrival: {
      type: String,
      default: null,
    },
    newArrival: {
      type: String,
      default: null,
    },
    delayMinutes: {
      type: Number,
      default: null,
    },
    structural: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const DisruptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    itineraryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Itinerary',
      required: [true, 'Itinerary ID is required'],
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
    type: {
      type: String,
      required: [true, 'Disruption type is required'],
      enum: {
        values: ['flight_schedule_change'],
        message: '{VALUE} is not a valid disruption type',
      },
    },
    source: {
      type: String,
      required: [true, 'Disruption source is required'],
      enum: {
        values: ['duffel_webhook', 'simulation'],
        message: '{VALUE} is not a valid disruption source',
      },
    },
    dedupeKey: {
      type: String,
      required: [true, 'dedupeKey is required'],
      trim: true,
    },
    details: {
      type: DisruptionDetailsSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: {
        values: ['new', 'proposed', 'approved', 'dismissed', 'expired', 'reverted'],
        message: '{VALUE} is not a valid disruption status',
      },
      default: 'new',
    },
    /**
     * Stored Proposal Schema:
     * - kind: 'reschedule' | 'manual_review'
     * - dayNumber: number | null
     * - option: number | null (30, 60, 120, 180)
     * - baseHash: string (SHA-256 slice of affected day activities)
     * - generatedAt: Date
     * - summary: string (deterministic description built from details numbers)
     * - changes: Array<{
     *     activityId: string,
     *     action: 'keep' | 'move' | 'skip',
     *     fromTime: string,
     *     toTime?: string,
     *     reason: string (max 140 chars plain text)
     *   }>
     * - unchangedCount: number
     * - capped: boolean
     */
    proposal: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    appliedEditId: {
      type: String,
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    dismissedAt: {
      type: Date,
      default: null,
    },
    revertedAt: {
      type: Date,
      default: null,
    },
    detectedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Compound index for querying user disruptions by status and creation time
DisruptionSchema.index({ userId: 1, status: 1, createdAt: 1 });

// Unique compound index preventing duplicate disruption entries per user
DisruptionSchema.index({ userId: 1, dedupeKey: 1 }, { unique: true });

export const Disruption =
  mongoose.models.Disruption || mongoose.model('Disruption', DisruptionSchema);

export default Disruption;

