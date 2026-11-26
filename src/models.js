const { slugify } = require('./lib/util');

/** Data-access layer: every SQL query in the app lives here, using prepared statements only. */
function createModels(db) {
  const PROJECT_SELECT = `
    SELECT p.*, c.name AS category_name, c.slug AS category_slug,
      (SELECT COUNT(*) FROM project_images i WHERE i.project_id = p.id) AS image_count
    FROM projects p LEFT JOIN categories c ON c.id = p.category_id`;

  const settings = {
    all() {
      return Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, r.value]));
    },
    save(values) {
      const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
      db.transaction(() => Object.entries(values).forEach(([k, v]) => stmt.run(k, String(v ?? ''))))();
    },
  };

  const categories = {
    all() {
      return db
        .prepare(`SELECT c.*, COUNT(p.id) AS project_count,
            SUM(CASE WHEN p.published = 1 THEN 1 ELSE 0 END) AS published_count
          FROM categories c LEFT JOIN projects p ON p.category_id = c.id
          GROUP BY c.id ORDER BY c.name`)
        .all();
    },
    withPublished() {
      return this.all().filter((c) => c.published_count > 0);
    },
    find(id) {
      return db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    },
    create(name) {
      return db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)').run(name, slugify(name)).lastInsertRowid;
    },
    update(id, name) {
      db.prepare('UPDATE categories SET name = ?, slug = ? WHERE id = ?').run(name, slugify(name), id);
    },
    remove(id) {
      db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    },
  };

  const projects = {
    published() {
      return db.prepare(`${PROJECT_SELECT} WHERE p.published = 1 ORDER BY p.featured DESC, p.sort_order, p.created_at DESC`).all();
    },
    list({ q = '', status = '', category = '' } = {}) {
      const where = [];
      const params = {};
      if (q) {
        where.push('(p.title LIKE @q OR p.summary LIKE @q OR p.client LIKE @q)');
        params.q = `%${q}%`;
      }
      if (status === 'published') where.push('p.published = 1');
      if (status === 'draft') where.push('p.published = 0');
      if (category) {
        where.push('p.category_id = @category');
        params.category = Number(category);
      }
      const sql = `${PROJECT_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.sort_order, p.created_at DESC`;
      return db.prepare(sql).all(params);
    },
    find(id) {
      return db.prepare(`${PROJECT_SELECT} WHERE p.id = ?`).get(id);
    },
    findPublishedBySlug(slug) {
      return db.prepare(`${PROJECT_SELECT} WHERE p.slug = ? AND p.published = 1`).get(slug);
    },
    images(projectId) {
      return db.prepare('SELECT * FROM project_images WHERE project_id = ? ORDER BY sort_order, id').all(projectId);
    },
    neighbours(project) {
      const list = this.published();
      const i = list.findIndex((p) => p.id === project.id);
      return { prev: list[(i - 1 + list.length) % list.length], next: list[(i + 1) % list.length] };
    },
    related(project, limit = 3) {
      return db
        .prepare(`${PROJECT_SELECT} WHERE p.published = 1 AND p.id != ? ORDER BY (p.category_id IS ?) DESC, p.featured DESC, p.created_at DESC LIMIT ?`)
        .all(project.id, project.category_id, limit);
    },
    uniqueSlug(base, excludeId = 0) {
      const root = slugify(base) || 'project';
      let slug = root;
      for (let n = 2; db.prepare('SELECT 1 FROM projects WHERE slug = ? AND id != ?').get(slug, excludeId); n++) slug = `${root}-${n}`;
      return slug;
    },
    create(data) {
      const nextOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM projects').get().n;
      return db
        .prepare(`INSERT INTO projects (title, slug, category_id, summary, content, client, role, year, tech, live_url, repo_url,
            cover_image, featured, published, sort_order, published_at)
          VALUES (@title, @slug, @category_id, @summary, @content, @client, @role, @year, @tech, @live_url, @repo_url,
            @cover_image, @featured, @published, @sort_order, CASE WHEN @published = 1 THEN datetime('now') END)`)
        .run({ ...data, sort_order: nextOrder }).lastInsertRowid;
    },
    update(id, data) {
      db.prepare(`UPDATE projects SET title=@title, slug=@slug, category_id=@category_id, summary=@summary, content=@content,
          client=@client, role=@role, year=@year, tech=@tech, live_url=@live_url, repo_url=@repo_url, cover_image=@cover_image,
          featured=@featured,
          published_at = CASE WHEN @published = 1 AND published = 0 THEN datetime('now') ELSE published_at END,
          published=@published, updated_at=datetime('now')
        WHERE id=@id`).run({ ...data, id });
    },
    setPublished(id, published) {
      db.prepare(`UPDATE projects SET
          published_at = CASE WHEN @published = 1 AND published = 0 THEN datetime('now') ELSE published_at END,
          published = @published, updated_at = datetime('now') WHERE id = @id`).run({ id, published: published ? 1 : 0 });
    },
    move(id, direction) {
      const list = db.prepare('SELECT id FROM projects ORDER BY sort_order, created_at DESC').all().map((r) => r.id);
      const i = list.indexOf(id);
      const j = direction === 'up' ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      const stmt = db.prepare('UPDATE projects SET sort_order = ? WHERE id = ?');
      db.transaction(() => list.forEach((pid, idx) => stmt.run(idx, pid)))();
    },
    remove(id) {
      db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    },
    addImages(projectId, paths) {
      const start = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM project_images WHERE project_id = ?').get(projectId).n;
      const stmt = db.prepare('INSERT INTO project_images (project_id, path, sort_order) VALUES (?, ?, ?)');
      db.transaction(() => paths.forEach((p, i) => stmt.run(projectId, p, start + i)))();
    },
    updateCaptions(projectId, captions) {
      const stmt = db.prepare('UPDATE project_images SET caption = ? WHERE id = ? AND project_id = ?');
      db.transaction(() => Object.entries(captions).forEach(([id, c]) => stmt.run(String(c).slice(0, 200), Number(id), projectId)))();
    },
    removeImages(projectId, ids) {
      const found = ids
        .map((id) => db.prepare('SELECT * FROM project_images WHERE id = ? AND project_id = ?').get(Number(id), projectId))
        .filter(Boolean);
      const stmt = db.prepare('DELETE FROM project_images WHERE id = ?');
      db.transaction(() => found.forEach((img) => stmt.run(img.id)))();
      return found.map((img) => img.path);
    },
  };

  const testimonials = {
    all() {
      return db.prepare('SELECT * FROM testimonials ORDER BY sort_order, id').all();
    },
    published() {
      return db.prepare('SELECT * FROM testimonials WHERE published = 1 ORDER BY sort_order, id').all();
    },
    find(id) {
      return db.prepare('SELECT * FROM testimonials WHERE id = ?').get(id);
    },
    create(data) {
      const next = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM testimonials').get().n;
      return db
        .prepare(`INSERT INTO testimonials (name, role, quote, rating, avatar, published, sort_order)
          VALUES (@name, @role, @quote, @rating, @avatar, @published, @sort_order)`)
        .run({ ...data, sort_order: next }).lastInsertRowid;
    },
    update(id, data) {
      db.prepare(`UPDATE testimonials SET name=@name, role=@role, quote=@quote, rating=@rating, avatar=@avatar,
          published=@published, updated_at=datetime('now') WHERE id=@id`).run({ ...data, id });
    },
    setPublished(id, published) {
      db.prepare("UPDATE testimonials SET published = ?, updated_at = datetime('now') WHERE id = ?").run(published ? 1 : 0, id);
    },
    move(id, direction) {
      const list = db.prepare('SELECT id FROM testimonials ORDER BY sort_order, id').all().map((r) => r.id);
      const i = list.indexOf(id);
      const j = direction === 'up' ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      const stmt = db.prepare('UPDATE testimonials SET sort_order = ? WHERE id = ?');
      db.transaction(() => list.forEach((tid, idx) => stmt.run(idx, tid)))();
    },
    remove(id) {
      db.prepare('DELETE FROM testimonials WHERE id = ?').run(id);
    },
  };

  const messages = {
    all() {
      return db.prepare('SELECT * FROM messages ORDER BY created_at DESC, id DESC').all();
    },
    create({ name, email, subject, body }) {
      db.prepare('INSERT INTO messages (name, email, subject, body) VALUES (?, ?, ?, ?)').run(name, email, subject, body);
    },
    markRead(id, read = true) {
      db.prepare('UPDATE messages SET is_read = ? WHERE id = ?').run(read ? 1 : 0, id);
    },
    remove(id) {
      db.prepare('DELETE FROM messages WHERE id = ?').run(id);
    },
    unreadCount() {
      return db.prepare('SELECT COUNT(*) AS n FROM messages WHERE is_read = 0').get().n;
    },
  };

  const users = {
    findByEmail(email) {
      return db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase().trim());
    },
    find(id) {
      return db.prepare('SELECT id, email, name, last_login_at, created_at FROM users WHERE id = ?').get(id);
    },
    findWithHash(id) {
      return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    },
    touchLogin(id) {
      db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(id);
    },
    updatePassword(id, hash) {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);
    },
    updateProfile(id, { name, email }) {
      db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name, email.toLowerCase().trim(), id);
    },
  };

  const stats = () =>
    db
      .prepare(`SELECT
          (SELECT COUNT(*) FROM projects) AS total,
          (SELECT COUNT(*) FROM projects WHERE published = 1) AS published,
          (SELECT COUNT(*) FROM projects WHERE published = 0) AS drafts,
          (SELECT COUNT(*) FROM categories) AS categories,
          (SELECT COUNT(*) FROM messages) AS messages,
          (SELECT COUNT(*) FROM messages WHERE is_read = 0) AS unread`)
      .get();

  return { settings, categories, projects, testimonials, messages, users, stats };
}

module.exports = { createModels };
