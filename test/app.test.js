const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Isolated data dir + in-memory DB so tests never touch real data.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-test-'));
process.env.DATA_DIR = tmp;
process.env.ADMIN_EMAIL = 'test@admin.dev';
process.env.ADMIN_PASSWORD = 'Secret123!';

const request = require('supertest');
const { createApp } = require('../src/app');

// Smallest valid PNG (1×1 transparent pixel).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

let app;
let agent;
const csrfFrom = (html) => html.match(/name="_csrf" value="([^"]+)"/)[1];

async function freshCsrf(url = '/admin') {
  const res = await agent.get(url);
  return csrfFrom(res.text);
}

before(async () => {
  app = createApp({ dbFile: ':memory:' });
  agent = request.agent(app);
});

after(() => {
  app.locals.db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('public homepage renders seeded projects and sections', async () => {
  const res = await request(app).get('/').expect(200);
  for (const id of ['about', 'services', 'portfolio', 'contact']) assert.match(res.text, new RegExp(`id="${id}"`));
  assert.match(res.text, /Lumen Analytics Dashboard/);
  assert.ok(res.headers['content-security-policy'], 'CSP header is set');
  // CSS/JS URLs carry a content hash so long browser caching can never serve stale styles.
  const css = res.text.match(/href="(\/css\/style\.css\?v=[0-9a-f]{10})"/);
  assert.ok(css, 'stylesheet URL is versioned');
  assert.match(res.text, /src="\/js\/main\.js\?v=[0-9a-f]{10}"/);
  await request(app).get(css[1]).expect(200).expect('content-type', /css/);
});

test('project detail page renders markdown case study', async () => {
  const res = await request(app).get('/projects/lumen-analytics-dashboard').expect(200);
  assert.match(res.text, /<h2>The challenge<\/h2>/);
  await request(app).get('/projects/does-not-exist').expect(404);
});

test('admin dashboard is protected', async () => {
  const res = await request(app).get('/admin').expect(302);
  assert.equal(res.headers.location, '/admin/login');
  await request(app).get('/admin/projects/new').expect(302);
});

test('login rejects bad credentials and requires CSRF', async () => {
  const token = csrfFrom((await agent.get('/admin/login')).text);
  await agent.post('/admin/login').type('form').send({ email: 'test@admin.dev', password: 'wrong', _csrf: token }).expect(401);
  await agent.post('/admin/login').type('form').send({ email: 'test@admin.dev', password: 'Secret123!' }).expect(403);
});

test('admin can log in', async () => {
  const token = csrfFrom((await agent.get('/admin/login')).text);
  const res = await agent.post('/admin/login').type('form').send({ email: 'TEST@admin.dev', password: 'Secret123!', _csrf: token }).expect(302);
  assert.equal(res.headers.location, '/admin');
  const dash = await agent.get('/admin').expect(200);
  assert.match(dash.text, /Total projects/);
});

let createdId;

test('admin creates a published project with images and it appears publicly', async () => {
  const token = await freshCsrf('/admin/projects/new');
  const res = await agent
    .post('/admin/projects')
    .field('_csrf', token)
    .field('title', 'Test Case Study')
    .field('summary', 'A project created by the test-suite.')
    .field('content', '## Hello\n\n<script>alert(1)</script>Safe text')
    .field('tech', 'Node, SQLite')
    .field('published', '1')
    .attach('cover', PNG, { filename: 'cover.png', contentType: 'image/png' })
    .attach('gallery', PNG, { filename: 'g1.png', contentType: 'image/png' })
    .expect(302);
  createdId = Number(res.headers.location.match(/projects\/(\d+)/)[1]);

  const home = await request(app).get('/').expect(200);
  assert.match(home.text, /Test Case Study/);

  const page = await request(app).get('/projects/test-case-study').expect(200);
  assert.match(page.text, /<h2>Hello<\/h2>/);
  assert.doesNotMatch(page.text, /<script>alert/, 'markdown output is sanitised');
  const cover = page.text.match(/src="(\/uploads\/[^"]+\.png)"/)[1];
  await request(app).get(cover).expect(200).expect('content-type', /image\/png/);
});

test('validation errors are shown and duplicate slugs are made unique', async () => {
  let token = await freshCsrf('/admin/projects/new');
  const bad = await agent.post('/admin/projects').field('_csrf', token).field('title', '').field('summary', '').expect(422);
  assert.match(bad.text, /Title is required/);

  token = await freshCsrf('/admin/projects/new');
  const res = await agent.post('/admin/projects').field('_csrf', token).field('title', 'Test Case Study').field('summary', 'Dup').expect(302);
  const id = res.headers.location.match(/projects\/(\d+)/)[1];
  const edit = await agent.get(`/admin/projects/${id}/edit`).expect(200);
  assert.match(edit.text, /value="test-case-study-2"/);
  // Drafts are not public, but admins can preview them.
  await request(app).get('/projects/test-case-study-2').expect(404);
  await agent.get(`/admin/projects/${id}/preview`).expect(200);
});

test('non-image uploads are rejected even with an image mimetype', async () => {
  const token = await freshCsrf(`/admin/projects/${createdId}/edit`);
  const res = await agent
    .post(`/admin/projects/${createdId}`)
    .field('_csrf', token)
    .field('title', 'Test Case Study')
    .field('summary', 'x')
    .attach('cover', Buffer.from('<?php echo 1; ?>'), { filename: 'evil.png', contentType: 'image/png' })
    .expect(302);
  const follow = await agent.get(res.headers.location);
  assert.match(follow.text, /does not look like a valid image/);
  assert.equal(fs.readdirSync(path.join(tmp, 'uploads')).filter((f) => f.endsWith('.png')).length, 2, 'rejected file was cleaned up');
});

test('unpublishing hides the project; republishing shows it again', async () => {
  let token = await freshCsrf('/admin/projects');
  await agent.post(`/admin/projects/${createdId}/toggle`).type('form').send({ _csrf: token }).expect(302);
  await request(app).get('/projects/test-case-study').expect(404);
  assert.doesNotMatch((await request(app).get('/')).text, /Test Case Study/);

  token = await freshCsrf('/admin/projects');
  await agent.post(`/admin/projects/${createdId}/toggle`).type('form').send({ _csrf: token }).expect(302);
  await request(app).get('/projects/test-case-study').expect(200);
});

test('state-changing requests without a CSRF token are blocked', async () => {
  await agent.post(`/admin/projects/${createdId}/delete`).type('form').send({}).expect(403);
  await request(app).get('/projects/test-case-study').expect(200);
});

test('deleting a project removes it and its uploaded files', async () => {
  const token = await freshCsrf('/admin/projects');
  await agent.post(`/admin/projects/${createdId}/delete`).type('form').send({ _csrf: token }).expect(302);
  await request(app).get('/projects/test-case-study').expect(404);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(fs.readdirSync(path.join(tmp, 'uploads')).length, 0);
});

test('categories and settings can be managed', async () => {
  let token = await freshCsrf('/admin/categories');
  await agent.post('/admin/categories').type('form').send({ _csrf: token, name: 'E-commerce' }).expect(302);
  assert.match((await agent.get('/admin/categories')).text, /value="E-commerce"/);
  // New categories appear as public filters immediately, even with no projects yet.
  assert.match((await request(app).get('/')).text, /data-filter="e-commerce"/);

  token = await freshCsrf('/admin/settings');
  await agent.post('/admin/settings').type('form').send({ _csrf: token, site_name: 'Jordan Test', hero_title: 'Hello from settings' }).expect(302);
  const home = await request(app).get('/');
  assert.match(home.text, /Jordan Test/);
  assert.match(home.text, /Hello from settings/);
});

test('contact form stores messages and validates input', async () => {
  await request(app).post('/contact').set('Accept', 'application/json').type('form').send({ name: 'A', email: 'bad', message: 'hello there friend' }).expect(400);
  await request(app).post('/contact').set('Accept', 'application/json').type('form').send({ name: 'Ana', email: 'ana@example.com', message: 'I would like a website.' }).expect(200);
  // Extra autofilled fields never cause a message to be dropped.
  await request(app).post('/contact').set('Accept', 'application/json').type('form').send({ name: 'Ben', email: 'ben@example.com', message: 'Autofill should not drop me.', website: 'https://ben.dev', form_ts: Date.now() - 10000 }).expect(200);
  // Instant (bot-speed) submissions are rejected with a visible error, not silently.
  const fast = await request(app).post('/contact').set('Accept', 'application/json').type('form').send({ name: 'Bot', email: 'bot@spam.com', message: 'Buy cheap things now!!!', form_ts: Date.now() }).expect(400);
  assert.match(fast.body.error, /wait a moment/);
  const inbox = await agent.get('/admin/messages').expect(200);
  assert.match(inbox.text, /ana@example.com/);
  assert.match(inbox.text, /ben@example.com/);
  assert.doesNotMatch(inbox.text, /bot@spam.com/);
});

test('testimonials are managed from the admin panel and shown on the homepage', async () => {
  await request(app).get('/admin/testimonials').expect(302);

  // Seeded samples are listed in the admin and shown publicly.
  assert.match((await agent.get('/admin/testimonials').expect(200)).text, /Priya Raman/);
  assert.match((await request(app).get('/')).text, /id="testimonials"[\s\S]*Priya Raman/);

  // Validation: name and quote are required.
  let token = await freshCsrf('/admin/testimonials/new');
  const bad = await agent.post('/admin/testimonials').field('_csrf', token).field('name', '').field('quote', 'short').expect(422);
  assert.match(bad.text, /Client name is required/);

  // Create with a photo, an out-of-range rating (clamped to 5) and HTML that must be escaped.
  token = await freshCsrf('/admin/testimonials/new');
  await agent
    .post('/admin/testimonials')
    .field('_csrf', token)
    .field('name', 'Zara Test')
    .field('role', 'CEO, Testco')
    .field('quote', 'Brilliant work <script>alert(1)</script> from start to finish.')
    .field('rating', '9')
    .field('published', '1')
    .attach('avatar', PNG, { filename: 'zara.png', contentType: 'image/png' })
    .expect(302);
  const created = app.locals.models.testimonials.all().find((t) => t.name === 'Zara Test');
  assert.ok(created, 'testimonial saved');
  assert.equal(created.rating, 5);
  assert.match(created.avatar, /^\/uploads\/.+\.png$/);
  let home = (await request(app).get('/')).text;
  assert.match(home, /Zara Test/);
  assert.match(home, /&lt;script&gt;alert\(1\)/, 'quote is HTML-escaped');
  assert.doesNotMatch(home, /<script>alert\(1\)<\/script>/);
  await request(app).get(created.avatar).expect(200);

  // Hide it: gone from the homepage but still in the admin list.
  token = await freshCsrf('/admin/testimonials');
  await agent.post(`/admin/testimonials/${created.id}/toggle`).type('form').send({ _csrf: token }).expect(302);
  assert.doesNotMatch((await request(app).get('/')).text, /Zara Test/);

  // Edit: new role and rating, shown again.
  token = await freshCsrf(`/admin/testimonials/${created.id}/edit`);
  await agent.post(`/admin/testimonials/${created.id}`).field('_csrf', token).field('name', 'Zara Test').field('role', 'Founder, Newco')
    .field('quote', 'Brilliant work from start to finish, again.').field('rating', '4').field('published', '1').expect(302);
  home = (await request(app).get('/')).text;
  assert.match(home, /Founder, Newco/);
  assert.match(home, /aria-label="4 out of 5 stars"/);

  // Reorder: move to the top.
  const before = app.locals.models.testimonials.all().map((t) => t.id);
  token = await freshCsrf('/admin/testimonials');
  await agent.post(`/admin/testimonials/${created.id}/move`).type('form').send({ _csrf: token, direction: 'up' }).expect(302);
  const after = app.locals.models.testimonials.all().map((t) => t.id);
  assert.equal(after.indexOf(created.id), before.indexOf(created.id) - 1);

  // Delete removes the record and its uploaded photo.
  const photoFile = path.join(tmp, 'uploads', path.basename(created.avatar));
  assert.ok(fs.existsSync(photoFile));
  token = await freshCsrf('/admin/testimonials');
  await agent.post(`/admin/testimonials/${created.id}/delete`).type('form').send({ _csrf: token }).expect(302);
  assert.equal(app.locals.models.testimonials.find(created.id), undefined);
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(!fs.existsSync(photoFile), 'photo file deleted');
});

test('logout ends the session', async () => {
  const token = await freshCsrf('/admin');
  await agent.post('/admin/logout').type('form').send({ _csrf: token }).expect(302);
  await agent.get('/admin').expect(302);
});
