const crypto = require('crypto');

/** Only logged-in admins get past this point; everyone else is redirected to the login page. */
function requireAuth(req, res, next) {
  if (req.session?.userId) return next();
  if (req.method === 'GET') req.session.returnTo = req.originalUrl;
  return res.redirect('/admin/login');
}

/** Per-session CSRF token (synchroniser-token pattern). */
function csrfToken(req, res, next) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  res.locals.csrfToken = req.session.csrf;
  next();
}

function verifyCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const sent = Buffer.from(String(req.body?._csrf || req.get('x-csrf-token') || ''));
  const expected = Buffer.from(req.session?.csrf || '');
  const ok = expected.length > 0 && sent.length === expected.length && crypto.timingSafeEqual(sent, expected);
  if (ok) return next();
  const err = new Error('Your session expired or the form was tampered with. Please reload the page and try again.');
  err.status = 403;
  return next(err);
}

/** One-shot flash messages stored in the session. */
function flash(req, res, next) {
  req.flash = (type, message) => {
    req.session.flash = { type, message };
  };
  res.locals.flash = req.session?.flash || null;
  if (req.session) delete req.session.flash;
  next();
}

module.exports = { requireAuth, csrfToken, verifyCsrf, flash };
