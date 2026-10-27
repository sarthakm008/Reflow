import dotenv from 'dotenv';

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI || '',
  jwtSecret: process.env.JWT_SECRET || '',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  cookieName: process.env.COOKIE_NAME || 'reflow_session',
};

export function validateEnvironment({ requireDatabase = true } = {}) {
  const errors = [];
  if (requireDatabase && !env.mongoUri) errors.push('MONGODB_URI is required.');
  if (!env.jwtSecret || env.jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be set and contain at least 32 characters.');
  }
  const origins = env.clientOrigin.split(',').map((origin) => origin.trim()).filter(Boolean);
  if (!origins.length || origins.some((origin) => {
    try {
      const url = new URL(origin);
      return !['http:', 'https:'].includes(url.protocol)
        || (env.nodeEnv === 'production' && url.protocol !== 'https:');
    } catch {
      return true;
    }
  })) {
    errors.push('CLIENT_ORIGIN must contain valid origins (HTTPS in production).');
  }
  return errors;
}
