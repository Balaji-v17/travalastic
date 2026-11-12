import mongoose from 'mongoose';
import AuditLog from '../models/AuditLog.js';

export const SECRET_FIELD_REGEX = /(?:password|passwordHash|token|secret|apiKey|authorization|cookie)/i;
export const MAX_STRING_LENGTH = 300;
export const MAX_CHANGES_COUNT = 20;

/**
 * Deep sanitization for values:
 * - Redacts secret keys in nested objects
 * - Truncates strings exceeding MAX_STRING_LENGTH
 * - Converts ObjectIds and Dates safely
 */
export function sanitizeAuditValue(key, value) {
  if (value === undefined || value === null) {
    return value;
  }

  if (key && SECRET_FIELD_REGEX.test(key)) {
    return '[redacted]';
  }

  if (typeof value === 'string') {
    if (value.length > MAX_STRING_LENGTH) {
      return value.slice(0, MAX_STRING_LENGTH) + '...';
    }
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value._bsontype === 'ObjectID' || (value._id && typeof value.toHexString === 'function')) {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditValue(null, item));
  }

  if (typeof value === 'object') {
    const sanitizedObj = {};
    for (const [subKey, subVal] of Object.entries(value)) {
      if (SECRET_FIELD_REGEX.test(subKey)) {
        sanitizedObj[subKey] = '[redacted]';
      } else {
        sanitizedObj[subKey] = sanitizeAuditValue(subKey, subVal);
      }
    }
    return sanitizedObj;
  }

  return String(value);
}

/**
 * Deep equality check to determine whether a field actually changed.
 */
function valuesAreEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return a === b;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();

  // Handle Mongoose / BSON ObjectIds
  const aStr = a._bsontype === 'ObjectID' || typeof a?.toHexString === 'function' ? a.toString() : null;
  const bStr = b._bsontype === 'ObjectID' || typeof b?.toHexString === 'function' ? b.toString() : null;
  if (aStr && bStr) return aStr === bStr;

  if (typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  return false;
}

/**
 * Extracts raw object from plain object or Mongoose Document.
 */
function toPlainObject(doc) {
  if (!doc) return {};
  if (typeof doc.toObject === 'function') {
    return doc.toObject();
  }
  return doc;
}

/**
 * buildChanges(before, after, allowedFields)
 *
 * - Returns ONLY changed fields among allowedFields (no diff everything)
 * - Redacts any field whose name matches secret regex (including nested keys)
 * - Truncates strings exceeding 300 characters with "..."
 * - Never stores full documents
 * - Caps at max 20 entries
 *
 * @param {Object} before
 * @param {Object} after
 * @param {string[]} allowedFields
 * @returns {Array<{ field: string, before: any, after: any }>}
 */
export function buildChanges(before, after, allowedFields = []) {
  if (!Array.isArray(allowedFields) || allowedFields.length === 0) {
    return [];
  }

  const plainBefore = toPlainObject(before);
  const plainAfter = toPlainObject(after);

  const changes = [];

  for (const field of allowedFields) {
    if (typeof field !== 'string' || !field.trim()) continue;

    const beforeVal = plainBefore[field];
    const afterVal = plainAfter[field];

    if (!valuesAreEqual(beforeVal, afterVal)) {
      const isSecretField = SECRET_FIELD_REGEX.test(field);

      const sanitizedBefore =
        isSecretField && beforeVal !== undefined && beforeVal !== null
          ? '[redacted]'
          : sanitizeAuditValue(field, beforeVal);

      const sanitizedAfter =
        isSecretField && afterVal !== undefined && afterVal !== null
          ? '[redacted]'
          : sanitizeAuditValue(field, afterVal);

      changes.push({
        field,
        before: sanitizedBefore !== undefined ? sanitizedBefore : null,
        after: sanitizedAfter !== undefined ? sanitizedAfter : null,
      });

      if (changes.length >= MAX_CHANGES_COUNT) {
        break;
      }
    }
  }

  return changes;
}

/**
 * Checks whether MongoDB transactions are supported in current environment.
 * Replica sets (like Atlas) support transactions; standalone/memory instances do not.
 */
async function canUseTransactions() {
  if (mongoose.connection.readyState !== 1) {
    return false;
  }
  // If explicitly disabled in test, skip
  if (process.env.DISABLE_MONGO_TRANSACTIONS === 'true') {
    return false;
  }
  try {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      await session.abortTransaction();
      await session.endSession();
      return true;
    } catch (txErr) {
      await session.endSession();
      return false;
    }
  } catch (err) {
    return false;
  }
}

/**
 * runAudited(req, options, mutationFn)
 *
 * Executes mutationFn and writes the audit entry atomically inside ONE transaction.
 * If transactions are available:
 *   - Both mutation and audit succeed, or both roll back on failure.
 *   - Returns the mutation result.
 *   - On audit write failure, rolls back and throws 500 without leaking content.
 * If transactions are NOT available (standalone / dev fallback):
 *   - Writes audit entry first with intended change.
 *   - If mutation then fails, writes a second 'failed' entry referencing the first.
 *
 * @param {express.Request} req
 * @param {Object} options
 * @param {string} options.action
 * @param {string} [options.targetType]
 * @param {string} [options.targetId]
 * @param {string} options.summary
 * @param {string[]} [options.allowedFields]
 * @param {Object} [options.before]
 * @param {Object} [options.after]
 * @param {Function} mutationFn (session) => Promise<any>
 * @returns {Promise<any>}
 */
