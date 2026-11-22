PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'creator' CHECK(role IN ('creator','admin'))
);
CREATE TABLE IF NOT EXISTS sessions (
  hash TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users ON DELETE CASCADE, expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, published INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS templates (id TEXT PRIMARY KEY, category TEXT NOT NULL REFERENCES categories, published INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users, slug TEXT UNIQUE NOT NULL,
  templateId TEXT NOT NULL REFERENCES templates, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
  data TEXT NOT NULL, settings TEXT NOT NULL, pinHash TEXT NOT NULL DEFAULT '', updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS invitations_by_owner ON invitations(owner,updatedAt DESC);
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users, mime TEXT NOT NULL, bytes BLOB NOT NULL
);
CREATE TABLE IF NOT EXISTS invitation_assets (
  invitation TEXT REFERENCES invitations ON DELETE CASCADE, asset TEXT REFERENCES assets,
  PRIMARY KEY (invitation,asset)
);
CREATE INDEX IF NOT EXISTS invitations_using_asset ON invitation_assets(asset);
CREATE TABLE IF NOT EXISTS responses (
  id TEXT PRIMARY KEY, invitation TEXT REFERENCES invitations ON DELETE CASCADE, name TEXT NOT NULL,
  attending INTEGER NOT NULL, count INTEGER NOT NULL, comment TEXT NOT NULL, createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS responses_by_invite ON responses(invitation,createdAt DESC);
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY, invitation TEXT NOT NULL REFERENCES invitations,
  reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS limits (bucket TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS secrets (name TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit (action TEXT NOT NULL, actor TEXT NOT NULL REFERENCES users, target TEXT NOT NULL, createdAt TEXT NOT NULL);

