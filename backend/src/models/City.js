import mongoose from 'mongoose';

const CitySchema = new mongoose.Schema(
  {
    sourceId: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    nameAscii: {
      type: String,
      trim: true,
      default: '',
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
    iso3: {
      type: String,
      trim: true,
      default: '',
    },
    admin: {
      type: String,
      trim: true,
      default: '',
    },
    capital: {
      type: String,
      trim: true,
      default: '',
    },
    population: {
      type: Number,
      default: null,
      min: 0,
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

CitySchema.index({ sourceId: 1 }, { unique: true });
CitySchema.index({ searchKey: 1, population: -1 });

const City = mongoose.model('City', CitySchema);

export default City;
export { City };

