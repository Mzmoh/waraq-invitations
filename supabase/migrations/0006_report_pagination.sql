CREATE FUNCTION waraq_private.admin_report_page(after_time text,after_id text,page_limit integer)
RETURNS TABLE(id text,slug text,reason text,status text,createdat text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT r.id,i.slug,r.reason,r.status,r.createdat FROM waraq_private.reports r JOIN waraq_private.invitations i ON i.id=r.invitation
 WHERE waraq_private.is_admin() AND (after_time IS NULL OR r.createdat<after_time OR (r.createdat=after_time AND r.id<after_id))
 ORDER BY r.createdat DESC,r.id DESC LIMIT least(greatest(page_limit,1),101)
$$;
REVOKE ALL ON FUNCTION waraq_private.admin_report_page(text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION waraq_private.admin_report_page(text,text,integer) TO waraq_app;
