-- Trial only. Apply after 0001–0003; no production migration is performed by tests.
CREATE INDEX invitations_owner_page_idx ON waraq_private.invitations(owner,updatedat DESC,id DESC);
CREATE INDEX responses_invitation_page_idx ON waraq_private.responses(invitation,createdat DESC,id DESC);
CREATE INDEX assets_owner_idx ON waraq_private.assets(owner);
CREATE INDEX sessions_expires_idx ON waraq_private.sessions(expires);
CREATE INDEX limits_expires_idx ON waraq_private.limits(expires);
CREATE INDEX account_tokens_expires_idx ON waraq_private.account_tokens(expires);
-- An uncorrelated initplan resolves the session once per SQL statement. Keep
-- RLS enabled/FORCEd and the same private/public/PIN boundaries.
DROP POLICY invitation_read ON waraq_private.invitations;
CREATE POLICY invitation_read ON waraq_private.invitations FOR SELECT TO waraq_app USING(owner=(SELECT waraq_private.current_uid()) OR (status='published' AND EXISTS(SELECT 1 FROM waraq_private.templates t JOIN waraq_private.categories c ON c.id=t.category WHERE t.id=templateid AND t.published=1 AND c.published=1) AND (settings::jsonb->>'privacy'<>'pin' OR waraq_private.pin_granted(invitations))));
DROP POLICY reply_read ON waraq_private.responses;
CREATE POLICY reply_read ON waraq_private.responses FOR SELECT TO waraq_app USING(invitation IN(SELECT i.id FROM waraq_private.invitations i WHERE i.owner=(SELECT waraq_private.current_uid())));
