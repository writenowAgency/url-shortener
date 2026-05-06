const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "shortener.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    long_url TEXT NOT NULL UNIQUE,
    clicks INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const statements = {
  findByLongUrl: db.prepare("SELECT slug FROM links WHERE long_url = ?"),
  findBySlug: db.prepare("SELECT slug, long_url, clicks, created_at FROM links WHERE slug = ?"),
  insertLink: db.prepare("INSERT INTO links (slug, long_url) VALUES (?, ?)"),
  bumpClick: db.prepare("UPDATE links SET clicks = clicks + 1 WHERE slug = ?"),
  listLinks: db.prepare(
    "SELECT slug, long_url, clicks, created_at FROM links ORDER BY datetime(created_at) DESC, id DESC"
  )
};

module.exports = {
  db,
  statements
};
