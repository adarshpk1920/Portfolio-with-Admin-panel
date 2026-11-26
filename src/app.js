const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const compression = require('compression');
const config = require('./config');
const { openDatabase } = require('./db');
const { createModels } = require('./models');
const SqliteStore = require('./middleware/session-store');
const { flash } = require('./middleware/security');
const { removeUpload, publicPath } = require('./middleware/upload');
const { formatDate } = require('./lib/util');

const PUBLIC_DIR = path.join(config.ROOT, 'public');
const assetVersions = new Map();
/**
 * Cache-busting URL for a static file: "/css/style.css" -> "/css/style.css?v=<content hash>".
 * Browsers may cache static files for 7 days; because the URL changes whenever the file's
 * content changes, visitors always get the CSS/JS that matches the HTML they were served.
 * Hashes are cached in production and recomputed in development (files change while editing).
 */
function asset(urlPath) {
  if (config.isProd && assetVersions.has(urlPath)) return assetVersions.get(urlPath);
  let url = urlPath;
  try {
    const file = path.join(PUBLIC_DIR, urlPath);
    if (file.startsWith(PUBLIC_DIR)) {
      const hash = crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 10);
      url = `${urlPath}?v=${hash}`;
    }
  } catch (e) {
    /* missing file: fall back to the plain URL */
  }
  assetVersions.set(urlPath, url);
  return url;
}

function createApp({ dbFile } = {}) {
  const db = openDatabase(dbFile);
  const models = createModels(db);
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(config.ROOT, 'views'));
  if (config.trustProxy) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          connectSrc: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: config.isProd ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(compression());
  app.use(express.static(path.join(config.ROOT, 'public'), { maxAge: config.isProd ? '7d' : 0 }));
  app.use('/uploads', express.static(config.UPLOAD_DIR, { maxAge: config.isProd ? '30d' : 0, fallthrough: true }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(express.json({ limit: '100kb' }));

  app.use(
    session({
      name: 'pf.sid',
      secret: config.sessionSecret,
      store: new SqliteStore(db),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: { httpOnly: true, sameSite: 'lax', secure: config.isProd, maxAge: 1000 * 60 * 60 * 8 },
    })
  );
  app.use(flash);

  app.use((req, res, next) => {
    res.locals.site = models.settings.all();
    res.locals.currentPath = req.path;
    res.locals.formatDate = formatDate;
    res.locals.asset = asset;
    res.locals.year = new Date().getFullYear();
    next();
  });

  app.locals.models = models;
  app.locals.db = db;

  app.get('/health', (req, res) => res.json({ ok: true }));
  app.use('/', require('./routes/public')(models));
  app.use('/admin', require('./routes/admin')(models));

  app.use((req, res) => res.status(404).render('error', { title: 'Page not found', status: 404, message: "The page you're looking for doesn't exist or has been moved." }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // Never leave orphaned uploads behind when a request fails.
    const files = [req.file, ...(Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat())].filter(Boolean);
    files.forEach((f) => removeUpload(publicPath(f)));

    let status = err.status || 500;
    let message = err.message;
    if (err.code === 'LIMIT_FILE_SIZE') {
      status = 400;
      message = `Each image must be smaller than ${config.maxUploadMb} MB.`;
    } else if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      status = 400;
      message = 'Too many files were uploaded at once (max 12 gallery images).';
    }
    if (status >= 500) {
      console.error(err);
      message = 'Something went wrong on our side. Please try again.';
    }

    // Form errors in the admin bounce back to the form with a message instead of a dead-end page.
    if (status === 400 && req.session && req.originalUrl.startsWith('/admin') && req.method === 'POST') {
      req.flash('error', message);
      return res.redirect(req.get('referer') || '/admin');
    }
    if (req.accepts(['html', 'json']) === 'json') return res.status(status).json({ ok: false, error: message });
    res.status(status).render('error', { title: status === 403 ? 'Request blocked' : 'Error', status, message });
  });

  return app;
}

module.exports = { createApp };
