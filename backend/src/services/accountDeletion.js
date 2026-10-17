import User from '../models/User.js';
import Itinerary from '../models/Itinerary.js';
import Conversation from '../models/Conversation.js';
import Expense from '../models/Expense.js';
import Booking from '../models/Booking.js';
import PackingTemplate from '../models/PackingTemplate.js';

/**
 * Counts user-linked documents across all collections without deleting anything.
 * Used for dry runs and data audits.
 *
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @returns {Promise<{ itineraries: number, conversations: number, expenses: number, bookings: number, packingTemplates: number, users: number }>}
 */
export async function countUserData(userId) {
  const [itineraries, conversations, expenses, bookings, packingTemplates, users] = await Promise.all([
    Itinerary.countDocuments({ userId }),
    Conversation.countDocuments({ userId }),
    Expense.countDocuments({ userId }),
    Booking.countDocuments({ userId }),
    PackingTemplate.countDocuments({ userId }),
    User.countDocuments({ _id: userId }),
  ]);

  return {
    itineraries,
    conversations,
    expenses,
    bookings,
    packingTemplates,
    users,
  };
}

/**
 * Permanently deletes all user-linked documents across all collections.
 * Deletion order: children first (itineraries, conversations, expenses, bookings, packingTemplates),
 * User document last so a failure partway leaves the account intact for retries.
 * Every query is strictly scoped to the target userId.
 *
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @returns {Promise<{ itineraries: number, conversations: number, expenses: number, bookings: number, packingTemplates: number, users: number }>}
 */
export async function deleteUserAndData(userId) {
  const itinerariesRes = await Itinerary.deleteMany({ userId });
  const conversationsRes = await Conversation.deleteMany({ userId });
  const expensesRes = await Expense.deleteMany({ userId });
  const bookingsRes = await Booking.deleteMany({ userId });
  const packingTemplatesRes = await PackingTemplate.deleteMany({ userId });
  const usersRes = await User.deleteOne({ _id: userId });

  return {
    itineraries: itinerariesRes.deletedCount || 0,
    conversations: conversationsRes.deletedCount || 0,
    expenses: expensesRes.deletedCount || 0,
    bookings: bookingsRes.deletedCount || 0,
    packingTemplates: packingTemplatesRes.deletedCount || 0,
    users: usersRes.deletedCount || 0,
  };
}

export default {
  countUserData,
  deleteUserAndData,
};

