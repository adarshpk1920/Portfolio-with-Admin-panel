const path = require('path');
const crypto = require('crypto');

require('dotenv').config({ quiet: true });

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.SESSION_SECRET) {
  console.warn('[config] SESSION_SECRET is not set: using a random secret (sessions reset on restart).');
}

module.exports = {
  ROOT,
  DATA_DIR,
  UPLOAD_DIR: path.join(DATA_DIR, 'uploads'),
  DB_FILE: process.env.DB_FILE || path.join(DATA_DIR, 'portfolio.db'),
  PORT: Number(process.env.PORT) || 3000,
  isProd,
  sessionSecret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  admin: {
    email: (process.env.ADMIN_EMAIL || 'admin@portfolio.dev').toLowerCase(),
    password: process.env.ADMIN_PASSWORD || 'Admin@12345',
    name: process.env.ADMIN_NAME || 'Site Admin',
  },
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB) || 5,
  trustProxy: process.env.TRUST_PROXY === '1' || isProd,
};
