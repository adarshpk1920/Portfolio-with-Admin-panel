const express = require('express');
const rateLimit = require('express-rate-limit');
const { splitList } = require('../lib/util');
const renderProject = require('../lib/render-project');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

module.exports = function publicRoutes(models) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const projects = models.projects.published().map((p) => ({ ...p, techList: splitList(p.tech) }));
    res.render('index', {
      title: null,
      projects,
      // Every category is shown as a filter, even before it has published projects.
      categories: models.categories.all(),
      sent: req.query.sent === '1',
    });
  });

  router.get('/projects/:slug', (req, res, next) => {
    const project = models.projects.findPublishedBySlug(req.params.slug);
    if (!project) return next();
    renderProject(models, res, project);
  });

  const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => respond(req, res, 429, 'Too many messages sent. Please try again later.'),
  });

  function respond(req, res, status, error) {
    const wantsJson = req.get('accept')?.includes('application/json');
    if (wantsJson) return res.status(status).json(status < 300 ? { ok: true } : { ok: false, error });
    if (status < 300) return res.redirect('/?sent=1#contact');
    return res.status(status).render('error', { title: 'Message not sent', status, message: error });
  }

  router.post('/contact', contactLimiter, (req, res) => {
    const name = String(req.body.name || '').trim().slice(0, 120);
    const email = String(req.body.email || '').trim().slice(0, 200);
    const subject = String(req.body.subject || '').trim().slice(0, 200);
    const body = String(req.body.message || '').trim().slice(0, 5000);

    // Anti-bot timing check: bots post instantly, people take a few seconds to type.
    // Uses a type="hidden" field, which browser autofill never touches. Never drops silently.
    const renderedAt = Number(req.body.form_ts);
    if (renderedAt && Date.now() - renderedAt < 2000) {
      console.warn(`[contact] Rejected too-fast submission from ${req.ip}`);
      return respond(req, res, 400, 'That was very fast! Please wait a moment and send your message again.');
    }

    if (!name || !email || !body) return respond(req, res, 400, 'Please fill in your name, email and message.');
    if (!EMAIL_RE.test(email)) return respond(req, res, 400, 'Please enter a valid email address.');
    if (body.length < 10) return respond(req, res, 400, 'Your message is a little short. Tell me a bit more!');

    models.messages.create({ name, email, subject, body });
    respond(req, res, 200);
  });

  return router;
};
