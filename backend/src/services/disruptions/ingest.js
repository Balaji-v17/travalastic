import Disruption from '../../models/Disruption.js';
import Booking from '../../models/Booking.js';
import Itinerary from '../../models/Itinerary.js';
import { duffel } from '../duffelClient.js';
import {
  computeFlightDelay,
  classifyDisruption,
  buildDedupeKey,
} from './analysis.js';

/**
 * Shared ingestion engine for flight disruptions.
 * Used by both live Duffel webhooks and the disruption simulator.
 *
 * @param {Object} params
 * @param {string|import('mongoose').Types.ObjectId} params.userId
 * @param {string|import('mongoose').Types.ObjectId} params.itineraryId
 * @param {string|import('mongoose').Types.ObjectId} [params.bookingId]
 * @param {Array<Object>} params.oldSegments
 * @param {Array<Object>} params.newSegments
 * @param {'duffel_webhook'|'simulation'} params.source
 * @param {string} params.dedupeKey
 * @returns {Promise<{ success?: boolean, disruption?: Object, duplicate?: boolean, skipped?: string, reason?: string }>}
 */
export async function ingestScheduleChange({
  userId,
  itineraryId,
  bookingId = null,
  oldSegments,
  newSegments,
  source,
  dedupeKey,
}) {
  // 1. Fetch itinerary for contextual classification
  const itinerary = await Itinerary.findById(itineraryId);
  if (!itinerary) {
    return { skipped: 'itinerary_not_found' };
  }

  // 2. Compute delay & structural changes
  const delayInfo = computeFlightDelay(oldSegments, newSegments);

  const oldDeparture = oldSegments?.[0]?.departing_at || null;
  const newDeparture = newSegments?.[0]?.departing_at || null;
  const oldArrival = oldSegments?.[oldSegments.length - 1]?.arriving_at || null;
  const newArrival = newSegments?.[newSegments.length - 1]?.arriving_at || null;

  // 3. Classify disruption
  const classification = classifyDisruption(itinerary, delayInfo, newArrival);

  // 4. Check actionability: non-actionable changes (e.g. delay under 15 min) are not stored
  if (!classification.actionable) {
    console.log(`[Disruptions] Skipped non-actionable change: ${classification.reason}`);
    return { skipped: 'not_actionable', reason: classification.reason };
  }

  // 5. Build disruption document
  const disruptionData = {
    userId,
    itineraryId,
    bookingId: bookingId || null,
    type: 'flight_schedule_change',
    source,
    dedupeKey,
    details: {
      oldDeparture,
      newDeparture,
      oldArrival,
      newArrival,
      delayMinutes: delayInfo.delayMinutes,
      structural: Boolean(delayInfo.structural),
    },
    status: 'new',
    proposal: {
      ...classification,
    },
    detectedAt: new Date(),
  };

  // 6. Insert with duplicate-key protection
  try {
    const disruption = await Disruption.create(disruptionData);
    return { success: true, disruption };
  } catch (err) {
    // Unique compound index on { userId, dedupeKey }
    if (err.code === 11000 || (err.name === 'MongoServerError' && err.code === 11000)) {
      return { duplicate: true };
    }
    throw err;
  }
}

/**
 * Ingests a verified Duffel order.airline_initiated_change_detected webhook event.
 *
 * @param {Object} event - Verified Duffel event object
 * @returns {Promise<{ success?: boolean, disruption?: Object, duplicate?: boolean, skipped?: string, reason?: string }>}
 */
export async function handleDuffelEvent(event) {
  // 1. Extract Duffel order id from real payload
  const data = event?.data;
  let orderId = null;

  if (typeof data?.object === 'string' && data.object.startsWith('ord_')) {
    orderId = data.object;
  } else if (data?.object && typeof data.object.id === 'string' && data.object.id.startsWith('ord_')) {
    orderId = data.object.id;
  } else if (typeof data?.id === 'string' && data.id.startsWith('ord_')) {
    orderId = data.id;
  } else if (typeof data?.order_id === 'string' && data.order_id.startsWith('ord_')) {
    orderId = data.order_id;
  }

  // If shape doesn't match, log keys only (not values) and return skipped
  if (!orderId) {
    console.warn(
      '[Duffel Webhook] Unrecognized payload keys:',
      Object.keys(event || {}),
      data ? Object.keys(data) : []
    );
    return { skipped: 'unrecognized_payload' };
  }

  // 2. Find matching booking by orderId
  const booking = await Booking.findOne({ orderId });
  if (!booking) {
    return { skipped: 'no_booking' };
  }

  if (!booking.itineraryId) {
    return { skipped: 'no_itinerary' };
  }

  // 3. Fetch airline-initiated changes from Duffel API
  // Duffel fetch failure throws and will trigger a 500 response in route, allowing safe retry
  const changesRes = await duffel.airlineInitiatedChanges.list(orderId);
  const changes = changesRes?.data || [];

  // 4. Match the specific change by event's idempotency_key
  const change = changes.find((c) => c.id === event.idempotency_key);
  if (!change) {
    return { skipped: 'change_not_found' };
  }

  // 5. Flatten removed and added slices to segments
  const oldSegments = (change.removed || []).flatMap((slice) =>
    slice.segments || (slice.departing_at ? [slice] : [])
  );
  const newSegments = (change.added || []).flatMap((slice) =>
    slice.segments || (slice.departing_at ? [slice] : [])
  );

  // 6. Build deterministic deduplication key
  const dedupeKey = buildDedupeKey(orderId, change.id);

  // 7. Process ingestion via shared engine
  return await ingestScheduleChange({
    userId: booking.userId,
    itineraryId: booking.itineraryId,
    bookingId: booking._id,
    oldSegments,
    newSegments,
    source: 'duffel_webhook',
    dedupeKey,
  });
}

export default {
  ingestScheduleChange,
  handleDuffelEvent,
};

