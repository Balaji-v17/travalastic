import express from 'express';
import duffel from '../services/duffelClient.js';

const router = express.Router();

/**
 * POST /flights/search
 * Body: { origin, destination, departureDate, passengers }
 * Validates 3-letter IATA codes and future date.
 * Creates an offer request via Duffel and returns trimmed flight offers.
 */
router.post('/search', async (req, res, next) => {
  try {
    const { origin, destination, departureDate, passengers } = req.body || {};

    // Validate origin
    const iataRegex = /^[A-Za-z]{3}$/;
    if (!origin || typeof origin !== 'string' || !iataRegex.test(origin.trim())) {
      return res.status(400).json({
        error: 'origin must be a valid 3-letter IATA airport code (e.g. LHR, JFK)',
      });
    }

    // Validate destination
    if (!destination || typeof destination !== 'string' || !iataRegex.test(destination.trim())) {
      return res.status(400).json({
        error: 'destination must be a valid 3-letter IATA airport code (e.g. LHR, JFK)',
      });
    }

    const originCode = origin.trim().toUpperCase();
    const destCode = destination.trim().toUpperCase();

    if (originCode === destCode) {
      return res.status(400).json({
        error: 'origin and destination cannot be the same airport',
      });
    }

    // Validate departureDate (must be future date in YYYY-MM-DD format)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!departureDate || typeof departureDate !== 'string' || !dateRegex.test(departureDate.trim())) {
      return res.status(400).json({
        error: 'departureDate is required and must be in YYYY-MM-DD format',
      });
    }

    const depDate = new Date(departureDate.trim());
    if (isNaN(depDate.getTime())) {
      return res.status(400).json({
        error: 'departureDate must be a valid date',
      });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    if (departureDate.trim() <= todayStr) {
      return res.status(400).json({
        error: 'departureDate must be a future date',
      });
    }

    // Validate passengers (count of adults)
    let adultCount = 1;
    if (passengers != null) {
      const parsed = parseInt(passengers, 10);
      if (isNaN(parsed) || parsed < 1) {
        return res.status(400).json({
          error: 'passengers must be a positive integer',
        });
      }
      adultCount = parsed;
    }

    // Check if DUFFEL_API_KEY is configured
    if (!process.env.DUFFEL_API_KEY) {
      return res.status(500).json({
        error: 'DUFFEL_API_KEY is not configured in environment variables',
      });
    }

    // Create offer request via Duffel
    const offerRequestResponse = await duffel.offerRequests.create({
      slices: [
        {
          origin: originCode,
          destination: destCode,
          departure_date: departureDate.trim(),
        },
      ],
      passengers: Array.from({ length: adultCount }, () => ({ type: 'adult' })),
      return_offers: true,
    });

    let offers = offerRequestResponse?.data?.offers;

    // Fallback fetch if offers array was not embedded
    if (!Array.isArray(offers) || offers.length === 0) {
      try {
        const listResponse = await duffel.offers.list({
          offer_request_id: offerRequestResponse.data.id,
          limit: 50,
        });
        offers = listResponse?.data || [];
      } catch {
        offers = [];
      }
    }

    // Trim output: offerId, airline name, price (amount + currency), departure time, arrival time, duration
    const trimmedOffers = (Array.isArray(offers) ? offers : []).map((offer) => {
      const firstSlice = offer.slices?.[0];
      const segments = firstSlice?.segments || [];
      const firstSegment = segments[0];
      const lastSegment = segments[segments.length - 1] || firstSegment;
      const airlineName =
        offer.owner?.name ||
        firstSegment?.operating_carrier?.name ||
        firstSegment?.marketing_carrier?.name ||
        'Unknown Airline';

      return {
        offerId: offer.id,
        airline: airlineName,
        airlineName,
        price: {
          amount: offer.total_amount,
          currency: offer.total_currency,
        },
        departureTime: firstSegment?.departing_at || firstSlice?.departure_date || null,
        arrivalTime: lastSegment?.arriving_at || null,
        duration: firstSlice?.duration || null,
      };
    });

    return res.status(200).json(trimmedOffers);
  } catch (error) {
    console.error('Duffel flight search error:', error);
    const errorMessage =
      error?.errors?.[0]?.message ||
      error?.message ||
      'Failed to search flights with Duffel';
    return res.status(error.status || 502).json({ error: errorMessage });
  }
});

