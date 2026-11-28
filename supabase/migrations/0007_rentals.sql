-- WARAQ rental branch. Apply to a disposable staging database first.
BEGIN;
ALTER TABLE waraq_private.invitations ADD COLUMN rental_until timestamptz;
CREATE TABLE waraq_private.rental_requests (
 id uuid PRIMARY KEY,
 invitation text REFERENCES waraq_private.invitations ON DELETE SET NULL,
 owner text NOT NULL REFERENCES waraq_private.users,
 title text NOT NULL,
 days integer NOT NULL CHECK (days BETWEEN 1 AND 365),
 note text NOT NULL CHECK (length(note)<=1000),
 created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','approved','rejected')),
 decided_by text REFERENCES waraq_private.users,
 decided_at timestamptz,
 ends_at timestamptz,
 settlement_ref text,
 CHECK ((state='pending')=(decided_at IS NULL)),
 CHECK ((decided_at IS NULL)=(decided_by IS NULL)),
 CHECK ((state='approved')=(ends_at IS NOT NULL AND settlement_ref IS NOT NULL))
);
CREATE UNIQUE INDEX rental_one_pending ON waraq_private.rental_requests(invitation) WHERE state='pending';
CREATE INDEX rental_invitation_history ON waraq_private.rental_requests(invitation,created_at DESC,id DESC);
CREATE INDEX rental_review_page ON waraq_private.rental_requests(state,created_at DESC,id DESC);
CREATE TABLE waraq_private.social_links (
 platform text PRIMARY KEY CHECK (platform IN ('instagram','tiktok','whatsapp')),
 url text NOT NULL
);
CREATE TABLE waraq_private.custom_templates (
 id text PRIMARY KEY REFERENCES waraq_private.templates,
 base_id text NOT NULL REFERENCES waraq_private.templates,
 title_ar text NOT NULL,
 title_en text NOT NULL,
 background text NOT NULL CHECK (background ~ '^#[0-9a-f]{6}$'),
 accent text NOT NULL CHECK (accent ~ '^#[0-9a-f]{6}$')
);
ALTER TABLE waraq_private.rental_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE waraq_private.rental_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE waraq_private.social_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE waraq_private.social_links FORCE ROW LEVEL SECURITY;
ALTER TABLE waraq_private.custom_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE waraq_private.custom_templates FORCE ROW LEVEL SECURITY;
GRANT SELECT ON waraq_private.rental_requests,waraq_private.social_links,waraq_private.custom_templates TO waraq_app;
GRANT INSERT,UPDATE,DELETE ON waraq_private.social_links TO waraq_app;
CREATE POLICY rental_read ON waraq_private.rental_requests FOR SELECT TO waraq_app
 USING (owner=(SELECT waraq_private.current_uid()) OR (SELECT waraq_private.is_admin()));
CREATE POLICY social_read ON waraq_private.social_links FOR SELECT TO waraq_app USING (true);
CREATE POLICY social_admin ON waraq_private.social_links FOR ALL TO waraq_app
 USING ((SELECT waraq_private.is_admin())) WITH CHECK ((SELECT waraq_private.is_admin()));
CREATE POLICY custom_read ON waraq_private.custom_templates FOR SELECT TO waraq_app
 USING ((SELECT waraq_private.is_admin()) OR EXISTS (
 SELECT 1 FROM waraq_private.templates t JOIN waraq_private.categories c ON c.id=t.category
 WHERE t.id=custom_templates.id AND t.published=1 AND c.published=1) OR EXISTS (
 SELECT 1 FROM waraq_private.invitations i WHERE i.templateid=custom_templates.id AND i.owner=waraq_private.current_uid()));

-- NULL keeps pre-existing published links alive. New publication always has a deadline.
CREATE FUNCTION waraq_private.link_open(status text, deadline timestamptz)
 RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT status='published' AND (deadline IS NULL OR deadline>statement_timestamp())
