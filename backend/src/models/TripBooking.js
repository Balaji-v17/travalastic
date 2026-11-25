import mongoose from 'mongoose';

export const RECORDED_BOOKING_KINDS = ['hotel', 'bus', 'train', 'cab', 'car_rental'];
export const RECORDED_BOOKING_STATUSES = ['booked', 'cancelled'];

const TripBookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: RECORDED_BOOKING_KINDS,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    provider: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    startAt: {
      type: String,
      required: true,
      trim: true,
    },
    endAt: {
      type: String,
      default: '',
      trim: true,
    },
    reference: {
      type: String,
      default: '',
      trim: true,
      maxlength: 60,
    },
    amount: {
      type: String,
      default: '',
      trim: true,
    },
    currency: {
      type: String,
      default: '',
      trim: true,
      uppercase: true,
    },
    status: {
      type: String,
      enum: RECORDED_BOOKING_STATUSES,
      default: 'booked',
      index: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
      maxlength: 300,
    },
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Itinerary',
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

const TripBooking = mongoose.model('TripBooking', TripBookingSchema);

export default TripBooking;
export { TripBooking };

