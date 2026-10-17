import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import User from '../models/User.js';
import Itinerary from '../models/Itinerary.js';
import Conversation from '../models/Conversation.js';
import Expense from '../models/Expense.js';
import Booking from '../models/Booking.js';
import authenticate from '../middleware/authenticate.js';
import { deleteUserAndData } from '../services/accountDeletion.js';

const router = express.Router();

// Helper to sign JWT with 7-day expiration
const generateToken = (user) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.sign(
    { userId: user._id, email: user.email },
    secret,
    { expiresIn: '7d' }
  );
};

// Helper to format safe user output (never returns passwordHash)
const formatUser = (user) => ({
  id: user._id,
  _id: user._id,
  email: user.email,
  name: user.name || '',
  createdAt: user.createdAt,
});

// POST /auth/signup
const handleSignup = async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password || typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password.trim()) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const user = await User.create({
      email: normalizedEmail,
      passwordHash,
    });

    const token = generateToken(user);

    return res.status(201).json({
      token,
      user: formatUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    console.error('Signup error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /auth/login
const handleLogin = async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password || typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password.trim()) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);

    return res.status(200).json({
      token,
      user: formatUser(user),
    });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /auth/me
const handleGetMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.status(200).json({ user: formatUser(user) });
  } catch (error) {
    console.error('Get profile error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// PATCH /auth/me
const handlePatchMe = async (req, res) => {
  const { name } = req.body || {};

  try {
    const updates = {};
    if (typeof name === 'string') {
      updates.name = name.trim();
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({
      user: formatUser(user),
      message: 'Profile updated successfully',
    });
  } catch (error) {
    console.error('Update profile error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Rate limiter: about 5 attempts per 15 minutes per user id
const deleteAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => (req.userId ? req.userId.toString() : 'anonymous'),
  validate: { keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: { error: 'Too many account deletion attempts, please try again after 15 minutes' },
});

// DELETE /auth/me
const handleDeleteMe = async (req, res) => {
  const { password } = req.body || {};

  if (!password || typeof password !== 'string' || !password.trim()) {
    return res.status(400).json({ error: 'Password is required' });
  }

  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({ error: 'account no longer exists' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const targetUserId = user._id;

    // Delete all user-linked documents across collections, children first, User document last
    await deleteUserAndData(targetUserId);

    // Log only that a deletion happened (internal user id, no email, no password)
    console.log(`User account deleted: ${targetUserId}`);

    return res.status(200).json({ deleted: true });
  } catch (error) {
    console.error('Delete account error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

router.post('/signup', handleSignup);
router.post('/auth/signup', handleSignup);

router.post('/login', handleLogin);
router.post('/auth/login', handleLogin);

router.get('/me', authenticate, handleGetMe);
router.get('/auth/me', authenticate, handleGetMe);

router.patch('/me', authenticate, handlePatchMe);
router.patch('/auth/me', authenticate, handlePatchMe);

router.delete('/me', authenticate, deleteAccountLimiter, handleDeleteMe);
router.delete('/auth/me', authenticate, deleteAccountLimiter, handleDeleteMe);

export default router;
