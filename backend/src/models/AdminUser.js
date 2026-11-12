import mongoose from 'mongoose';

const AdminUserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: true,
      enum: ['super_admin', 'content_editor', 'support_agent'],
    },
    active: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    tokensValidAfter: {
      type: Date,
      default: null,
    },
    passwordChangedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'admin_users',
  }
);

AdminUserSchema.methods.toSafeObject = function () {
  return {
    id: this._id.toString(),
    _id: this._id.toString(),
    email: this.email,
    role: this.role,
    active: this.active,
    mustChangePassword: this.mustChangePassword ?? false,
    createdAt: this.createdAt,
    lastLoginAt: this.lastLoginAt,
  };
};

const AdminUser = mongoose.model('AdminUser', AdminUserSchema);

export default AdminUser;
export { AdminUser };

