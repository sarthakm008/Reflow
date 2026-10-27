import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signSessionToken(userId) {
  return jwt.sign({ sub: String(userId) }, env.jwtSecret, { expiresIn: '7d', issuer: 'reflow-api', audience: 'reflow-client' });
}

export function setSessionCookie(res, token) {
  res.cookie(env.cookieName, token, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(env.cookieName, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[env.cookieName];
  if (!token) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in to continue.' } });
  try {
    const payload = jwt.verify(token, env.jwtSecret, { issuer: 'reflow-api', audience: 'reflow-client' });
    req.userId = payload.sub;
    return next();
  } catch {
    clearSessionCookie(res);
    return res.status(401).json({ error: { code: 'INVALID_SESSION', message: 'Your session has expired. Please sign in again.' } });
  }
}
