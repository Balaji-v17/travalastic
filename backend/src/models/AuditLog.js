import mongoose from 'mongoose';

/**
 * NOTE ON AUDIT LOG IMMUTABILITY:
 * Application-level hooks and method overrides prevent application code from
 * updating or deleting audit logs (append-only enforcement in code).
 * However, real tamper-resistance also requires database-level privilege separation:
 * the application MongoDB user should be granted insert and find permissions only
 * on the audit_logs collection (no update or delete privileges).
 */

const ChangeItemSchema = new mongoose.Schema(
  {
    field: {
      type: String,
      required: true,
      trim: true,
    },
    before: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    after: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { _id: false }
);

const AuditLogSchema = new mongoose.Schema(
  {
    at: {
      type: Date,
      default: Date.now,
      required: true,
    },
    actorId: {
      type: String,
      required: true,
      trim: true,
    },
    actorEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    actorRole: {
      type: String,
      required: true,
      trim: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    targetType: {
      type: String,
      trim: true,
      default: null,
    },
    targetId: {
      type: String,
      trim: true,
      default: null,
    },
    summary: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    changes: {
      type: [ChangeItemSchema],
      default: [],
      validate: [
        (val) => !val || val.length <= 20,
        'changes array exceeds maximum allowed length of 20 entries',
      ],
    },
  },
  {
    collection: 'audit_logs',
    versionKey: false,
    timestamps: false,
    bufferCommands: false,
  }
);

// Indexes specified in prompt
AuditLogSchema.index({ at: -1 });
AuditLogSchema.index({ actorId: 1, at: -1 });
AuditLogSchema.index({ action: 1, at: -1 });
AuditLogSchema.index({ targetType: 1, targetId: 1, at: -1 });

// Append-only enforcement: block updates on existing documents
AuditLogSchema.pre('save', function () {
  if (!this.isNew) {
    throw new Error('AuditLog is append-only: existing entries cannot be modified');
  }
});

// Append-only enforcement: block document deletion
AuditLogSchema.pre(['deleteOne', 'remove'], function () {
  throw new Error('AuditLog is append-only: entries cannot be deleted');
});

// Append-only enforcement: block query-level updates and deletions
const BLOCKED_QUERY_OPERATIONS = [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'findOneAndDelete',
  'deleteOne',
  'deleteMany',
  'replaceOne',
  'findOneAndReplace',
  'findByIdAndUpdate',
  'findByIdAndDelete',
];

for (const op of BLOCKED_QUERY_OPERATIONS) {
  AuditLogSchema.pre(op, function () {
    throw new Error(`AuditLog is append-only: ${op} is prohibited`);
  });
}

const AuditLog = mongoose.model('AuditLog', AuditLogSchema);

// Additional static method guards to guarantee immediate rejection before query dispatch
for (const op of BLOCKED_QUERY_OPERATIONS) {
  AuditLog[op] = function () {
    throw new Error(`AuditLog is append-only: ${op} is prohibited`);
  };
}

export default AuditLog;
export { AuditLog };
