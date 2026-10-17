import mongoose from 'mongoose';

const ExpenseSchema = new mongoose.Schema(
  {
    itineraryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Itinerary',
      required: [true, 'Itinerary ID is required'],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    amountINR: {
      type: Number,
      required: [true, 'amountINR is required'],
      min: [0.01, 'amountINR must be positive'],
    },
    originalAmount: {
      type: Number,
      default: null,
    },
    originalCurrency: {
      type: String,
      default: 'INR',
      trim: true,
      uppercase: true,
      match: [/^[A-Z]{3}$/, 'originalCurrency must be a 3-letter currency code'],
    },
    fxRate: {
      type: Number,
      default: null,
    },
    fxRateDate: {
      type: String,
      default: null,
    },
    fxRateSource: {
      type: String,
      enum: {
        values: ['ecb', 'manual', null],
        message: '{VALUE} is not a valid fxRateSource',
      },
      default: null,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: ['Food', 'Transport', 'Accommodation', 'Activities', 'Shopping', 'Other'],
        message: '{VALUE} is not a valid category',
      },
    },
    paidBy: {
      type: String,
      default: 'me',
      trim: true,
    },
    splitAmong: {
      type: [String],
      default: [],
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

const Expense = mongoose.model('Expense', ExpenseSchema);

export default Expense;
export { Expense };
