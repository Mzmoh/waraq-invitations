-- Apply manually to a NEW, EMPTY, non-production trial Supabase project only.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE SCHEMA waraq_private;
REVOKE ALL ON SCHEMA waraq_private FROM PUBLIC;
CREATE ROLE waraq_app NOLOGIN NOBYPASSRLS;
GRANT waraq_app TO postgres;
GRANT USAGE ON SCHEMA waraq_private,extensions TO waraq_app;
CREATE TABLE waraq_private.users(id text PRIMARY KEY,email text UNIQUE NOT NULL,password text NOT NULL,role text NOT NULL DEFAULT 'creator' CHECK(role IN ('creator','admin')));
CREATE TABLE waraq_private.sessions(hash text PRIMARY KEY,userid text NOT NULL REFERENCES waraq_private.users ON DELETE CASCADE,expires bigint NOT NULL);
CREATE TABLE waraq_private.categories(id text PRIMARY KEY,published integer NOT NULL DEFAULT 1 CHECK(published IN(0,1)));
CREATE TABLE waraq_private.templates(id text PRIMARY KEY,category text NOT NULL REFERENCES waraq_private.categories,published integer NOT NULL DEFAULT 1 CHECK(published IN(0,1)));
CREATE TABLE waraq_private.invitations(id text PRIMARY KEY,owner text NOT NULL REFERENCES waraq_private.users,slug text UNIQUE NOT NULL,templateid text NOT NULL REFERENCES waraq_private.templates,status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','published','archived')),data text NOT NULL CHECK(jsonb_typeof(data::jsonb)='object'),settings text NOT NULL CHECK(jsonb_typeof(settings::jsonb)='object'),pinhash text NOT NULL DEFAULT '',updatedat text NOT NULL);
CREATE INDEX ON waraq_private.invitations(owner,updatedat DESC);
-- bytes contains private object metadata JSON, never the media binary.
CREATE TABLE waraq_private.assets(id text PRIMARY KEY,owner text NOT NULL REFERENCES waraq_private.users,mime text NOT NULL,bytes text NOT NULL CHECK(jsonb_typeof(bytes::jsonb)='object'));
CREATE TABLE waraq_private.invitation_assets(invitation text REFERENCES waraq_private.invitations ON DELETE CASCADE,asset text REFERENCES waraq_private.assets,PRIMARY KEY(invitation,asset));
CREATE INDEX ON waraq_private.invitation_assets(asset);
CREATE TABLE waraq_private.managed_assets(asset text PRIMARY KEY REFERENCES waraq_private.assets ON DELETE CASCADE);
CREATE TABLE waraq_private.responses(id text PRIMARY KEY,invitation text REFERENCES waraq_private.invitations ON DELETE CASCADE,name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100),attending integer NOT NULL CHECK(attending IN(0,1)),count integer NOT NULL CHECK(count>=0),comment text NOT NULL,createdat text NOT NULL);
CREATE INDEX ON waraq_private.responses(invitation,createdat DESC);
CREATE TABLE waraq_private.reports(id text PRIMARY KEY,invitation text NOT NULL REFERENCES waraq_private.invitations,reason text NOT NULL,status text NOT NULL DEFAULT 'open',createdat text NOT NULL);
CREATE TABLE waraq_private.limits(bucket text PRIMARY KEY,hits integer NOT NULL,expires bigint NOT NULL);
CREATE TABLE waraq_private.secrets(name text PRIMARY KEY,value text NOT NULL);
CREATE TABLE waraq_private.audit(action text NOT NULL,actor text NOT NULL REFERENCES waraq_private.users,target text NOT NULL,createdat text NOT NULL);
CREATE TABLE waraq_private.response_receipts(receipt text PRIMARY KEY,invitation text NOT NULL REFERENCES waraq_private.invitations ON DELETE CASCADE);
CREATE TABLE waraq_private.account_tokens(hash text PRIMARY KEY,userid text NOT NULL REFERENCES waraq_private.users ON DELETE CASCADE,purpose text NOT NULL CHECK(purpose IN('reset','verify')),expires bigint NOT NULL);
CREATE TABLE waraq_private.verified_emails(userid text PRIMARY KEY REFERENCES waraq_private.users ON DELETE CASCADE,verifiedat text NOT NULL);
CREATE TABLE waraq_private.storage_gc(key text PRIMARY KEY);

