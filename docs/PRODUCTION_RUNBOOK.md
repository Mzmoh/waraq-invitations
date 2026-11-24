# WARAQ production runbook

## Supported deployment choices

The existing Node service and SQLite are the currently validated production build. Use Node 24.2+ with a persistent private filesystem and HTTPS reverse proxy. The existing Worker/D1 adapter is retained; real Worker runtime/D1 deployment must be validated separately. Do not upload a Node server to GitHub Pages: that would remove authentication and persistence.

## Environment and first start

Copy `.env.example` to `.env`, keep it ignored, then configure:

| Setting | Required value |
|---|---|
| `HOST` | `0.0.0.0` inside the server/container behind its firewall/proxy |
| `PORT` | Port supplied by the host, normally 3000 |
| `PUBLIC_ORIGIN` | Actual `https://` domain; required for correct origin checks behind a proxy and account email links |
| `DATABASE_PATH` | Private persistent disk path outside public assets |
| `NODE_ENV` | `production` |
| `COOKIE_SECURE` | `true` for HTTPS production |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | One-time bootstrap; password 12–128 characters. Remove after provisioning and retain recovery access securely |
| `MAIL_DELIVERY_URL` | Optional trusted HTTPS transactional-mail gateway; absent means recovery/verification explicitly unavailable |
| `MAIL_DELIVERY_TOKEN` | Secret Bearer credential for that gateway, never shipped to clients |

The mail gateway receives POST JSON `{to,purpose,url}` and must send the reset/verification email. This code does not pretend an arbitrary provider accepts that schema. Configure a real compatible gateway and test delivery. Links carry single-use tokens in URL fragments, expire after 30 minutes, and are hashed at rest. Email verification is optional; it is not a claim that guest RSVP names are verified identities.

Run `npm test`, `npm run build`, then `npm start`. `/api/health` checks database connectivity without revealing account or configuration data. Log unexpected errors by the `X-Request-ID` returned to clients; logs omit request bodies, email links and database error messages.

The Dockerfile runs as a non-root user and declares `/app/var` as the persistent volume. Configure `PUBLIC_ORIGIN` at deployment. Do not use an ephemeral filesystem for production invitations, uploaded image BLOBs, sessions or PIN HMAC secrets.

## Proxy and abuse controls

Node rate limits intentionally use the direct socket address; behind a reverse proxy this can group visitors into one bucket. Apply trustworthy edge per-client limits before exposing a shared deployment. Never accept arbitrary client-supplied forwarded IP headers as trusted. Worker uses the Cloudflare-provided connecting IP. RSVP receipts prevent accidental retries; they do not verify identities and do not replace edge abuse controls.

## Backup and restore

1. Keep snapshots private. Database backups include personal data, uploaded images, password hashes and the HMAC secret.
2. Run `node scripts/backup.mjs var/invitations.sqlite var/backups/<unique-name>.sqlite`. The snapshot uses SQLite's online backup API and checks integrity and foreign keys. Existing targets are never overwritten.
3. Copy verified snapshots to encrypted independent storage under a documented retention policy. This repository does not provision an external backup account or schedule.
4. For recovery, stop the affected application. Preserve its current database and WAL files. Restore into a **new path** from a verified snapshot, set `DATABASE_PATH` to that path, start the service and verify `/api/health`, owner login, private PIN links, attached images and responses. Do not restore over a live SQLite database.
5. Preserve the stored HMAC secret or existing PIN grants and session behavior will change. The automated restore drill checks persisted rows and the secret. D1 requires its own provider backup/export and restore test; the SQLite drill does not prove D1 recovery.

## Media and editor constraints

