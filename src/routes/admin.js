const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { requireAuth, csrfToken, verifyCsrf } = require('../middleware/security');
const { createUploader, verifyImages, publicPath, removeUpload } = require('../middleware/upload');
const config = require('../config');
const { slugify, safeUrl, renderMarkdown } = require('../lib/util');
const renderProject = require('../lib/render-project');

const SETTINGS_FIELDS = [
  'site_name', 'hero_eyebrow', 'hero_title', 'hero_subtitle', 'hero_roles',
  'about_title', 'about_text', 'stat_years', 'stat_clients', 'stat_satisfaction',
  'contact_email', 'contact_phone', 'location', 'social_github', 'social_linkedin', 'social_dribbble',
];
const MAX_GALLERY = 12;
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

module.exports = function adminRoutes(models) {
  const router = express.Router();
  const upload = createUploader();
  const projectUpload = upload.fields([
    { name: 'cover', maxCount: 1 },
    { name: 'gallery', maxCount: MAX_GALLERY },
  ]);

  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use(csrfToken);

  /* ---------------- Authentication ---------------- */

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).render('admin/login', { error: 'Too many failed attempts. Please wait 15 minutes and try again.', email: req.body?.email || '' }),
  });

  router.get('/login', (req, res) => {
    if (req.session.userId) return res.redirect('/admin');
    res.render('admin/login', { error: null, email: '', notice: req.query.loggedout ? 'You have been logged out securely.' : null });
  });

  router.post('/login', loginLimiter, verifyCsrf, async (req, res, next) => {
    const email = String(req.body.email || '').trim();
    const password = String(req.body.password || '');
    const user = email && models.users.findByEmail(email);
    // Always run bcrypt so response time doesn't reveal whether the email exists.
    const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !valid) {
      return res.status(401).render('admin/login', { error: 'Invalid email or password.', email });
    }
    const returnTo = req.session.returnTo;
    // New session ID on login prevents session-fixation attacks.
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = user.id;
      models.users.touchLogin(user.id);
      req.flash('success', `Welcome back, ${user.name}!`);
      res.redirect(returnTo && returnTo.startsWith('/admin') ? returnTo : '/admin');
    });
  });

  router.post('/logout', verifyCsrf, (req, res, next) => {
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie('pf.sid');
      res.redirect('/admin/login?loggedout=1');
    });
  });

  /* ---------------- Everything below requires a logged-in admin ---------------- */

  router.use(requireAuth);
  router.use((req, res, next) => {
    const user = models.users.find(req.session.userId);
    if (!user) return req.session.destroy(() => res.redirect('/admin/login'));
    res.locals.user = user;
    res.locals.unread = models.messages.unreadCount();
    next();
  });

  router.get('/', (req, res) => {
    res.render('admin/dashboard', {
      title: 'Dashboard',
      stats: models.stats(),
      recent: models.projects.list().slice(0, 5),
      messages: models.messages.all().slice(0, 5),
    });
  });

  /* ---------------- Projects ---------------- */

  router.get('/projects', (req, res) => {
    const filters = { q: String(req.query.q || '').trim(), status: req.query.status || '', category: req.query.category || '' };
    res.render('admin/projects', {
      title: 'Projects',
      projects: models.projects.list(filters),
      categories: models.categories.all(),
      filters,
    });
  });

  const emptyProject = { id: null, title: '', slug: '', category_id: null, summary: '', content: '', client: '', role: '', year: String(new Date().getFullYear()), tech: '', live_url: '', repo_url: '', cover_image: '', featured: 0, published: 0 };

  function renderForm(res, project, { errors = {}, images = [], status = 200 } = {}) {
    res.status(status).render('admin/project-form', {
      title: project.id ? `Edit: ${project.title}` : 'New project',
      project,
      images,
      errors,
      categories: models.categories.all(),
      maxGallery: MAX_GALLERY,
      maxUploadMb: config.maxUploadMb,
    });
  }

  // Live Markdown preview for the editor. Uses the exact renderer and sanitiser as the public page.
  router.post('/preview-markdown', verifyCsrf, (req, res) => {
    res.json({ html: renderMarkdown(String(req.body?.content || '').slice(0, 50000)) });
  });

  function readProjectForm(req, existing) {
    const b = req.body;
    const data = {
      title: String(b.title || '').trim().slice(0, 150),
      slug: '',
      category_id: Number(b.category_id) || null,
      summary: String(b.summary || '').trim().slice(0, 400),
      content: String(b.content || '').slice(0, 50000),
      client: String(b.client || '').trim().slice(0, 120),
      role: String(b.role || '').trim().slice(0, 120),
      year: String(b.year || '').trim().slice(0, 10),
      tech: String(b.tech || '').trim().slice(0, 300),
      live_url: safeUrl(b.live_url),
      repo_url: safeUrl(b.repo_url),
      cover_image: existing?.cover_image || '',
      featured: b.featured ? 1 : 0,
      published: b.published ? 1 : 0,
    };
    const errors = {};
    if (!data.title) errors.title = 'Title is required.';
    if (!data.summary) errors.summary = 'A short summary is required.';
    if (data.category_id && !models.categories.find(data.category_id)) errors.category_id = 'Choose a valid category.';
    if (b.live_url && !data.live_url) errors.live_url = 'Enter a full URL starting with http:// or https://';
    if (b.repo_url && !data.repo_url) errors.repo_url = 'Enter a full URL starting with http:// or https://';
    const wantedSlug = slugify(b.slug || data.title);
    data.slug = wantedSlug ? models.projects.uniqueSlug(wantedSlug, existing?.id || 0) : '';
    return { data, errors };
  }

  function uploadedFiles(req) {
    return { cover: req.files?.cover?.[0] || null, gallery: req.files?.gallery || [] };
  }

  router.get('/projects/new', (req, res) => renderForm(res, { ...emptyProject }));

  router.post('/projects', projectUpload, verifyCsrf, (req, res) => {
    const files = uploadedFiles(req);
    verifyImages([files.cover, ...files.gallery].filter(Boolean));
    const { data, errors } = readProjectForm(req);
    if (Object.keys(errors).length) {
      [files.cover, ...files.gallery].filter(Boolean).forEach((f) => removeUpload(publicPath(f)));
      errors._files = files.cover || files.gallery.length ? 'Please re-select your images after fixing the errors.' : undefined;
      return renderForm(res, { ...emptyProject, ...req.body, ...data, id: null }, { errors, status: 422 });
    }
    if (files.cover) data.cover_image = publicPath(files.cover);
    const id = models.projects.create(data);
    if (files.gallery.length) models.projects.addImages(id, files.gallery.map(publicPath));
    req.flash('success', `"${data.title}" was created${data.published ? ' and is now live' : ' as a draft'}.`);
    res.redirect(`/admin/projects/${id}/edit`);
  });

  function loadProject(req, res, next) {
    const project = models.projects.find(Number(req.params.id));
    if (!project) return res.status(404).render('error', { title: 'Not found', status: 404, message: 'That project no longer exists.' });
    req.project = project;
    next();
  }

  router.get('/projects/:id/edit', loadProject, (req, res) => {
    renderForm(res, req.project, { images: models.projects.images(req.project.id) });
  });

  router.get('/projects/:id/preview', loadProject, (req, res) => renderProject(models, res, req.project, { preview: true }));

  router.post('/projects/:id', loadProject, projectUpload, verifyCsrf, (req, res) => {
    const existing = req.project;
    const files = uploadedFiles(req);
    verifyImages([files.cover, ...files.gallery].filter(Boolean));
    const { data, errors } = readProjectForm(req, existing);

    const currentImages = models.projects.images(existing.id);
    const removeIds = [].concat(req.body.remove_images || []);
    if (currentImages.length - removeIds.length + files.gallery.length > MAX_GALLERY) {
      errors.gallery = `A project can have at most ${MAX_GALLERY} gallery images.`;
    }
    if (Object.keys(errors).length) {
      [files.cover, ...files.gallery].filter(Boolean).forEach((f) => removeUpload(publicPath(f)));
      return renderForm(res, { ...existing, ...data }, { errors, images: currentImages, status: 422 });
    }

    if (files.cover || req.body.remove_cover) {
      removeUpload(existing.cover_image);
      data.cover_image = files.cover ? publicPath(files.cover) : '';
    }
    models.projects.update(existing.id, data);
    if (req.body.captions && typeof req.body.captions === 'object') models.projects.updateCaptions(existing.id, req.body.captions);
    models.projects.removeImages(existing.id, removeIds).forEach(removeUpload);
    if (files.gallery.length) models.projects.addImages(existing.id, files.gallery.map(publicPath));

    req.flash('success', `"${data.title}" was saved.`);
    res.redirect(`/admin/projects/${existing.id}/edit`);
  });

  router.post('/projects/:id/toggle', verifyCsrf, loadProject, (req, res) => {
    const next = !req.project.published;
    models.projects.setPublished(req.project.id, next);
    req.flash('success', `"${req.project.title}" is now ${next ? 'published' : 'unpublished (draft)'}.`);
    res.redirect(req.get('referer') || '/admin/projects');
  });

  router.post('/projects/:id/move', verifyCsrf, loadProject, (req, res) => {
    models.projects.move(req.project.id, req.body.direction === 'up' ? 'up' : 'down');
    res.redirect('/admin/projects');
  });

  router.post('/projects/:id/delete', verifyCsrf, loadProject, (req, res) => {
    const images = models.projects.images(req.project.id);
    models.projects.remove(req.project.id);
    removeUpload(req.project.cover_image);
    images.forEach((img) => removeUpload(img.path));
    req.flash('success', `"${req.project.title}" was deleted.`);
    res.redirect('/admin/projects');
  });

  /* ---------------- Categories ---------------- */

  router.get('/categories', (req, res) => {
    res.render('admin/categories', { title: 'Categories', categories: models.categories.all() });
  });

  function categoryName(req) {
    const name = String(req.body.name || '').trim().slice(0, 60);
    if (!name || !slugify(name)) return null;
    return name;
  }

  function isDuplicate(err) {
    return err && String(err.code).startsWith('SQLITE_CONSTRAINT');
  }

  router.post('/categories', verifyCsrf, (req, res) => {
    const name = categoryName(req);
    if (!name) req.flash('error', 'Please enter a category name.');
    else {
      try {
        models.categories.create(name);
        req.flash('success', `Category "${name}" added.`);
      } catch (err) {
        if (!isDuplicate(err)) throw err;
        req.flash('error', `A category called "${name}" already exists.`);
      }
    }
    res.redirect('/admin/categories');
  });

  router.post('/categories/:id', verifyCsrf, (req, res) => {
    const name = categoryName(req);
    const cat = models.categories.find(Number(req.params.id));
    if (!cat || !name) req.flash('error', 'Please enter a category name.');
    else {
      try {
        models.categories.update(cat.id, name);
        req.flash('success', `Category renamed to "${name}".`);
      } catch (err) {
        if (!isDuplicate(err)) throw err;
        req.flash('error', `A category called "${name}" already exists.`);
      }
    }
    res.redirect('/admin/categories');
  });

  router.post('/categories/:id/delete', verifyCsrf, (req, res) => {
    const cat = models.categories.find(Number(req.params.id));
    if (cat) {
      models.categories.remove(cat.id);
      req.flash('success', `Category "${cat.name}" deleted. Its projects are now uncategorised.`);
    }
    res.redirect('/admin/categories');
  });

  /* ---------------- Testimonials ---------------- */

  const avatarUpload = upload.single('avatar');
  const emptyTestimonial = { id: null, name: '', role: '', quote: '', rating: 5, avatar: '', published: 1 };

  router.get('/testimonials', (req, res) => {
    res.render('admin/testimonials', { title: 'Testimonials', testimonials: models.testimonials.all() });
  });

  function renderTestimonialForm(res, testimonial, { errors = {}, status = 200 } = {}) {
    res.status(status).render('admin/testimonial-form', {
      title: testimonial.id ? `Edit testimonial: ${testimonial.name}` : 'New testimonial',
      testimonial,
      errors,
      maxUploadMb: config.maxUploadMb,
    });
  }

  function readTestimonialForm(req, existing) {
    const b = req.body;
    const rating = Math.round(Number(b.rating));
    const data = {
      name: String(b.name || '').trim().slice(0, 80),
      role: String(b.role || '').trim().slice(0, 120),
      quote: String(b.quote || '').trim().slice(0, 600),
      rating: rating >= 1 && rating <= 5 ? rating : 5,
      avatar: existing?.avatar || '',
      published: b.published ? 1 : 0,
    };
    const errors = {};
    if (!data.name) errors.name = 'Client name is required.';
    if (!data.quote) errors.quote = 'Please enter the testimonial text.';
    else if (data.quote.length < 15) errors.quote = 'The testimonial is a little short (at least 15 characters).';
    return { data, errors };
  }

  function loadTestimonial(req, res, next) {
    const t = models.testimonials.find(Number(req.params.id));
    if (!t) return res.status(404).render('error', { title: 'Not found', status: 404, message: 'That testimonial no longer exists.' });
    req.testimonial = t;
    next();
  }

  router.get('/testimonials/new', (req, res) => renderTestimonialForm(res, { ...emptyTestimonial }));

  router.post('/testimonials', avatarUpload, verifyCsrf, (req, res) => {
    if (req.file) verifyImages([req.file]);
    const { data, errors } = readTestimonialForm(req);
    if (Object.keys(errors).length) {
      if (req.file) removeUpload(publicPath(req.file));
      if (req.file) errors._files = 'Please re-select the photo after fixing the errors.';
      return renderTestimonialForm(res, { ...emptyTestimonial, ...data }, { errors, status: 422 });
    }
    if (req.file) data.avatar = publicPath(req.file);
    models.testimonials.create(data);
    req.flash('success', `Testimonial from ${data.name} was added${data.published ? ' and is now live' : ' as hidden'}.`);
    res.redirect('/admin/testimonials');
  });

  router.get('/testimonials/:id/edit', loadTestimonial, (req, res) => renderTestimonialForm(res, req.testimonial));

  router.post('/testimonials/:id', loadTestimonial, avatarUpload, verifyCsrf, (req, res) => {
    const existing = req.testimonial;
    if (req.file) verifyImages([req.file]);
    const { data, errors } = readTestimonialForm(req, existing);
    if (Object.keys(errors).length) {
      if (req.file) removeUpload(publicPath(req.file));
      return renderTestimonialForm(res, { ...existing, ...data }, { errors, status: 422 });
    }
    if (req.file || req.body.remove_avatar) {
      removeUpload(existing.avatar);
      data.avatar = req.file ? publicPath(req.file) : '';
    }
    models.testimonials.update(existing.id, data);
    req.flash('success', `Testimonial from ${data.name} was saved.`);
    res.redirect('/admin/testimonials');
  });

  router.post('/testimonials/:id/toggle', verifyCsrf, loadTestimonial, (req, res) => {
    const next = !req.testimonial.published;
    models.testimonials.setPublished(req.testimonial.id, next);
    req.flash('success', `Testimonial from ${req.testimonial.name} is now ${next ? 'visible on the site' : 'hidden'}.`);
    res.redirect('/admin/testimonials');
  });

  router.post('/testimonials/:id/move', verifyCsrf, loadTestimonial, (req, res) => {
    models.testimonials.move(req.testimonial.id, req.body.direction === 'up' ? 'up' : 'down');
    res.redirect('/admin/testimonials');
  });

  router.post('/testimonials/:id/delete', verifyCsrf, loadTestimonial, (req, res) => {
    models.testimonials.remove(req.testimonial.id);
    removeUpload(req.testimonial.avatar);
    req.flash('success', `Testimonial from ${req.testimonial.name} was deleted.`);
    res.redirect('/admin/testimonials');
  });

  /* ---------------- Messages ---------------- */

  router.get('/messages', (req, res) => {
    res.render('admin/messages', { title: 'Messages', messages: models.messages.all() });
  });

  router.post('/messages/:id/read', verifyCsrf, (req, res) => {
    models.messages.markRead(Number(req.params.id), req.body.read !== '0');
    res.redirect('/admin/messages');
  });

  router.post('/messages/:id/delete', verifyCsrf, (req, res) => {
    models.messages.remove(Number(req.params.id));
    req.flash('success', 'Message deleted.');
    res.redirect('/admin/messages');
  });

  /* ---------------- Site settings ---------------- */

  router.get('/settings', (req, res) => {
    res.render('admin/settings', { title: 'Site content', values: res.locals.site });
  });

  router.post('/settings', verifyCsrf, (req, res) => {
    const values = {};
    for (const key of SETTINGS_FIELDS) {
      let v = String(req.body[key] ?? '').trim().slice(0, 3000);
      if (key.startsWith('social_')) v = safeUrl(v);
      if (key.startsWith('stat_')) v = v.replace(/[^\d.]/g, '').slice(0, 6);
      values[key] = v;
    }
    if (!values.site_name) values.site_name = 'Portfolio';
    models.settings.save(values);
    req.flash('success', 'Site content updated. Changes are live on the homepage.');
    res.redirect('/admin/settings');
  });

  /* ---------------- Account ---------------- */

  router.get('/account', (req, res) => res.render('admin/account', { title: 'Account', errors: {} }));

  router.post('/account', verifyCsrf, async (req, res) => {
    const user = models.users.findWithHash(req.session.userId);
    const { name = '', email = '', current_password = '', new_password = '', confirm_password = '' } = req.body;
    const errors = {};
    if (!(await bcrypt.compare(String(current_password), user.password_hash))) errors.current_password = 'Current password is incorrect.';
    if (!String(name).trim()) errors.name = 'Name is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim())) errors.email = 'Enter a valid email.';
    const other = models.users.findByEmail(email);
    if (other && other.id !== user.id) errors.email = 'That email is already in use.';
    if (new_password) {
      if (new_password.length < 8 || !/[A-Za-z]/.test(new_password) || !/\d/.test(new_password)) {
        errors.new_password = 'Use at least 8 characters with letters and numbers.';
      } else if (new_password !== confirm_password) errors.confirm_password = 'Passwords do not match.';
    }
    if (Object.keys(errors).length) {
      res.locals.user = { ...res.locals.user, name, email };
      return res.status(422).render('admin/account', { title: 'Account', errors });
    }
    models.users.updateProfile(user.id, { name: String(name).trim().slice(0, 100), email: String(email) });
    if (new_password) models.users.updatePassword(user.id, await bcrypt.hash(new_password, 12));
    req.flash('success', new_password ? 'Profile and password updated.' : 'Profile updated.');
    res.redirect('/admin/account');
  });

  return router;
};
