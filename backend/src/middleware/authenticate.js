import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * JWT Authentication Middleware
 * 
 * - Reads Authorization: Bearer <token> header
 * - Verifies the token using process.env.JWT_SECRET
 * - Checks that the user still exists in database (lean query selecting only _id)
 * - On success: attaches req.userId and calls next()
 * - On missing/invalid token or deleted user: returns 401 with a clear message
 */
export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || typeof authHeader !== 'string') {
    return res.status(401).json({
      error: 'Authorization header is required (format: Bearer <token>)',
    });
  }

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return res.status(401).json({
      error: 'Invalid authorization format. Format must be: Bearer <token>',
    });
  }

  const token = parts[1];
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.error('JWT_SECRET is not configured in environment variables');
    return res.status(500).json({
      error: 'Server authentication configuration error',
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, secret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Authentication token has expired. Please log in again.',
      });
    }
    return res.status(401).json({
      error: 'Invalid authentication token',
    });
  }

  try {
    const userId = decoded.userId || decoded.id || decoded._id;
    if (!userId) {
      return res.status(401).json({
        error: 'account no longer exists',
      });
    }

    const existingUser = await User.findById(userId).select('_id').lean();
    if (!existingUser) {
      return res.status(401).json({
        error: 'account no longer exists',
      });
    }

    req.userId = userId;
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({
      error: 'account no longer exists',
    });
  }
};

export default authenticate;