- Four raster image slots per invitation, including any custom opening background. Source files: JPG/PNG/WebP, at most 12 MB and 48 MP; browser preparation downsizes and re-encodes before server validation/storage.
- Server validates type headers, dimensions and PNG chunk boundaries. It is not a full maintained cross-format image decoder. For high-risk public uploads, add a bounded decode/re-encode service before expanding accepted formats.
- Prior managed image versions remain within the owner's quota to support Undo. Explicit unused-file cleanup or deletion can remove assets from old Undo history.
- Audio uploads: MP3/WAV/OGG, at most 512 KB, explicit rights confirmation. Original built-in clips and license are in `public/audio/`. Uploaded audio is private invitation data, not a public standalone file; it counts toward database/backup size.
- Current font choices use device font fallbacks. Consistent Naskh/Kufi across iOS/Android requires licensed self-hosted webfont assets; do not copy proprietary Windows fonts into the repository.
- A public or unlisted guest URL can be forwarded by anyone who has it. Choose PIN protection for access control. Archiving and admin disable revoke guest access without deleting owner data.

## API compatibility

PATCH `/api/invitations/:id` requires `expectedUpdatedAt` from the most recent owner GET. Missing values return 428; stale values return 409. Refresh rather than silently overwriting changes. Copy returns a new draft and slug; PIN copies require a new PIN. DELETE requires `{confirm: invitationId}`. CSV export is owner-only and neutralizes spreadsheet formula prefixes.

## Release gates still requiring external evidence

- A pushed source revision and successful deployment response with a real URL.
- HTTPS/DNS/domain and persistent production disk or actual D1 migration.
- Real mail delivery and end-user recovery/verification click-through.
- Real iPhone Safari and Android Chrome audio, upload, sharing and viewport checks. Desktop Chrome mobile emulation is not a substitute.
- Production load/resource budgets, performance measurements and edge per-client limits.

No public production URL has been verified in this finishing session.


## Release-gate additions — 2026-11-24

Use RELEASE_READINESS.md for the current launch decision. Docker is unavailable in this executor; Compose/Caddy have not been run. The optional YAML parser is unavailable too; no configuration-validation pass is claimed.

The supplied compose.yaml keeps the app off host ports, persists all SQLite/image BLOB data in waraq_data and Caddy certificates in caddy_data. Set WARAQ_DOMAIN (hostname only) and ACME_EMAIL privately, point correct A/AAAA records at the server, then run docker compose config, docker compose build and docker compose up -d on the actual host. Confirm that the fixed 172.30.0.0/24 network does not overlap an existing host network. Configure the app and trusted proxy addresses together if changing that subnet. Never publish the app container port directly to untrusted networks with the proxy allowlist configured.

Production startup now enforces canonical HTTPS PUBLIC_ORIGIN, COOKIE_SECURE=true and a persistent database outside public/. Caddy overwrites X-Waraq-Client-IP and Node trusts it only from configured exact TRUSTED_PROXY_IPS. X-Forwarded-For is ignored. This replaces the earlier shared-proxy-bucket limitation for the supplied deployment.

Direct mail: set MAIL_PROVIDER=resend, RESEND_API_KEY, MAIL_FROM (a sender/domain verified in the provider) and PUBLIC_ORIGIN. See https://resend.com/docs/api-reference/emails/send-email for the provider contract. A generic MAIL_DELIVERY_URL webhook remains supported via MAIL_PROVIDER=webhook. No real provider receipt or inbox delivery was tested without credentials.

Arabic fonts are now served locally from /fonts/: Amiri, Noto Naskh Arabic, Noto Kufi Arabic. Licenses and pinned source blob IDs are in public/fonts/. WOFF assets preserve upstream font tables; regeneration inputs are downloaded separately into ignored references/font-sources/. System fallback remains for English stacks.

For encrypted external backups, first create the verified SQLite snapshot using scripts/backup.mjs; then set BACKUP_ENCRYPTION_KEY privately (32 bytes encoded as 64 hex characters) and run node scripts/encrypted-backup.mjs encrypt snapshot.sqlite snapshot.waraqbk. Upload only that encrypted snapshot to an owner-selected private external target. Restore by decrypting into a new path and performing the documented SQLite restore checks. Keep the encryption key in a separate secret store. No external account/upload or automatic scheduling has been configured. Backup commands are included in the app image under /app/scripts/.
