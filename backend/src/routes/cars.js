import express from 'express';

const router = express.Router();

/**
 * GET /cars/search
 * Query params: destination, pickupDate, dropoffDate
 * 
 * Constructs a Rentalcars.com / Booking.com affiliate search link using
 * the existing BOOKING_AFFILIATE_ID environment variable.
 * Returns { carsSearchUrl: <link> } — intentionally redirect-only from the start.
 */
router.get('/search', (req, res) => {
  try {
    const { destination, pickupDate, dropoffDate } = req.query;

    if (!destination || typeof destination !== 'string' || !destination.trim()) {
      return res.status(400).json({
        error: 'destination query parameter is required',
      });
    }

    const cleanDest = destination.trim();
    const cleanPickupDate = typeof pickupDate === 'string' ? pickupDate.trim() : '';
    const cleanDropoffDate = typeof dropoffDate === 'string' ? dropoffDate.trim() : '';

    const affiliateId = process.env.BOOKING_AFFILIATE_ID || '';

    const params = new URLSearchParams();
    if (affiliateId) {
      params.set('affiliateCode', affiliateId);
      params.set('aid', affiliateId);
    }
    params.set('locationName', cleanDest);
    params.set('dropLocationName', cleanDest);

    if (cleanPickupDate) {
      params.set('pickupDate', cleanPickupDate);
    }
    if (cleanDropoffDate) {
      params.set('dropoffDate', cleanDropoffDate);
    }

    const carsSearchUrl = `https://www.rentalcars.com/search-results?${params.toString()}`;

    return res.status(200).json({
      carsSearchUrl,
    });
  } catch (error) {
    console.error('Error generating cars search URL:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate cars search URL',
    });
  }
});

export default router;

