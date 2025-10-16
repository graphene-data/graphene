PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS orgs (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  name TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS orgs_slug_idx ON orgs(slug);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
);

CREATE UNIQUE INDEX IF NOT EXISTS users_org_email_idx ON users(org_id, email);

CREATE TABLE IF NOT EXISTS connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  kind TEXT NOT NULL,
  config_json TEXT NOT NULL,
  updated_at INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS connections_org_label_idx ON connections(org_id, label);

CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  updated_by TEXT REFERENCES users(id),
  updated_at INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS pages_org_slug_idx ON pages(org_id, slug);