/**
 * Helper to check offer validity and freshness against Duffel.
 * Reused by GET /offers/:offerId and POST /book.
 * @param {string} offerId 
 * @returns {Promise<{ isValid: boolean, offer?: Object, offerId?: string, message?: string, status?: number, error?: string }>}
 */
export const checkOfferFreshness = async (offerId) => {
  if (!offerId || typeof offerId !== 'string' || !offerId.trim()) {
    return {
      isValid: false,
      status: 400,
      message: 'offerId parameter is required',
    };
  }

  const cleanOfferId = offerId.trim();

  // Check if DUFFEL_API_KEY is configured
  if (!process.env.DUFFEL_API_KEY) {
    return {
      isValid: false,
      status: 500,
      message: 'DUFFEL_API_KEY is not configured in environment variables',
    };
  }

  try {
    const response = await duffel.offers.get(cleanOfferId);
    const offer = response?.data;

    if (!offer || !offer.id) {
      return {
        isValid: false,
        offerId: cleanOfferId,
        message: 'Offer not found. Please re-search for current flights rather than attempting a booking.',
      };
    }

    // Check expiration against current time
    const expiresAt = offer.expires_at ? new Date(offer.expires_at) : null;
    const now = new Date();

    if (!expiresAt || isNaN(expiresAt.getTime()) || expiresAt <= now) {
      return {
        isValid: false,
        offerId: cleanOfferId,
        expiresAt: offer.expires_at || null,
        message: 'This offer has expired. Please re-search for fresh flight offers rather than attempting a booking.',
      };
    }

    return {
      isValid: true,
      offerId: cleanOfferId,
      offer,
    };
  } catch (error) {
    const status = error.status || error?.meta?.status;
    const errorCode = error?.errors?.[0]?.code;
    const errorMsg = error?.errors?.[0]?.message || error.message || '';

    // If Duffel returns an error indicating the offer is no longer bookable, expired, or not found:
    if (
      status === 404 ||
      status === 410 ||
      status === 422 ||
      errorCode === 'offer_no_longer_available' ||
      errorCode === 'not_found' ||
      errorMsg.toLowerCase().includes('no longer available') ||
      errorMsg.toLowerCase().includes('expired')
    ) {
      return {
        isValid: false,
        offerId: cleanOfferId,
        message: 'This offer is no longer bookable. Please re-search for current flights rather than attempting a booking.',
      };
    }

    // For other unexpected system/network errors:
    return {
      isValid: false,
      status: status || 502,
      error: errorMsg || 'Failed to verify offer freshness with Duffel',
    };
  }
};

/**
 * GET /flights/offers/:offerId
 * Checks freshness and validity of an existing Duffel offer before booking.
 * Returns trimmed offer details with isValid: true if still valid,
 * or isValid: false with a re-search recommendation if expired or unavailable.
 */
