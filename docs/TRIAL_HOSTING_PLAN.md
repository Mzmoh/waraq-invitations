# Vercel Hobby / Supabase Free trial

Development branch: engineering/20261124-vercel-supabase-trial, based on the unmerged backup-hardening branch. No main merge, purchase or production migration is authorized.

## Compatibility decision

The browser application is already static HTML/CSS/ES modules. No Next.js conversion is necessary. Vercel supports a Node request handler, but the existing long-running listener and writable SQLite database are unsuitable for persistent serverless data. Keep them as the original deployment and rollback path; add a separate Fetch handler and PostgreSQL adapter.

Use one Node function and the existing static assets. Keep conservative 3 MiB request handling rather than depending on Vercel's larger-payload public beta. Compressed editor images plus bounded audio fit this limit. Keep media in a private Supabase bucket, with same-origin authenticated asset proxying and no public object URL.

Retain WARAQ scrypt password hashes and HttpOnly session cookies. Do not insert them into Supabase Auth or assume password compatibility. PostgreSQL RLS uses the hash of the verified application's session token, not a client-supplied owner ID. Private auth tables are accessible only to the trusted backend role and are never exposed through Supabase Data API. Non-owner runtime role and FORCE RLS protect invitation/media/reply ownership independently of API filtering.

Apply schema only to a separate empty trial project. The migration planner must accept generated demo fixtures only, preserve identities/session hashes/PIN HMAC secrets and retain the original SQLite source unchanged. Hosted migration and provider verification need owner-configured trial credentials. Local PostgreSQL-engine tests do not substitute for a real Supabase/Vercel deployment.

Official references checked:
- https://vercel.com/docs/functions/runtimes/node-js
- https://vercel.com/docs/functions/limitations
- https://vercel.com/changelog/vercel-functions-now-support-request-bodies-up-to-20mib
- https://vercel.com/docs/plans/hobby
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/storage/security/access-control
