import mongoose from 'mongoose';

const RegionSchema = new mongoose.Schema(
  {
    sourceKey: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    searchKey: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      required: true,
      trim: true,
    },
    iso2: {
      type: String,
      trim: true,
      default: '',
    },
    lat: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    lng: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
  },
  {
    timestamps: true,
  }
);

RegionSchema.index({ sourceKey: 1 }, { unique: true });
RegionSchema.index({ searchKey: 1, name: 1 });

const Region = mongoose.model('Region', RegionSchema);

export default Region;
export { Region };

