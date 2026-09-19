import mongoose from 'mongoose';

const DestinationContentSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true,
  },
  tags: {
    type: [String],
    default: [],
  },
  embedding: {
    type: [Number],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index text for upserts and queries
DestinationContentSchema.index({ text: 1 });

const DestinationContent = mongoose.model('DestinationContent', DestinationContentSchema);

export default DestinationContent;
export { DestinationContent };
