CREATE TABLE IF NOT EXISTS managed_assets (asset TEXT PRIMARY KEY REFERENCES assets ON DELETE CASCADE);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS asset_owner_quota BEFORE INSERT ON assets
WHEN NOT EXISTS (SELECT id FROM assets WHERE id=NEW.id)
 AND (SELECT COALESCE(sum(length(bytes)),0) FROM assets WHERE owner=NEW.owner)+length(NEW.bytes)>200000000
BEGIN SELECT RAISE(ABORT,'ASSET_QUOTA'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS invitation_owner_count BEFORE INSERT ON invitations
WHEN (SELECT count(*) FROM invitations WHERE owner=NEW.owner)>=500
BEGIN SELECT RAISE(ABORT,'INVITATION_LIMIT'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS bind_invitation_images AFTER INSERT ON invitations
BEGIN
  INSERT INTO invitation_assets(invitation,asset)
    SELECT DISTINCT NEW.id, substr(json_extract(value,'$.src'),13) FROM json_each(NEW.data,'$.images')
    WHERE json_extract(value,'$.src') LIKE '/api/assets/%';
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS update_invitation_images AFTER UPDATE OF data ON invitations
BEGIN
  DELETE FROM invitation_assets WHERE invitation=NEW.id;
  INSERT INTO invitation_assets(invitation,asset)
    SELECT DISTINCT NEW.id, substr(json_extract(value,'$.src'),13) FROM json_each(NEW.data,'$.images')
    WHERE json_extract(value,'$.src') LIKE '/api/assets/%';
  DELETE FROM assets WHERE id IN (
    SELECT substr(json_extract(value,'$.src'),13) FROM json_each(OLD.data,'$.images')
    WHERE json_extract(value,'$.src') LIKE '/api/assets/%'
  ) AND id IN (SELECT asset FROM managed_assets) AND NOT EXISTS (SELECT 1 FROM invitation_assets WHERE asset=assets.id);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS check_bound_asset_owner BEFORE INSERT ON invitation_assets
WHEN NOT EXISTS (SELECT 1 FROM assets a JOIN invitations i ON i.owner=a.owner WHERE a.id=NEW.asset AND i.id=NEW.invitation)
BEGIN SELECT RAISE(ABORT,'FOREIGN_ASSET'); END;