export async function runAudited(
  req,
  { action, targetType = null, targetId = null, summary, allowedFields = [], before = null, after = null },
  mutationFn
) {
  if (typeof mutationFn !== 'function') {
    throw new Error('runAudited requires a mutationFn function');
  }

  const actorId = req?.admin?.id || req?.adminId || 'unknown_admin';
  const actorEmail = req?.admin?.email || 'unknown@travalastic.com';
  const actorRole = req?.admin?.role || 'super_admin';
  const cleanSummary = String(summary || `${action} executed`).slice(0, 200);

  const supportsTx = await canUseTransactions();

  if (supportsTx) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // Execute mutation inside transaction
      const mutationOutcome = await mutationFn(session);

      // Determine before and after states
      const effectiveBefore =
        mutationOutcome && typeof mutationOutcome === 'object' && 'before' in mutationOutcome
          ? mutationOutcome.before
          : before;
      const effectiveAfter =
        mutationOutcome && typeof mutationOutcome === 'object' && 'after' in mutationOutcome
          ? mutationOutcome.after
          : after;

      const changes = buildChanges(effectiveBefore, effectiveAfter, allowedFields);

      // Write audit log inside the same transaction
      await AuditLog.create(
        [
          {
            at: new Date(),
            actorId,
            actorEmail,
            actorRole,
            action,
            targetType: targetType ? String(targetType) : null,
            targetId: targetId ? String(targetId) : null,
            summary: cleanSummary,
            changes,
          },
        ],
        { session }
      );

      await session.commitTransaction();

      // Return result cleanly
      return mutationOutcome && typeof mutationOutcome === 'object' && 'result' in mutationOutcome
        ? mutationOutcome.result
        : mutationOutcome;
    } catch (err) {
      await session.abortTransaction();
      console.error(`runAudited transaction failed for action "${action}":`, err.message);
      const genericError = new Error('Audited operation failed and was rolled back');
      genericError.statusCode = 500;
      throw genericError;
    } finally {
      await session.endSession();
    }
  }

  // --- Fallback Path (Standalone / No Transactions) ---
  let mutationOutcome;
  try {
    mutationOutcome = await mutationFn(null);
  } catch (mutationErr) {
    console.error(`runAudited fallback mutation failed for action "${action}":`, mutationErr.message);

    // Record failure record
    try {
      await AuditLog.create({
        at: new Date(),
        actorId,
        actorEmail,
        actorRole,
        action: `${action}.failed`,
        targetType: targetType ? String(targetType) : null,
        targetId: targetId ? String(targetId) : null,
        summary: `FAILED: ${cleanSummary}`.slice(0, 200),
        changes: [],
      });
    } catch (secErr) {
      console.error('Failed to write audit failure record:', secErr.message);
    }

    const genericError = new Error('Audited operation failed');
    genericError.statusCode = 500;
    throw genericError;
  }

  // Mutation succeeded -> write success audit entry
  const intendedChanges = buildChanges(before, after, allowedFields);
  await AuditLog.create({
    at: new Date(),
    actorId,
    actorEmail,
    actorRole,
    action,
    targetType: targetType ? String(targetType) : null,
    targetId: targetId ? String(targetId) : null,
    summary: cleanSummary,
    changes: intendedChanges,
  });

  return mutationOutcome && typeof mutationOutcome === 'object' && 'result' in mutationOutcome
    ? mutationOutcome.result
    : mutationOutcome;
}

/**
 * recordEvent(req, options)
 *
 * Appends a non-mutation audit event (no changes array).
 * Used for login, login_failed, access_denied, and informational administrative events.
 *
 * @param {express.Request} req
 * @param {Object} options
 * @param {string} options.action
 * @param {string} [options.targetType]
 * @param {string} [options.targetId]
 * @param {string} options.summary
 * @param {string} [options.actorId]
 * @param {string} [options.actorEmail]
 * @param {string} [options.actorRole]
 * @returns {Promise<AuditLog>}
 */
export async function recordEvent(
  req,
  { action, targetType = null, targetId = null, summary, actorId, actorEmail, actorRole }
) {
  const actor = {
    id: actorId || req?.admin?.id || req?.adminId || 'system',
    email: actorEmail || req?.admin?.email || 'system@travalastic.com',
    role: actorRole || req?.admin?.role || 'system',
  };

  const cleanSummary = String(summary || `${action} recorded`).slice(0, 200);

  return await AuditLog.create({
    at: new Date(),
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action,
    targetType: targetType ? String(targetType) : null,
    targetId: targetId ? String(targetId) : null,
    summary: cleanSummary,
    changes: [],
  });
}

