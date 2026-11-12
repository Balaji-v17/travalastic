import User from '../models/User.js';
import Itinerary from '../models/Itinerary.js';
import Conversation from '../models/Conversation.js';
import Expense from '../models/Expense.js';
import Booking from '../models/Booking.js';
import PackingTemplate from '../models/PackingTemplate.js';
import Disruption from '../models/Disruption.js';

/**
 * Counts user-linked documents across all collections without deleting anything.
 * Used for dry runs and data audits.
 *
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @returns {Promise<{ itineraries: number, conversations: number, expenses: number, bookings: number, packingTemplates: number, disruptions: number, users: number }>}
 */
export async function countUserData(userId) {
  const [itineraries, conversations, expenses, bookings, packingTemplates, disruptions, users] = await Promise.all([
    Itinerary.countDocuments({ userId }),
    Conversation.countDocuments({ userId }),
    Expense.countDocuments({ userId }),
    Booking.countDocuments({ userId }),
    PackingTemplate.countDocuments({ userId }),
    Disruption.countDocuments({ userId }),
    User.countDocuments({ _id: userId }),
  ]);

  return {
    itineraries,
    conversations,
    expenses,
    bookings,
    packingTemplates,
    disruptions,
    users,
  };
}

/**
 * Permanently deletes all user-linked documents across all collections,
 * or returns document counts when options.dryRun is true.
 * Deletion order: children first (itineraries, conversations, expenses, bookings, packingTemplates, disruptions),
 * User document last so a failure partway leaves the account intact for retries.
 * Every query is strictly scoped to the target userId.
 *
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {Object} [options]
 * @param {boolean} [options.dryRun=false]
 * @param {import('mongoose').ClientSession} [options.session]
 * @returns {Promise<{ itineraries: number, conversations: number, expenses: number, bookings: number, packingTemplates: number, disruptions: number, users: number }>}
 */
export async function deleteUserAndData(userId, options = {}) {
  if (options && options.dryRun === true) {
    return await countUserData(userId);
  }

  const session = options?.session;
  const sessionOpt = session ? { session } : {};

  const itinerariesRes = await Itinerary.deleteMany({ userId }, sessionOpt);
  const conversationsRes = await Conversation.deleteMany({ userId }, sessionOpt);
  const expensesRes = await Expense.deleteMany({ userId }, sessionOpt);
  const bookingsRes = await Booking.deleteMany({ userId }, sessionOpt);
  const packingTemplatesRes = await PackingTemplate.deleteMany({ userId }, sessionOpt);
  const disruptionsRes = await Disruption.deleteMany({ userId }, sessionOpt);
  const usersRes = await User.deleteOne({ _id: userId }, sessionOpt);

  return {
    itineraries: itinerariesRes.deletedCount || 0,
    conversations: conversationsRes.deletedCount || 0,
    expenses: expensesRes.deletedCount || 0,
    bookings: bookingsRes.deletedCount || 0,
    packingTemplates: packingTemplatesRes.deletedCount || 0,
    disruptions: disruptionsRes.deletedCount || 0,
    users: usersRes.deletedCount || 0,
  };
}

export default {
  countUserData,
  deleteUserAndData,
};

