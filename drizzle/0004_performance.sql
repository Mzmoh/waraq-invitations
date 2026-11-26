CREATE INDEX IF NOT EXISTS invitations_owner_page ON invitations(owner,updatedAt DESC,id DESC);
CREATE INDEX IF NOT EXISTS responses_invitation_page ON responses(invitation,createdAt DESC,id DESC);
CREATE INDEX IF NOT EXISTS assets_owner_index ON assets(owner);
DROP TRIGGER IF EXISTS bind_invitation_images;
DROP TRIGGER IF EXISTS update_invitation_images;
CREATE TRIGGER bind_invitation_images AFTER INSERT ON invitations BEGIN
 INSERT INTO invitation_assets(invitation,asset)
 SELECT NEW.id,substr(src,13) FROM (
  SELECT json_extract(value,'$.src') AS src FROM json_each(NEW.data,'$.images')
  UNION SELECT json_extract(v.value,'$.src') FROM json_each(NEW.data,'$.images') i,json_each(i.value,'$.variants') v
  UNION SELECT json_extract(NEW.data,'$.audio.src')
 ) WHERE src LIKE '/api/assets/%';
END;
CREATE TRIGGER update_invitation_images AFTER UPDATE OF data ON invitations BEGIN
 DELETE FROM invitation_assets WHERE invitation=NEW.id;
 INSERT INTO invitation_assets(invitation,asset)
 SELECT NEW.id,substr(src,13) FROM (
  SELECT json_extract(value,'$.src') AS src FROM json_each(NEW.data,'$.images')
  UNION SELECT json_extract(v.value,'$.src') FROM json_each(NEW.data,'$.images') i,json_each(i.value,'$.variants') v
  UNION SELECT json_extract(NEW.data,'$.audio.src')
 ) WHERE src LIKE '/api/assets/%';
END;
