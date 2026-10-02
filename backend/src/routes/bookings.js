import express from 'express';
import authenticate from '../middleware/authenticate.js';
import Booking from '../models/Booking.js';

const router = express.Router();

/**
 * GET /bookings/mine
 * Auth-protected endpoint returning the requesting user's flight bookings,
 * sorted by date descending (most recent first).
 */
router.get('/mine', authenticate, async (req, res, next) => {
  try {
    const bookings = await Booking.find({ userId: req.userId }).sort({ createdAt: -1 });
    return res.status(200).json(bookings);
  } catch (error) {
    next(error);
  }
});

export default router;
export { router };