router.get('/offers/:offerId', async (req, res, next) => {
  try {
    const { offerId } = req.params;
    const result = await checkOfferFreshness(offerId);

    if (result.status === 400) {
      return res.status(400).json({ error: result.message });
    }

    if (result.status === 500) {
      return res.status(500).json({ error: result.message });
    }

    if (result.status && result.status >= 400 && result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    if (!result.isValid) {
      return res.status(200).json({
        isValid: false,
        offerId: result.offerId || offerId,
        message: result.message,
      });
    }

    const offer = result.offer;
    const firstSlice = offer.slices?.[0];
    const segments = firstSlice?.segments || [];
    const firstSegment = segments[0];
    const lastSegment = segments[segments.length - 1] || firstSegment;
    const airlineName =
      offer.owner?.name ||
      firstSegment?.operating_carrier?.name ||
      firstSegment?.marketing_carrier?.name ||
      'Unknown Airline';

    return res.status(200).json({
      isValid: true,
      offerId: offer.id,
      airline: airlineName,
      airlineName,
      price: {
        amount: offer.total_amount,
        currency: offer.total_currency,
      },
      departureTime: firstSegment?.departing_at || firstSlice?.departure_date || null,
      arrivalTime: lastSegment?.arriving_at || null,
      duration: firstSlice?.duration || null,
      expiresAt: offer.expires_at,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /flights/book
 * Body: { offerId, passengers: [{ givenName, familyName, dateOfBirth, gender, title }] }
 * Re-checks offer freshness and validity before booking.
 * If expired/unavailable, returns 409 requesting re-search.
 * Otherwise creates the order with Duffel and returns trimmed booking confirmation.
 */
router.post('/book', async (req, res, next) => {
  try {
    const { offerId, passengers } = req.body || {};

  if (!offerId || typeof offerId !== 'string' || !offerId.trim()) {
    return res.status(400).json({ error: 'offerId is required in request body' });
  }

  if (!Array.isArray(passengers) || passengers.length === 0) {
    return res.status(400).json({ error: 'passengers must be a non-empty array of travelers' });
  }

  // Validate passenger fields
  for (let i = 0; i < passengers.length; i++) {
    const p = passengers[i];
    if (!p || typeof p !== 'object') {
      return res.status(400).json({
        error: `Passenger at index ${i} must be an object with givenName, familyName, dateOfBirth`,
      });
    }
    if (!p.givenName || typeof p.givenName !== 'string' || !p.givenName.trim()) {
      return res.status(400).json({
        error: `Passenger at index ${i} is missing required givenName`,
      });
    }
    if (!p.familyName || typeof p.familyName !== 'string' || !p.familyName.trim()) {
      return res.status(400).json({
        error: `Passenger at index ${i} is missing required familyName`,
      });
    }
    if (!p.dateOfBirth || typeof p.dateOfBirth !== 'string' || !p.dateOfBirth.trim()) {
      return res.status(400).json({
        error: `Passenger at index ${i} is missing required dateOfBirth (YYYY-MM-DD)`,
      });
    }
  }

  // Re-check offer freshness and validity using the shared helper
  const freshness = await checkOfferFreshness(offerId);

  if (freshness.status === 500) {
    return res.status(500).json({ error: freshness.message });
  }

  if (freshness.status && freshness.status >= 400 && freshness.error) {
    return res.status(502).json({ error: freshness.error });
  }

  // If expired or no longer bookable, return 409 asking client to re-search
  if (!freshness.isValid) {
    return res.status(409).json({
      error: freshness.message || 'This offer has expired or is no longer bookable. Please re-search for current flights rather than attempting a booking.',
      offerId,
      reSearchRequired: true,
    });
  }

  const offer = freshness.offer;
  const offerPassengers = offer.passengers || [];

  try {
    // Format passengers conforming to official @duffel/api CreateOrder schema
    const formattedPassengers = passengers.map((p, idx) => {
      const offerPassengerId = offerPassengers[idx]?.id || offerPassengers[0]?.id;
      const normalizedGender = (p.gender || 'm').toLowerCase().startsWith('f') ? 'f' : 'm';
      const normalizedTitle = (p.title || (normalizedGender === 'f' ? 'ms' : 'mr')).toLowerCase();

      return {
        id: offerPassengerId,
        given_name: p.givenName.trim(),
        family_name: p.familyName.trim(),
        born_on: p.dateOfBirth.trim(),
        gender: normalizedGender,
        title: normalizedTitle,
        email: p.email || 'traveler@travalastic.com',
        phone_number: p.phoneNumber || p.phone_number || '+12025550199',
      };
    });

    // Create order using official @duffel/api SDK payment payload shape
    const orderResponse = await duffel.orders.create({
      selected_offers: [offer.id],
      passengers: formattedPassengers,
      payments: [
        {
          type: 'balance',
          amount: offer.total_amount,
          currency: offer.total_currency,
        },
      ],
      type: 'instant',
    });

    const order = orderResponse?.data;

    if (!order) {
      return res.status(502).json({ error: 'Duffel order creation returned an empty response' });
    }

    const passengerNames = (order.passengers || []).map(
      (p) => `${p.given_name} ${p.family_name}`.trim()
    );

    return res.status(200).json({
      bookingReference: order.booking_reference,
      orderId: order.id,
      totalAmount: order.total_amount,
      currency: order.total_currency,
      passengerNames,
      status: 'confirmed',
    });
  } catch (error) {
    console.error('Duffel order creation error:', error);
    const errorMessage =
      error?.errors?.[0]?.message ||
      error?.message ||
      'Failed to create flight booking order with Duffel';
    return res.status(502).json({ error: errorMessage });
  }
  } catch (outerError) {
    next(outerError);
  }
});

export default router;


