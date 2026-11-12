import mongoose from 'mongoose';

export const ALLOWED_STYLE_KEYS = [
  'honeymoons',
  'wellness',
  'adventure',
  'family',
  'private-escapes',
  'celebrations',
];

const StylePickSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    imageQuery: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },
  },
  { _id: false }
);

const StyleCollectionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      enum: ALLOWED_STYLE_KEYS,
      trim: true,
    },
    picks: {
      type: [StylePickSchema],
      default: [],
      validate: [
        (val) => Array.isArray(val) && val.length <= 12,
        'A style collection can hold at most 12 picks.',
      ],
    },
    version: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    updatedByEmail: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

StyleCollectionSchema.index({ key: 1 }, { unique: true });

const StyleCollection =
  mongoose.models.StyleCollection ||
  mongoose.model('StyleCollection', StyleCollectionSchema);

export default StyleCollection;

