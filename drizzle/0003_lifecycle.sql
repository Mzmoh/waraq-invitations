CREATE TABLE IF NOT EXISTS response_receipts (
 receipt TEXT PRIMARY KEY,
 invitation TEXT NOT NULL REFERENCES invitations ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS account_tokens (
 hash TEXT PRIMARY KEY,
 userId TEXT NOT NULL REFERENCES users ON DELETE CASCADE,
 purpose TEXT NOT NULL CHECK(purpose IN ('reset','verify')),
 expires INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS verified_emails (
 userId TEXT PRIMARY KEY REFERENCES users ON DELETE CASCADE,
 verifiedAt TEXT NOT NULL
);
--> statement-breakpoint
-- Retain previous image versions for editor Undo; explicit owner cleanup and
-- invitation deletion reclaim unreferenced managed assets. Owner quotas apply.
DROP TRIGGER IF EXISTS update_invitation_images;
--> statement-breakpoint
CREATE TRIGGER update_invitation_images AFTER UPDATE OF data ON invitations
BEGIN
 DELETE FROM invitation_assets WHERE invitation=NEW.id;
 INSERT INTO invitation_assets(invitation,asset)
 SELECT DISTINCT NEW.id, substr(json_extract(value,'$.src'),13) FROM json_each(NEW.data,'$.images')
 WHERE json_extract(value,'$.src') LIKE '/api/assets/%';
END;
