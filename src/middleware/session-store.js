const session = require('express-session');

/** Minimal express-session store backed by the app's SQLite database, so logins survive restarts. */
class SqliteStore extends session.Store {
  constructor(db, { ttlMs = 1000 * 60 * 60 * 8 } = {}) {
    super();
    this.ttlMs = ttlMs;
    this.q = {
      get: db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expires > ?'),
      set: db.prepare('INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires'),
      destroy: db.prepare('DELETE FROM sessions WHERE sid = ?'),
      touch: db.prepare('UPDATE sessions SET expires = ? WHERE sid = ?'),
      prune: db.prepare('DELETE FROM sessions WHERE expires <= ?'),
    };
    this.pruneTimer = setInterval(() => this.q.prune.run(Date.now()), 15 * 60 * 1000);
    this.pruneTimer.unref();
  }

  expiry(sess) {
    return sess?.cookie?.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + this.ttlMs;
  }

  get(sid, cb) {
    try {
      const row = this.q.get.get(sid, Date.now());
      cb(null, row ? JSON.parse(row.sess) : null);
    } catch (err) {
      cb(err);
    }
  }

  set(sid, sess, cb = () => {}) {
    try {
      this.q.set.run(sid, JSON.stringify(sess), this.expiry(sess));
      cb(null);
    } catch (err) {
      cb(err);
    }
  }

  destroy(sid, cb = () => {}) {
    try {
      this.q.destroy.run(sid);
      cb(null);
    } catch (err) {
      cb(err);
    }
  }

  touch(sid, sess, cb = () => {}) {
    try {
      this.q.touch.run(this.expiry(sess), sid);
      cb(null);
    } catch (err) {
      cb(err);
    }
  }
}

module.exports = SqliteStore;