$$;
CREATE OR REPLACE FUNCTION waraq_private.guest_metadata(s text)
 RETURNS TABLE(id text,slug text,templateid text,pinhash text,data text,settings text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT i.id,i.slug,i.templateid,i.pinhash,'{}'::text,'{"privacy":"pin"}'::text
 FROM waraq_private.invitations i JOIN waraq_private.templates t ON t.id=i.templateid
 JOIN waraq_private.categories c ON c.id=t.category
 WHERE i.slug=s AND waraq_private.link_open(i.status,i.rental_until)
 AND t.published=1 AND c.published=1 AND i.settings::jsonb->>'privacy'='pin'
$$;
DROP POLICY invitation_read ON waraq_private.invitations;
CREATE POLICY invitation_read ON waraq_private.invitations FOR SELECT TO waraq_app USING (
 owner=(SELECT waraq_private.current_uid()) OR (
 waraq_private.link_open(status,rental_until) AND EXISTS (
 SELECT 1 FROM waraq_private.templates t JOIN waraq_private.categories c ON c.id=t.category
 WHERE t.id=templateid AND t.published=1 AND c.published=1)
 AND (settings::jsonb->>'privacy'<>'pin' OR waraq_private.pin_granted(invitations))));
DROP POLICY asset_read ON waraq_private.assets;
CREATE POLICY asset_read ON waraq_private.assets FOR SELECT TO waraq_app USING (
 owner=(SELECT waraq_private.current_uid()) OR EXISTS (
 SELECT 1 FROM waraq_private.invitation_assets a JOIN waraq_private.invitations i ON i.id=a.invitation
 WHERE a.asset=assets.id AND waraq_private.link_open(i.status,i.rental_until)));
DROP POLICY reply_insert ON waraq_private.responses;
CREATE POLICY reply_insert ON waraq_private.responses FOR INSERT TO waraq_app WITH CHECK (EXISTS (
 SELECT 1 FROM waraq_private.invitations i JOIN waraq_private.templates t ON t.id=i.templateid
 JOIN waraq_private.categories c ON c.id=t.category WHERE i.id=invitation
 AND waraq_private.link_open(i.status,i.rental_until) AND t.published=1 AND c.published=1
 AND (i.settings::jsonb->>'privacy'<>'pin' OR waraq_private.pin_granted(i))
 AND (i.settings::jsonb->>'rsvpEnabled')::boolean AND count<=(i.settings::jsonb->>'maxGuests')::integer));
DROP POLICY report_insert ON waraq_private.reports;
CREATE POLICY report_insert ON waraq_private.reports FOR INSERT TO waraq_app WITH CHECK (EXISTS (
 SELECT 1 FROM waraq_private.invitations i JOIN waraq_private.templates t ON t.id=i.templateid
 JOIN waraq_private.categories c ON c.id=t.category WHERE i.id=invitation
 AND waraq_private.link_open(i.status,i.rental_until) AND t.published=1 AND c.published=1
 AND (i.settings::jsonb->>'privacy'<>'pin' OR waraq_private.pin_granted(i))));
DROP POLICY receipt_access ON waraq_private.response_receipts;
CREATE POLICY receipt_access ON waraq_private.response_receipts TO waraq_app USING (EXISTS (
 SELECT 1 FROM waraq_private.invitations i WHERE i.id=invitation
 AND waraq_private.link_open(i.status,i.rental_until)
 AND (i.settings::jsonb->>'privacy'<>'pin' OR waraq_private.pin_granted(i))))
 WITH CHECK (EXISTS (
 SELECT 1 FROM waraq_private.invitations i JOIN waraq_private.templates t ON t.id=i.templateid
 JOIN waraq_private.categories c ON c.id=t.category WHERE i.id=invitation
 AND waraq_private.link_open(i.status,i.rental_until) AND t.published=1 AND c.published=1
 AND (i.settings::jsonb->>'privacy'<>'pin' OR waraq_private.pin_granted(i))
 AND (i.settings::jsonb->>'rsvpEnabled')::boolean));

CREATE FUNCTION waraq_private.rental_guard() RETURNS trigger LANGUAGE plpgsql
 SET search_path=pg_catalog AS $$
BEGIN
 IF current_user<>'waraq_app' THEN
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'draft' OR NEW.rental_until IS NOT NULL THEN RAISE SQLSTATE 'P4201'; END IF;
  RETURN NEW;
 END IF;
 IF EXISTS (SELECT 1 FROM waraq_private.rental_requests r WHERE r.invitation=OLD.id AND r.state='pending') THEN
  RAISE SQLSTATE 'P4202';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF NEW.rental_until IS DISTINCT FROM OLD.rental_until OR NEW.slug<>OLD.slug OR
  (NEW.status='published' AND OLD.status<>'published') THEN RAISE SQLSTATE 'P4201'; END IF;
 IF OLD.rental_until IS NOT NULL AND waraq_private.link_open(OLD.status,OLD.rental_until)
 AND (NEW.data,NEW.settings,NEW.pinhash,NEW.templateid) IS DISTINCT FROM
     (OLD.data,OLD.settings,OLD.pinhash,OLD.templateid) THEN RAISE SQLSTATE 'P4202'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER rental_guard BEFORE INSERT OR UPDATE OR DELETE ON waraq_private.invitations
 FOR EACH ROW EXECUTE FUNCTION waraq_private.rental_guard();

CREATE FUNCTION waraq_private.request_rental(inv text, expected text, request_id uuid, duration integer, memo text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE item waraq_private.invitations; previous waraq_private.rental_requests;
BEGIN
 SELECT * INTO item FROM waraq_private.invitations
 WHERE id=inv AND owner=waraq_private.current_uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE SQLSTATE 'P4203'; END IF;
 SELECT * INTO previous FROM waraq_private.rental_requests WHERE invitation=inv AND state='pending';
 IF FOUND THEN
  IF previous.days=duration AND previous.note=memo THEN RETURN previous.id; END IF;
  RAISE SQLSTATE 'P4202';
 END IF;
 IF item.updatedat IS DISTINCT FROM expected OR waraq_private.link_open(item.status,item.rental_until) THEN
  RAISE SQLSTATE 'P4202';
 END IF;
 IF nullif(btrim(item.data::jsonb->>'title'),'') IS NULL OR nullif(item.data::jsonb->>'startAt','') IS NULL THEN
  RAISE SQLSTATE 'P4201';
 END IF;
 PERFORM 1 FROM waraq_private.templates t JOIN waraq_private.categories c ON c.id=t.category
  WHERE t.id=item.templateid AND t.published=1 AND c.published=1 FOR SHARE OF t,c;
 IF NOT FOUND THEN RAISE SQLSTATE 'P4202'; END IF;
 INSERT INTO waraq_private.rental_requests(id,invitation,owner,title,days,note)
 VALUES(request_id,inv,item.owner,coalesce(nullif(item.data::jsonb->>'title',''),inv),duration,memo);
 RETURN request_id;
END $$;

CREATE FUNCTION waraq_private.decide_rental(request_id uuid, verdict text, reference text, fresh_slug text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ticket waraq_private.rental_requests; item waraq_private.invitations; decision_time timestamptz; deadline timestamptz;
BEGIN
 IF NOT waraq_private.is_admin() THEN RAISE SQLSTATE 'P4204'; END IF;
 -- Lock order matches submission. The invitation lock also serializes edit/delete.
 SELECT * INTO ticket FROM waraq_private.rental_requests WHERE id=request_id;
 IF NOT FOUND THEN RAISE SQLSTATE 'P4203'; END IF;
 SELECT * INTO item FROM waraq_private.invitations WHERE id=ticket.invitation FOR UPDATE;
 SELECT * INTO ticket FROM waraq_private.rental_requests WHERE id=request_id FOR UPDATE;
 IF ticket.state<>'pending' THEN
  IF ticket.state=verdict AND (verdict='rejected' OR ticket.settlement_ref=reference) THEN RETURN ticket.state; END IF;
  RAISE SQLSTATE 'P4202';
 END IF;
 IF verdict NOT IN ('approved','rejected') THEN RAISE SQLSTATE 'P4201'; END IF;
 decision_time := clock_timestamp();
 IF verdict='approved' THEN
  IF reference IS NULL OR length(btrim(reference)) NOT BETWEEN 1 AND 120
   OR fresh_slug IS NULL OR fresh_slug !~ '^[a-zA-Z0-9_-]{22}$'
   OR item.id IS NULL OR waraq_private.link_open(item.status,item.rental_until) THEN RAISE SQLSTATE 'P4201'; END IF;
  PERFORM 1 FROM waraq_private.templates t JOIN waraq_private.categories c ON c.id=t.category
   WHERE t.id=item.templateid AND t.published=1 AND c.published=1 FOR SHARE OF t,c;
  IF NOT FOUND THEN RAISE SQLSTATE 'P4202'; END IF;
  decision_time := clock_timestamp();
  deadline := decision_time + ticket.days * interval '24 hours';
  UPDATE waraq_private.invitations SET status='published',slug=fresh_slug,rental_until=deadline,
   updatedat=to_char(greatest(decision_time,item.updatedat::timestamptz+interval '1 millisecond') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
   WHERE id=item.id;
 END IF;
 UPDATE waraq_private.rental_requests SET state=verdict,decided_by=waraq_private.current_uid(),
  decided_at=decision_time,ends_at=deadline,settlement_ref=CASE WHEN verdict='approved' THEN reference END
 WHERE id=request_id;
 INSERT INTO waraq_private.audit VALUES('rental_'||verdict,waraq_private.current_uid(),request_id::text,decision_time::text);
 RETURN verdict;
END $$;

CREATE FUNCTION waraq_private.admin_rental_overview()
 RETURNS TABLE(accounts bigint,invitations bigint,pending bigint,live bigint)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT (SELECT count(*) FROM waraq_private.users),
  (SELECT count(*) FROM waraq_private.invitations),
  (SELECT count(*) FROM waraq_private.rental_requests WHERE state='pending'),
  (SELECT count(*) FROM waraq_private.invitations i JOIN waraq_private.templates t ON t.id=i.templateid
   JOIN waraq_private.categories c ON c.id=t.category WHERE i.rental_until IS NOT NULL
   AND waraq_private.link_open(i.status,i.rental_until) AND t.published=1 AND c.published=1)
 WHERE waraq_private.is_admin()
$$;
CREATE FUNCTION waraq_private.admin_rental_detail(request_id uuid)
 RETURNS TABLE(templateid text,message text,start_at text,time_zone text,place text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT i.templateid,i.data::jsonb->>'message',i.data::jsonb->>'startAt',
  i.data::jsonb->>'timeZone',i.data::jsonb->>'place'
 FROM waraq_private.rental_requests r JOIN waraq_private.invitations i ON i.id=r.invitation
 WHERE waraq_private.is_admin() AND r.id=request_id AND r.state='pending'
$$;
CREATE FUNCTION waraq_private.admin_rental_accounts(after_id text, page_size integer)
 RETURNS TABLE(id text,email text,role text,invitation_count bigint)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT u.id,u.email,u.role,(SELECT count(*) FROM waraq_private.invitations i WHERE i.owner=u.id)
 FROM waraq_private.users u WHERE waraq_private.is_admin() AND u.id>after_id
 ORDER BY u.id LIMIT least(greatest(page_size,1),101)
$$;
CREATE FUNCTION waraq_private.admin_rental_invitations(after_id text, account text, page_size integer)
 RETURNS TABLE(id text,email text,title text,templateid text,status text,rental_until timestamptz,link_active boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT i.id,u.email,i.data::jsonb->>'title',i.templateid,i.status,i.rental_until,
  waraq_private.link_open(i.status,i.rental_until) AND t.published=1 AND c.published=1
 FROM waraq_private.invitations i JOIN waraq_private.users u ON u.id=i.owner
 JOIN waraq_private.templates t ON t.id=i.templateid JOIN waraq_private.categories c ON c.id=t.category
 WHERE waraq_private.is_admin() AND i.id>after_id AND (account IS NULL OR i.owner=account)
 ORDER BY i.id LIMIT least(greatest(page_size,1),101)
$$;
CREATE FUNCTION waraq_private.create_rental_template(new_id text, base text, ar text, en text, bg text, tint text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT waraq_private.is_admin() THEN RAISE SQLSTATE 'P4204'; END IF;
 INSERT INTO waraq_private.templates(id,category,published)
 SELECT new_id,t.category,0 FROM waraq_private.templates t WHERE t.id=base AND t.id NOT LIKE 'custom-%';
 IF NOT FOUND THEN RAISE SQLSTATE 'P4203'; END IF;
 INSERT INTO waraq_private.custom_templates VALUES(new_id,base,ar,en,bg,tint);
 INSERT INTO waraq_private.audit VALUES('template_created',waraq_private.current_uid(),new_id,statement_timestamp()::text);
END $$;
REVOKE ALL ON FUNCTION waraq_private.link_open(text,timestamptz),waraq_private.rental_guard(),
 waraq_private.request_rental(text,text,uuid,integer,text),waraq_private.decide_rental(uuid,text,text,text),
 waraq_private.admin_rental_overview(),waraq_private.admin_rental_detail(uuid),
 waraq_private.admin_rental_accounts(text,integer),waraq_private.admin_rental_invitations(text,text,integer),
 waraq_private.create_rental_template(text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION waraq_private.link_open(text,timestamptz),
 waraq_private.request_rental(text,text,uuid,integer,text),waraq_private.decide_rental(uuid,text,text,text),
 waraq_private.admin_rental_overview(),waraq_private.admin_rental_detail(uuid),
 waraq_private.admin_rental_accounts(text,integer),waraq_private.admin_rental_invitations(text,text,integer),
 waraq_private.create_rental_template(text,text,text,text,text,text) TO waraq_app;
COMMIT;
