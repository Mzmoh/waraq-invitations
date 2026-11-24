# Vercel Hobby / Supabase Free trial — preparation checkpoint

Date: 2026-11-24. Status: LOCAL_TESTS_PASS / SOURCE_UPLOAD_BLOCKED / NOT_DEPLOYED.
This is a development trial, not a commercial release.

## Repository and workspace

Branch: engineering/20261124-vercel-supabase-trial.
Based on engineering/20261124-backup-hardening at ef7d9ba0c7a944e6eabac3af1311280438b81865, which preserves main b0bada68c096bf63d3b088c90213a6b320db06e4 plus unmerged backup fixes.
Main was not merged or changed.

IMPORTANT: this GitHub checkpoint contains documentation only. The adapter source and test files were written and tested in the Windows working directory but could not be read back/committed/uploaded after the executor sandbox configuration failed. Do not deploy this branch expecting the trial adapter to be present yet.

Workspace: C:\Users\Mohammed\Desktop\عرس\animated-invitations-studio.
Preserve all local changes. Do not reset, clean, re-clone over it, or replace it with this remote documentation checkpoint.

## Compatibility and implementation completed locally

No Next.js conversion is needed. Existing HTML/CSS/ES-module frontend remains static. A separate Fetch-based Node function adapts the shared API; the original Node listener, SQLite schema/database and backup tools remain the rollback path.

Local files:
- api/index.mjs; server/trial/handler.mjs, postgres.mjs, storage.mjs
- supabase/migrations/0001_trial.sql, 0002_private_storage.sql, 0003_catalog.sql
- scripts/trial-fixture.mjs, trial-migration.mjs, build-vercel.mjs
- tests/trial/helpers.mjs; routes.test.mjs, migration.test.mjs, storage.test.mjs
- vercel.json; deploy/vercel.env.example; .github/workflows/trial.yml
- docs/TRIAL_HOSTING_PLAN.md
- Minimal shared API/validation/audio-renderer hooks; package.json and syntax-check roots updated.

The last test run used the pre-rename test filenames routes.mjs, migration.mjs and storage.mjs. They were subsequently renamed to *.test.mjs without behavior changes, and the npm script was adjusted. A proposed browser bridge/config test write failed; those files and a new browser acceptance result are not claimed.

## Security boundary

The application retains its existing scrypt hashes, HttpOnly sessions and PIN HMAC secret. Nothing is migrated to Supabase Auth. Cookies cannot transparently cross unrelated domains: preserved session records can be verified on a matching host, while testers normally sign in again at the trial origin.

PostgreSQL tables live in waraq_private, not an exposed Data API schema. The non-owner waraq_app role has no login/bypass-RLS. Every runtime query transaction explicitly sets this role, a fixed search_path and transaction-local session/PIN context. Invitation/media/reply policies enforce ownership and guest access. Auth infrastructure is deliberately trusted-backend-only: its policies permit the server's auth operations, not per-user direct SQL access. Browser anon/authenticated roles have no access to that private schema. No browser SQL endpoint or privileged key is introduced.

Storage bucket waraq-trial-private is private. A restrictive policy denies browser roles even in the presence of other permissive policies. The server-only service-role key accesses storage after API and database authorization, using same-origin /api/assets/:id rather than public/signed object URLs. Integrity, owner/key binding and size are checked. Uploaded audio moves from inline data to private objects. Prior versions remain available for Undo until owner cleanup. Durable storage_gc retries deletion on later API requests; failed/timed-out upload reconciliation still needs operator inspection and hosted failure testing.

TLS database verification remains enabled, transaction-pooler sessions do not depend on persistent SET state, and no named prepared statements are used. Rate limits are database-backed and survive rejected auth requests. Only Vercel's platform client header is trusted when VERCEL=1. A conservative 3 MiB JSON request limit avoids reliance on the larger-payload beta. Trial pages are noindex.

## Executed evidence

| Check | Actual result |
|---|---|
| npm test | 53 passed, 0 failed on existing Node/SQLite suite |
| PostgreSQL trial suite | 17 passed, 0 failed on PGlite 0.5.17 (actual PostgreSQL engine with pgcrypto) |
| Template route exercise | All 80 IDs created, published, fetched as guests and deleted through trial handler |
| Ownership/RLS | Cross-owner private reads/updates denied; forged-owner INSERT rejected by PostgreSQL RLS |
| PIN/media | Protected API/metadata/images/audio, unlock grant, request isolation, PIN rotation |
| Lifecycle | Save/reopen, stale edit, copy, archive/re-publish, delete, CSV, reports, admin visibility/audit |
| Auth/recovery | Original auth/login/logout; mocked delivery reset/verification and session revocation |
| Demo migration | Read-only SQLite source unchanged byte-for-byte; hashes/session/PIN/IDs/media/RSVP retained |
| Migration failure | Injected upload failure rolls DB back and removes newly uploaded trial objects |
| Private bucket policy | Executed on minimal Supabase storage-table stand-ins, including a preexisting permissive policy |
| npm run build:trial | Passed; static output built, 61 JS modules checked |
| npm run build | Passed; Node output and all 80 covers retained |

