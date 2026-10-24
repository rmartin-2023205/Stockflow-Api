import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const COOKIE_NAME = 'stockflow_token';

export function generateToken(payload) {
  return jwt.sign(payload, env.SESSION_SECRET, {
    expiresIn: '7d',
  });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, env.SESSION_SECRET);
  } catch (error) {
    return null;
  }
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  });
}

export { COOKIE_NAME };
