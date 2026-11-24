-- Supabase-specific storage setup, separate from the PostgreSQL engine schema.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('waraq-trial-private','waraq-trial-private',false,1400000,ARRAY['image/jpeg','image/png','image/webp','audio/mpeg','audio/wav','audio/ogg'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=1400000,allowed_mime_types=EXCLUDED.allowed_mime_types;
-- Existing permissive client policies cannot accidentally expose this bucket.
CREATE POLICY waraq_trial_no_direct_clients ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated
USING(bucket_id<>'waraq-trial-private') WITH CHECK(bucket_id<>'waraq-trial-private');
