import mongoose from 'mongoose';

const PassengerSchema = new mongoose.Schema(
  {
    givenName: { type: String, trim: true },
    familyName: { type: String, trim: true },
    name: { type: String, trim: true },
    dateOfBirth: { type: String, trim: true },
    gender: { type: String, trim: true },
    title: { type: String, trim: true },
    email: { type: String, trim: true },
    phoneNumber: { type: String, trim: true },
  },
  { _id: false }
);

const BookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    bookingReference: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    orderId: {
      type: String,
      trim: true,
    },
    offerId: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      default: 'flight',
    },
    status: {
      type: String,
      default: 'confirmed',
    },
    airline: {
      type: String,
      trim: true,
    },
    origin: {
      type: String,
      trim: true,
    },
    destination: {
      type: String,
      trim: true,
    },
    departureTime: {
      type: Date,
    },
    arrivalTime: {
      type: Date,
    },
    duration: {
      type: String,
      trim: true,
    },
    passengers: [PassengerSchema],
    passengerNames: [
      {
        type: String,
        trim: true,
      },
    ],
    totalAmount: {
      type: String,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    slices: {
      type: Array,
      default: [],
    },
    rawOrder: {
      type: Object,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

const Booking = mongoose.model('Booking', BookingSchema);

export default Booking;
export { Booking };
