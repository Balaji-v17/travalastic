import mongoose from 'mongoose';

const PackingTemplateItemSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, 'Item text is required'],
      trim: true,
      maxlength: [80, 'Item text cannot exceed 80 characters'],
    },
    category: {
      type: String,
      default: 'My items',
      trim: true,
      maxlength: [40, 'Category cannot exceed 40 characters'],
    },
  },
  { _id: false }
);

const PackingTemplateSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true,
  },
  name: {
    type: String,
    required: [true, 'Template name is required'],
    trim: true,
    maxlength: [40, 'Template name cannot exceed 40 characters'],
  },
  items: {
    type: [PackingTemplateItemSchema],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const PackingTemplate =
  mongoose.models.PackingTemplate ||
  mongoose.model('PackingTemplate', PackingTemplateSchema);

export default PackingTemplate;

