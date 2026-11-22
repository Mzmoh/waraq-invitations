# WARAQ — production gap audit

Audit started 2026-11-22, existing checkout only.

## Protected starting state

- Branch: `main`; HEAD: `e6f39c85f57cbab1c9f7bd1de817b87f247191cd`.
- Existing uncommitted change: `server/index.mjs` entry-point detection. Preserved.
- Remote `origin`: `https://github.com/Mzmoh/waraq-invitations.git`. Remote upload has a different history; do not force-push.
- Existing databases and uploaded images under ignored `var/` must be preserved. Tests use disposable databases.

## Phase A evidence

Executed `npm test`: 36 passed, 0 failed. Executed `npm run build`: passed, 44 modules and 80 covers. These are baseline results, not acceptance of all requested capabilities.

| Area | Observed implementation | Initial classification / remaining work |
|---|---|---|
| Pages | `/`, `/occasions/:category`, `/templates/:id`, `/create/:id`, `/auth`, `/dashboard`, `/dashboard/invitations/:id`, `/i/:slug`, `/admin` | Existing; baseline functional tests pass; fresh visual review pending |
| API | Shared `server/api-portable.mjs`, Node adapter and Worker adapter | Tested ownership, publish/archive, assets, PIN, RSVP, reports, catalog/admin; missing normal copy/delete/export and account recovery |
| Storage | SQLite locally; D1 adapter in Worker; raster assets stored as private BLOBs | Persistent storage exists; restore drill and production provisioning pending |
| Tables | users, sessions, categories, templates, invitations, assets, invitation_assets, managed_assets, responses, reports, limits, secrets, audit | Relations/FKs and image-binding triggers exist; email recovery token lifecycle missing |
| Templates | Eight category modules, ten entries each; IDs derived from English titles | IDs must remain stable. Tests prove distinct vector recipes, not artistic independence or complete visual acceptance |
| Motion | SVG layers and CSS transitions, IntersectionObserver reveals | Opening and countdown exist. Guest replay, richer scene lifecycle and touch response incomplete |
| Editor | Four steps, live preview, IndexedDB guest drafts, authenticated autosave, optimistic concurrency | Missing full typography controls, image rotation/main image/background, hide sections, undo/redo, audio |
| Images | Browser compresses to JPEG; authenticated save converts data URLs to asset records | Limits and private reads tested; managed background/audio binding must preserve privacy |
| Guest links | Random 96-bit slug, draft/archive gating and PIN HMAC grants | Local link works only locally. No online deployment verified |
| Authentication | scrypt passwords, hashed session tokens, HttpOnly/SameSite cookies, role check | Recovery/email delivery missing; no claim of verified email identity |
| RSVP | Stored replies, limits and owner-only list | Duplicate suppression and CSV export missing; names do not verify identity |
| Home | Hero, category grid, featured cards, basic steps | Missing FAQ/features and cross-category search |
| Deployment | Node Dockerfile and Worker/D1 manifest/build | DNS to source host failed in earlier attempts. Credentials, HTTPS origin and remote database still require validation |

## Priority and acceptance

1. B: ownership-safe lifecycle/export, duplicate abuse controls, recovery foundation, proven security findings.
2. C: replay/scene controls and per-template motion characterization without changing IDs.
3. D: safe persisted customization, image tools, audio with explicit user gesture.
4. E: account/guest management and clear discoverability.
5. F: all 80 template contracts and browser checks; do not equate unique signatures with visual quality.
6. G: production build, backup/restore drill, remote deployment only when source and services are actually available.

External apps are supplementary: do not rebuild this existing application in Lovable or replace it with an unrelated Canva/Figma/HeyGen project. No reusable skill is necessary at this point.

## Closing assessment after implementation

| Requirement | Final evidence / classification |
|---|---|
| Eight categories × ten templates | Complete structural catalog and browser-open traversal; 80 fresh artwork captures and eight inspected contact sheets; stable IDs unchanged |
| Individual artwork | Existing layered vector compositions differ in motifs/layout/motion recipes; matrix in TEMPLATE_REVIEW_MATRIX.md. They retain a vector art direction rather than claiming photographic fidelity to reference videos |
| Guest scenes | Opening/reveal/details/countdown/interaction states, replay, skip, pointer parallax, selected celebration particles and reduced-motion cleanup implemented; Chrome journeys pass |
| Typography | Persisted size/weight/alignment/colors/spacing and five font stacks implemented; consistent hosted Arabic webfonts still missing |
| Images | Rotation, main image, opening background role, replacement, focus/zoom and private persistence pass browser roundtrip. Four shared image/background slots remain a deliberate limit |
| Audio | Two original licensed generated clips, bounded rights-confirmed upload, volume/loop and explicit play implemented; actual iOS/Android policy checks pending |
| Undo/Redo | 20 snapshots, no PIN snapshotting; roundtrip browser test passes. Explicit unused-file cleanup warns that old Undo images may be removed |
| Account recovery and verification | Single-use hashed expiring tokens, session revocation, race regression and UI implemented/tested; real delivery blocked until a compatible mail gateway and HTTPS origin are configured |
| Copy/delete/archive/CSV | Implemented and ownership tested, including new PIN for protected copies, report cleanup, scoped image deletion and formula-safe CSV |
| RSVP abuse | Existing persistent limits plus receipt idempotency and honeypot; retry protection tested. Anonymous names remain unverified; production edge limits required behind a proxy |
| Concurrency | PATCH now requires expectedUpdatedAt; missing/stale requests are rejected. In-flight obsolete password reset cannot consume a newer token |
| Asset parsing | Header-only fabricated PNG rejected; PNG chunk boundaries checked. Full cross-format decode/re-encode remains a production-hardening gap |
| Backup/restore | Online SQLite snapshot and restore drill pass, including HMAC secret preservation; external encrypted storage/retention and D1 recovery not provisioned |
| Node production build | Passed with 49 syntax-checked JavaScript modules; health endpoint and sanitized request IDs added |
| Worker build/platform | Blocked: esbuild unavailable and npm registry DNS ENOTFOUND. Existing Worker bundle must not be presented as a fresh verified build. D1 runtime still unverified |
| Online production URL | Blocked: git.chatgpt-team.site DNS fails; no new live URL or successful deployment exists |
| Real device compatibility/performance | Desktop Chrome and emulated mobile checks passed; actual Safari/iOS, Android devices, LCP/INP and production load remain unmeasured |

Final verified commands: `npm test` 44/44, `npm run build` passed, `tests/browser.mjs` 16/16, `tests/finishing-browser.mjs` 7/7 and the dashboard integration runner passed. Full acceptance is **not closed** until the external release gates above are resolved. No runtime database, user invitation, template ID, or reference video was removed.
