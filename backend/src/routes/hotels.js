import express from 'express';
import CuratedHotel from '../models/CuratedHotel.js';

const router = express.Router();

/**
 * GET /hotels/search
 * Query params: destination, budgetTier, checkinDate, checkoutDate
 * 
 * 1. Queries the existing CuratedHotel model by destination + budgetTier, returning matching entries as-is.
 * 2. Separately constructs a Booking.com search link:
 *    https://www.booking.com/searchresults.html?aid=<BOOKING_AFFILIATE_ID>&ss=<destination>&checkin=<checkinDate>&checkout=<checkoutDate>
 * 
 * Returns bookingComSearchUrl alongside the curated results as a single field.
 */
export const MAX_HOTEL_GUESTS = 9;
export const MAX_HOTEL_ROOMS = 5;

router.get('/search', async (req, res, next) => {
  try {
    const { destination, budgetTier, checkinDate, checkoutDate, guests, rooms } = req.query;

    if (!destination || typeof destination !== 'string' || !destination.trim()) {
      return res.status(400).json({
        error: 'destination query parameter is required',
      });
    }

    let parsedGuests = null;
    if (guests != null && guests !== '') {
      const g = Number(guests);
      if (!Number.isInteger(g) || g < 1 || g > MAX_HOTEL_GUESTS) {
        return res.status(400).json({
          error: `guests must be an integer between 1 and ${MAX_HOTEL_GUESTS}`,
        });
      }
      parsedGuests = g;
    }

    let parsedRooms = null;
    if (rooms != null && rooms !== '') {
      const r = Number(rooms);
      if (!Number.isInteger(r) || r < 1 || r > MAX_HOTEL_ROOMS) {
        return res.status(400).json({
          error: `rooms must be an integer between 1 and ${MAX_HOTEL_ROOMS}`,
        });
      }
      if (parsedGuests !== null && r > parsedGuests) {
        return res.status(400).json({
          error: 'rooms cannot exceed guests',
        });
      }
      parsedRooms = r;
    }

    const cleanDest = destination.trim();
    const cleanBudgetTier = typeof budgetTier === 'string' ? budgetTier.trim().toLowerCase() : '';
    const cleanCheckin = typeof checkinDate === 'string' ? checkinDate.trim() : '';
    const cleanCheckout = typeof checkoutDate === 'string' ? checkoutDate.trim() : '';

    // Build filter for CuratedHotel: case-insensitive destination match and public visibility
    const filter = {
      destination: new RegExp(`^${cleanDest}$`, 'i'),
      hidden: { $ne: true },
    };

    if (cleanBudgetTier) {
      filter.budgetTier = cleanBudgetTier;
    }

    // Query curated hotels from MongoDB
    const curatedHotels = await CuratedHotel.find(filter).lean();

    // Construct Booking.com affiliate search URL
    const affiliateId = process.env.BOOKING_AFFILIATE_ID || '';
    const guestParam = parsedGuests !== null ? `&group_adults=${parsedGuests}` : '';
    const roomParam = parsedRooms !== null ? `&no_rooms=${parsedRooms}` : '';
    const bookingComSearchUrl = `https://www.booking.com/searchresults.html?aid=${encodeURIComponent(
      affiliateId
    )}&ss=${encodeURIComponent(cleanDest)}&checkin=${encodeURIComponent(
      cleanCheckin
    )}&checkout=${encodeURIComponent(cleanCheckout)}${guestParam}${roomParam}`;

    return res.status(200).json({
      curatedHotels: curatedHotels || [],
      hotels: curatedHotels || [],
      bookingComSearchUrl,
    });
  } catch (error) {
    console.error('Error searching curated hotels:', error);
    return res.status(500).json({
      error: error.message || 'Failed to search curated hotels',
    });
  }
});

export default router;

