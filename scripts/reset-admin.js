// Reset (or create) the admin login.
// Usage: npm run reset-admin -- <email> <password>
// With no arguments it restores the defaults from .env / config.
const bcrypt = require('bcryptjs');
const config = require('../src/config');
const { openDatabase } = require('../src/db');

const email = (process.argv[2] || config.admin.email).trim().toLowerCase();
const password = process.argv[3] || config.admin.password;

if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

const db = openDatabase();
const hash = bcrypt.hashSync(password, 12);
const existing = db.prepare('SELECT id FROM users ORDER BY id LIMIT 1').get();
if (existing) {
  db.prepare('UPDATE users SET email = ?, password_hash = ? WHERE id = ?').run(email, hash, existing.id);
} else {
  db.prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)').run(email, config.admin.name, hash);
}
db.prepare('DELETE FROM sessions').run();
db.close();
console.log(`Admin login reset.\n  Email:    ${email}\n  Password: ${password}`);