Evidence remains local in test-results/trial-latest.txt and previous run logs. PGlite was loaded from an installed package without changing the unrelated project's source/data. No network database, pg TLS handshake, real Supabase Storage, Vercel router/CLI deployment, public TLS, actual inbox delivery or physical device was tested. npm pg install and GitHub Actions execution are not claimed. Earlier visual/browser results are historical, not new trial browser acceptance.

A policy-recursion defect discovered during the first trial run was fixed with a narrowly scoped SECURITY DEFINER ownership helper before the successful final run. These are targeted checks, not a declaration that no security issues can exist.

## Executor blocker and resumption

After the successful tests/builds, all local command/file access failed at sandbox initialization:
invalid sandbox permission path: 'file:///workspace' is invalid on 'windows'.
The environment also rejected an alternate shell. This is an executor configuration failure, distinct from account credentials, website DNS and application tests. GitHub connector access continued to work, allowing this documentation checkpoint.

Resume in the same Windows project after repairing/reopening the workspace with Windows-compatible permission roots. First inspect git status and preserve the uncommitted implementation. Fetch this documentation-only checkpoint, reconcile these report changes without overwriting the local adapter, rerun tests/builds using the new *.test.mjs filenames, run browser acceptance, then commit and upload source to this development branch. Do not merge main without owner approval.

## Owner-side trial setup — only after source upload

1. Create/select a separate Supabase Free trial project and Vercel Hobby project. Do not purchase upgrades or reuse a production database. Use Vercel's default vercel.app domain; custom DNS is optional.
2. In Supabase SQL Editor, as postgres, apply 0001_trial.sql, then 0002_private_storage.sql and 0003_catalog.sql to the NEW project. Keep waraq_private absent from Data API exposed schemas. Verify pgcrypto is in extensions and the migration owner bypasses RLS; verify waraq_app cannot bypass it.
3. Obtain Supabase URL, server-only service-role key and Connect > Transaction pooler connection URL (port 6543). URL-encode the database password. Keep keys in Vercel environment variables, never GitHub/chat/public assets.
4. Set WARAQ_TRIAL_ONLY=true, COOKIE_SECURE=true, PUBLIC_ORIGIN=https://the-stable-trial-alias.vercel.app, DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Set WARAQ_TRIAL_PROJECT_REF only for guarded demo imports. Do not use NEXT_PUBLIC_/VITE_ prefixes. Do not point DATABASE_PATH at /tmp.
5. Import repository with Framework Preset Other, Node 24, root animated-invitations-studio only if the GitHub tree actually has that nested folder (currently repository files are at root), build npm run build:trial and output dist/vercel. Deploy the DEVELOPMENT branch, not main. Select a region near the database. Configure separate preview secrets and canonical PUBLIC_ORIGIN for the actual test alias; random preview URLs are not automatically trusted origins.
6. Apply the schema/import before the first auth request (which creates the HMAC secret). No credentials were used or remote migration run by this task.

Synthetic demo commands, after source upload:
```powershell
node scripts/trial-fixture.mjs var/trial-demo.sqlite
node scripts/trial-migration.mjs var/trial-demo.sqlite
# Only with private trial environment loaded and an empty target:
node scripts/trial-migration.mjs var/trial-demo.sqlite --apply-demo
npm test
npm run test:trial
npm run build:trial
npm run build
```

The fixture command refuses existing destinations. Migration source must contain the generated synthetic marker; the importer has no production override. Target project reference/database identity and empty target are checked. Never add that marker to a real database. The dry-run prints counts/digest, not secrets. Actual Supabase import remains unexecuted.

Optional existing Resend integration requires privately configured RESEND_API_KEY and verified MAIL_FROM. Without mail configuration recovery returns an explicit 503. Mocked mail tests do not establish deliverability.

Hosted acceptance still requires health, login/cookie, all template previews, editor/image/audio reopen, PIN metadata denial/unlock, cross-owner API attempts, RSVP/CSV, admin, reset/verification through a real inbox, and public guest link from a separate network. Record actual deployed commit and provider logs without secrets. Vercel preview protection may require approved testers; don't claim a public guest link until checked without your logged-in owner session.

## Rollback

No production source was touched. Retain the original SQLite database and its verified encrypted backup separately. The existing Node/SQLite entry point and backup-hardening checkpoint remain usable. To leave the trial, stop routing testers to its Vercel alias and resume the original Node deployment with its original SQLite data/environment; verify login, photos, PIN and RSVP there. Do not attempt to run SQLite inside Vercel or overwrite SQLite with trial imports.

This is not dual write: data created only in the isolated PostgreSQL trial will not appear automatically in SQLite. Freeze trial writes and export a private trial-only archive if needed before discarding it. Reverse production migration is outside this preparation and requires separate review/approval.

Final status: NOT_DEPLOYED, not commercial READY. No paid service, production migration or main merge performed.
