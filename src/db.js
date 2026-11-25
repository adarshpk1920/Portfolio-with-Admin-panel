const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const config = require('./config');
const seedData = require('./seed-data');

function openDatabase(file = config.DB_FILE) {
  if (file !== ':memory:') fs.mkdirSync(require('path').dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  seed(db);
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      summary TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      client TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT '',
      year TEXT NOT NULL DEFAULT '',
      tech TEXT NOT NULL DEFAULT '',
      live_url TEXT NOT NULL DEFAULT '',
      repo_url TEXT NOT NULL DEFAULT '',
      cover_image TEXT NOT NULL DEFAULT '',
      featured INTEGER NOT NULL DEFAULT 0,
      published INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      published_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_projects_published ON projects(published, sort_order);

    CREATE TABLE IF NOT EXISTS project_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      caption TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expires INTEGER NOT NULL
    );
  `);
}

function seed(db) {
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(seedData.settings)) insertSetting.run(k, v);

  const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (userCount === 0) {
    db.prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)').run(
      config.admin.email,
      config.admin.name,
      bcrypt.hashSync(config.admin.password, 12)
    );
  }

  const catCount = db.prepare('SELECT COUNT(*) AS n FROM categories').get().n;
  if (catCount > 0) return;

  const tx = db.transaction(() => {
    const insertCat = db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)');
    const catIds = {};
    for (const c of seedData.categories) catIds[c.slug] = insertCat.run(c.name, c.slug).lastInsertRowid;

    const insertProject = db.prepare(`
      INSERT INTO projects (title, slug, category_id, summary, content, client, role, year, tech,
        live_url, repo_url, cover_image, featured, published, sort_order, published_at)
      VALUES (@title, @slug, @category_id, @summary, @content, @client, @role, @year, @tech,
        @live_url, @repo_url, @cover_image, @featured, @published, @sort_order,
        CASE WHEN @published = 1 THEN datetime('now') ELSE NULL END)
    `);
    const insertImage = db.prepare('INSERT INTO project_images (project_id, path, caption, sort_order) VALUES (?, ?, ?, ?)');

    seedData.projects.forEach(({ category, gallery, ...p }, i) => {
      const id = insertProject.run({
        live_url: '',
        repo_url: '',
        featured: 0,
        published: 1,
        ...p,
        category_id: catIds[category],
        sort_order: i,
      }).lastInsertRowid;
      (gallery || []).forEach((g, j) => insertImage.run(id, g.path, g.caption, j));
    });
  });
  tx();
}

module.exports = { openDatabase };