CREATE FUNCTION waraq_private.current_uid() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT s.userid FROM waraq_private.sessions s WHERE s.hash=current_setting('waraq.session_hash',true) AND s.expires>extract(epoch FROM statement_timestamp())*1000
$$;
CREATE FUNCTION waraq_private.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM waraq_private.users WHERE id=waraq_private.current_uid() AND role='admin')
$$;
CREATE FUNCTION waraq_private.pin_granted(i waraq_private.invitations) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE grant_value text; deadline text; signature text; secret text;
BEGIN
 IF current_setting('waraq.unlocked_slug',true)=i.slug AND current_setting('waraq.unlocked_hash',true)=i.pinhash AND i.pinhash<>'' THEN RETURN true; END IF;
 grant_value:=coalesce(nullif(current_setting('waraq.pin_grants',true),''),'{}')::jsonb->>('invite_pin_'||i.slug);
 IF grant_value IS NULL OR grant_value !~ '^[0-9]{13}\.[a-f0-9]{64}$' THEN RETURN false; END IF;
 deadline:=split_part(grant_value,'.',1);signature:=split_part(grant_value,'.',2);
 IF deadline::bigint<=extract(epoch FROM statement_timestamp())*1000 THEN RETURN false; END IF;
 SELECT value INTO secret FROM waraq_private.secrets WHERE name='hmac';
 RETURN signature=encode(extensions.hmac(i.id||'|'||i.pinhash||'|'||deadline,secret,'sha256'),'hex');
