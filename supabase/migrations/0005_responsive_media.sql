CREATE OR REPLACE FUNCTION waraq_private.bind_media() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE src text;BEGIN
 DELETE FROM waraq_private.invitation_assets WHERE invitation=NEW.id;
 FOR src IN SELECT value->>'src' FROM jsonb_array_elements(coalesce(NEW.data::jsonb->'images','[]'))
 UNION SELECT v.value->>'src' FROM jsonb_array_elements(coalesce(NEW.data::jsonb->'images','[]')) i CROSS JOIN LATERAL jsonb_array_elements(coalesce(i.value->'variants','[]')) v
 UNION SELECT NEW.data::jsonb#>>'{audio,src}' LOOP
  IF src LIKE '/api/assets/%' THEN INSERT INTO waraq_private.invitation_assets VALUES(NEW.id,substring(src FROM 13)) ON CONFLICT DO NOTHING;END IF;
 END LOOP;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION waraq_private.bind_media() FROM PUBLIC;
