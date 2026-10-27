import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { asyncHandler } from '../middleware/errors.js';
import { clearSessionCookie, setSessionCookie, signSessionToken } from '../middleware/auth.js';

const publicUser = (user) => ({ id: String(user._id), name: user.name, email: user.email, preferences: user.preferences || {} });
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const register = asyncHandler(async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (name.length < 1 || name.length > 80) return res.status(400).json({ error: { code: 'INVALID_NAME', message: 'Name must be between 1 and 80 characters.' } });
  if (!emailPattern.test(email) || email.length > 254) return res.status(400).json({ error: { code: 'INVALID_EMAIL', message: 'Enter a valid email address.' } });
  if (password.length < 8 || password.length > 128) return res.status(400).json({ error: { code: 'INVALID_PASSWORD', message: 'Password must be between 8 and 128 characters.' } });
  const existing = await User.findOne({ email }).lean();
  if (existing) return res.status(409).json({ error: { code: 'EMAIL_IN_USE', message: 'An account with this email already exists.' } });
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash });
  setSessionCookie(res, signSessionToken(user._id));
  return res.status(201).json({ user: publicUser(user) });
});

export const login = asyncHandler(async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email || !password) return res.status(400).json({ error: { code: 'MISSING_CREDENTIALS', message: 'Email and password are required.' } });
  const user = await User.findOne({ email }).select('+passwordHash');
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!valid) return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' } });
  setSessionCookie(res, signSessionToken(user._id));
  return res.json({ user: publicUser(user) });
});

export const logout = (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
};

export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId).lean();
  if (!user) return res.status(401).json({ error: { code: 'ACCOUNT_NOT_FOUND', message: 'This account no longer exists. Please sign in again.' } });
  return res.json({ user: { id: String(user._id), name: user.name, email: user.email, preferences: user.preferences || {} } });
});