END $$;
CREATE FUNCTION waraq_private.guest_metadata(s text) RETURNS TABLE(id text,slug text,templateid text,pinhash text,data text,settings text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT i.id,i.slug,i.templateid,i.pinhash,'{}'::text,'{"privacy":"pin"}'::text FROM waraq_private.invitations i JOIN waraq_private.templates t ON t.id=i.templateid JOIN waraq_private.categories c ON c.id=t.category WHERE i.slug=s AND i.status='published' AND t.published=1 AND c.published=1 AND i.settings::jsonb->>'privacy'='pin'
$$;
CREATE FUNCTION waraq_private.can_bind(inv text, media text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM waraq_private.invitations i JOIN waraq_private.assets a ON a.owner=i.owner WHERE i.id=inv AND a.id=media AND i.owner=waraq_private.current_uid())
$$;
CREATE FUNCTION waraq_private.admin_reports() RETURNS TABLE(id text,slug text,reason text,status text,createdat text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT r.id,i.slug,r.reason,r.status,r.createdat FROM waraq_private.reports r JOIN waraq_private.invitations i ON i.id=r.invitation WHERE waraq_private.is_admin() ORDER BY r.createdat DESC
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA waraq_private FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA waraq_private TO waraq_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA waraq_private TO waraq_app;
DO $$DECLARE t text; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='waraq_private' LOOP
  EXECUTE format('ALTER TABLE waraq_private.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE waraq_private.%I FORCE ROW LEVEL SECURITY',t);
 END LOOP;
END $$;
-- Auth infrastructure is private, backend-only. No Supabase client role has
-- schema/table/function privileges. The server keeps its existing scrypt auth.
DO $$DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['users','sessions','limits','secrets','account_tokens','verified_emails','storage_gc'] LOOP
  EXECUTE format('CREATE POLICY backend_auth ON waraq_private.%I TO waraq_app USING(true) WITH CHECK(true)',t);
 END LOOP;
END $$;
CREATE POLICY catalog_read ON waraq_private.categories FOR SELECT TO waraq_app USING(true);
CREATE POLICY catalog_admin ON waraq_private.categories FOR UPDATE TO waraq_app USING(waraq_private.is_admin()) WITH CHECK(waraq_private.is_admin());
CREATE POLICY catalog_read ON waraq_private.templates FOR SELECT TO waraq_app USING(true);
CREATE POLICY catalog_admin ON waraq_private.templates FOR UPDATE TO waraq_app USING(waraq_private.is_admin()) WITH CHECK(waraq_private.is_admin());
CREATE POLICY invitation_read ON waraq_private.invitations FOR SELECT TO waraq_app USING(owner=waraq_private.current_uid() OR (status='published' AND EXISTS(SELECT 1 FROM waraq_private.templates t JOIN waraq_private.categories c ON c.id=t.category WHERE t.id=templateid AND t.published=1 AND c.published=1) AND (settings::jsonb->>'privacy'<>'pin' OR waraq_private.pin_granted(invitations))));
CREATE POLICY invitation_insert ON waraq_private.invitations FOR INSERT TO waraq_app WITH CHECK(owner=waraq_private.current_uid());
CREATE POLICY invitation_update ON waraq_private.invitations FOR UPDATE TO waraq_app USING(owner=waraq_private.current_uid()) WITH CHECK(owner=waraq_private.current_uid());
CREATE POLICY invitation_delete ON waraq_private.invitations FOR DELETE TO waraq_app USING(owner=waraq_private.current_uid());
CREATE POLICY asset_read ON waraq_private.assets FOR SELECT TO waraq_app USING(owner=waraq_private.current_uid() OR EXISTS(SELECT 1 FROM waraq_private.invitation_assets a JOIN waraq_private.invitations i ON i.id=a.invitation WHERE a.asset=assets.id AND i.status='published'));
CREATE POLICY asset_write ON waraq_private.assets FOR ALL TO waraq_app USING(owner=waraq_private.current_uid()) WITH CHECK(owner=waraq_private.current_uid());
CREATE POLICY binding_read ON waraq_private.invitation_assets FOR SELECT TO waraq_app USING(EXISTS(SELECT 1 FROM waraq_private.invitations i WHERE i.id=invitation));
CREATE POLICY binding_insert ON waraq_private.invitation_assets FOR INSERT TO waraq_app WITH CHECK(waraq_private.can_bind(invitation,asset));
CREATE POLICY binding_delete ON waraq_private.invitation_assets FOR DELETE TO waraq_app USING(EXISTS(SELECT 1 FROM waraq_private.invitations i WHERE i.id=invitation AND i.owner=waraq_private.current_uid()));
CREATE POLICY managed_owner ON waraq_private.managed_assets TO waraq_app USING(EXISTS(SELECT 1 FROM waraq_private.assets a WHERE a.id=asset AND a.owner=waraq_private.current_uid())) WITH CHECK(EXISTS(SELECT 1 FROM waraq_private.assets a WHERE a.id=asset AND a.owner=waraq_private.current_uid()));
CREATE POLICY reply_read ON waraq_private.responses FOR SELECT TO waraq_app USING(EXISTS(SELECT 1 FROM waraq_private.invitations i WHERE i.id=invitation AND i.owner=waraq_private.current_uid()));
CREATE POLICY reply_insert ON waraq_private.responses FOR INSERT TO waraq_app WITH CHECK(EXISTS(SELECT 1 FROM waraq_private.invitations i JOIN waraq_private.templates t ON t.id=i.templateid JOIN waraq_private.categories c ON c.id=t.category WHERE i.id=invitation AND i.status='published' AND t.published=1 AND c.published=1 AND (i.settings::jsonb->>'rsvpEnabled')::boolean AND count<= (i.settings::jsonb->>'maxGuests')::integer));
CREATE POLICY report_read ON waraq_private.reports FOR SELECT TO waraq_app USING(waraq_private.is_admin() OR EXISTS(SELECT 1 FROM waraq_private.invitations i WHERE i.id=invitation AND i.owner=waraq_private.current_uid()));
CREATE POLICY report_insert ON waraq_private.reports FOR INSERT TO waraq_app WITH CHECK(EXISTS(SELECT 1 FROM waraq_private.invitations i WHERE i.id=invitation AND i.status='published'));
CREATE POLICY report_update ON waraq_private.reports FOR UPDATE TO waraq_app USING(waraq_private.is_admin()) WITH CHECK(waraq_private.is_admin());
CREATE POLICY report_delete ON waraq_private.reports FOR DELETE TO waraq_app USING(EXISTS(SELECT 1 FROM waraq_private.invitations i WHERE i.id=invitation AND i.owner=waraq_private.current_uid()));
CREATE POLICY receipt_access ON waraq_private.response_receipts TO waraq_app USING(EXISTS(SELECT 1 FROM waraq_private.invitations i WHERE i.id=invitation AND i.status='published')) WITH CHECK(EXISTS(SELECT 1 FROM waraq_private.invitations i WHERE i.id=invitation AND i.status='published' AND (i.settings::jsonb->>'rsvpEnabled')::boolean));
CREATE POLICY audit_admin ON waraq_private.audit TO waraq_app USING(waraq_private.is_admin()) WITH CHECK(waraq_private.is_admin() AND actor=waraq_private.current_uid());

CREATE FUNCTION waraq_private.bind_media() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE src text; BEGIN
 DELETE FROM waraq_private.invitation_assets WHERE invitation=NEW.id;
 FOR src IN SELECT value->>'src' FROM jsonb_array_elements(coalesce(NEW.data::jsonb->'images','[]')) UNION SELECT NEW.data::jsonb#>>'{audio,src}' LOOP
  IF src LIKE '/api/assets/%' THEN INSERT INTO waraq_private.invitation_assets VALUES(NEW.id,substring(src FROM 13)) ON CONFLICT DO NOTHING; END IF;
 END LOOP; RETURN NEW;
END $$;
CREATE TRIGGER bind_media AFTER INSERT OR UPDATE OF data ON waraq_private.invitations FOR EACH ROW EXECUTE FUNCTION waraq_private.bind_media();
CREATE FUNCTION waraq_private.quotas() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF TG_TABLE_NAME='invitations' THEN
  PERFORM 1 FROM waraq_private.users WHERE id=NEW.owner FOR UPDATE;
  IF (SELECT count(*) FROM waraq_private.invitations WHERE owner=NEW.owner)>=500 THEN RAISE EXCEPTION 'INVITATION_LIMIT'; END IF;
 ELSE
  PERFORM 1 FROM waraq_private.users WHERE id=NEW.owner FOR UPDATE;
  IF (SELECT coalesce(sum((bytes::jsonb->>'size')::bigint),0) FROM waraq_private.assets WHERE owner=NEW.owner)+(NEW.bytes::jsonb->>'size')::bigint>200000000 THEN RAISE EXCEPTION 'ASSET_QUOTA'; END IF;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER invitation_quota BEFORE INSERT ON waraq_private.invitations FOR EACH ROW EXECUTE FUNCTION waraq_private.quotas();
CREATE TRIGGER asset_quota BEFORE INSERT ON waraq_private.assets FOR EACH ROW EXECUTE FUNCTION waraq_private.quotas();
CREATE FUNCTION waraq_private.queue_storage_gc() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN INSERT INTO waraq_private.storage_gc VALUES(OLD.bytes::jsonb->>'key') ON CONFLICT DO NOTHING; RETURN OLD; END $$;
CREATE TRIGGER storage_gc AFTER DELETE ON waraq_private.assets FOR EACH ROW EXECUTE FUNCTION waraq_private.queue_storage_gc();
-- All trigger functions are internal; direct execution is not granted to clients.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA waraq_private FROM PUBLIC;
