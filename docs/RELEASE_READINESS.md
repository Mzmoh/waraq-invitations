# WARAQ — final production release gate

Date: 2026-11-24. Local checks used Node v26.13.0; the existing Dockerfile targets Node 24, whose actual container runtime remains unverified. **Status: NOT_READY — external release gates remain blocked.**

Continued from verified GitHub main `c22e7d97c4992cb0a39d7e01d076400afeb5a6b7` (confirmed unchanged at start), corresponding local implementation checkpoint `07f67ce`. Existing audits, catalog, features, IDs and user databases were retained. This is a release-gate continuation, not a fresh project audit.

## Decision

| Question | Evidence-based answer |
|---|---|
| Is there a verified public invitation URL? | **No.** Only disposable local HTTP instances were exercised. No hosting server/domain was supplied or deployed. |
| Can real users be accepted now? | **No public production acceptance.** Local functional journeys pass, but external HTTPS, persistent storage, mail delivery and operations remain unverified. |
| Commercial launch ready? | **No.** Do not announce launch or sell production availability yet. |
| Critical vulnerabilities? | No critical issue established in the carried-forward security review and targeted regression tests. This is not a guarantee of absence or a new independent penetration test. Header-based raster validation remains less strong than a bounded maintained decode/re-encode service. |
| Production database stable? | A production database has **not been provisioned or observed**. Local SQLite persistence, ownership, PIN and online snapshot/restore tests pass. Persistent container volume is configured, not instantiated. |

## Completed independent work

- Node/SQLite retained as the release target. Production startup now rejects missing/noncanonical HTTPS PUBLIC_ORIGIN, insecure cookie configuration, in-memory production storage and a database inside the public directory.
- `compose.yaml` and `deploy/Caddyfile` prepare a non-root Node container, a persistent `waraq_data` volume for SQLite **and image BLOBs**, persistent Caddy TLS state, and public ports on Caddy only. Backup utilities are included in the Docker build context/container. Docker is unavailable here, so no image build/start, Compose config execution, TLS issuance or disk restart test is claimed.
- Exact trusted-proxy IP allowlist. The supplied Caddy overwrites `X-Waraq-Client-IP`; Node ignores forged X-Forwarded-For and ignores the custom header from any other peer. An actual HTTP RSVP test proves two clients behind the trusted proxy do not share one rate bucket.
- Direct Resend API adapter using a fixed provider endpoint, server-only Bearer key, verified-sender configuration, bilingual messages, hashed idempotency key, bounded timeout, no redirects and checked provider receipts. Legacy webhook integration retained.
- Password reset and email verification were exercised through their browser UI, the full HTTP service and a **simulated Resend inbox**. The old password is rejected after reset. Raw tokens remain in URL fragments and are removed from browser history. **No real email was sent or received.**
- Self-hosted licensed Arabic fonts: Amiri (classic/luxury), Noto Naskh Arabic (readable/classic) and Noto Kufi Arabic (modern). Exact SIL OFL licenses, pinned upstream blob IDs and provenance are bundled. WOFF conversion preserves the original font tables. All three decoded successfully in Chrome with no external font request.
- WOFF sizes: Amiri 211,884 bytes; Naskh 158,952; Kufi 216,132. `font-display:swap`; fonts load on demand by selected family. Local decode/load samples were 8/9/10 ms on this machine, not mobile-network or production performance claims. Raw TTF regeneration inputs are excluded from production assets.
- Original eight contact sheets containing all 80 existing compositions were inspected again. Motifs, framing and palettes remain coherent and stable; no template ID was changed or bulk artwork replacement attempted. Font consistency and the hidden skip-link rendering were improved. Fresh narrow-screen reveals passed for all 80 templates after font loading. Legacy/advanced font controls were synchronized and tested with Kufi.
- Visual comparison retains the important distinction: current templates are layered vector stationery; the reference videos use photographic texture, dimensional props and richer staged scenes. Screenshot hashes do not establish equal luxury or cinematic quality. Photographic equivalence and commercial art-direction approval are **not claimed**.
- AES-256-GCM snapshot encryption/decryption with random nonce, authenticated format header, a separate operator-provided key and no overwrite. Tests prove exact restoration, wrong-key/tamper rejection and no plaintext output on authentication failure. External encrypted storage remains unconfigured; no upload or independent retention copy exists.

## Executed validation

| Check | Observed result |
|---|---|
| `npm test` | 49 passed, 0 failed after adding trusted-proxy HTTP isolation; includes ownership, PIN, stale writes, recovery races, SQLite restore and authenticated encryption |
| `npm run build` | Passed; 53 JavaScript modules checked, 80 covers retained |
| Main browser suite | 16 passed, 0 failed with self-hosted fonts |
| Finishing browser suite | 7 journeys passed, no uncaught browser exceptions |
| Dashboard browser integration | Passed auth, ownership/admin denial, visibility, PIN, RSVP, QR/PNG, archive and republish |
| Release browser runner | 3 fonts decoded via local HTTP; reset and verification UI with simulated inbox; all 80 reveals at 390 px without horizontal overflow |
| Docker / Compose runtime | Blocked: Docker command and standard Docker Desktop CLI location unavailable. No Docker daemon or Caddy TLS execution tested. Optional YAML parsing also unavailable; configuration was statically inspected only. |
| Physical iPhone/Android | No usable attached device/browser session available to this environment. Desktop emulation is not real-device acceptance. |

Evidence: `test-results/release/`, `test-results/release-gate/results.json`, existing `test-results/template-review/` and `test-results/reference-review/`. Tests use disposable databases and simulated messages, not user invitation data. Production traffic/load, real network LCP/INP, provider delivery and external restore are still unmeasured.

## DNS diagnosis — distinct from the website domain

The local executor returned ENOTFOUND for `github.com`, `git.chatgpt-team.site` and `api.resend.com` on this run. The GitHub connector independently works. These failures identify an **executor network/DNS access problem**, not a demonstrated global outage and not a failure of an owner's website domain.

No WARAQ production hostname or server public IP is configured. Therefore its A/AAAA records, certificate and public guest access cannot yet be tested. A Node/Docker release does not require the Sites source-upload host, and its DNS issue must not be treated as the only missing hosting input.

## Exact owner inputs / remaining gates

1. A hosting server/account with Docker support, persistent disk, public reachability on 80/443 and an operational owner. No paid resources were created.
2. A hostname controlled by the owner and server public IP. Set WARAQ_DOMAIN to the hostname (no scheme/path), ACME_EMAIL, and correct DNS A/AAAA records. PUBLIC_ORIGIN is the matching HTTPS origin. Then build/start Compose and verify the real certificate, secure cookie behavior and a public invitation from a separate network.
3. A Resend account with a verified sending domain/address. Set MAIL_PROVIDER=resend, RESEND_API_KEY and MAIL_FROM privately in server secrets; never commit or paste the key into source files. Run real reset/verification delivery and click-through using an owner-approved test inbox.
4. An external backup storage target/account and privately retained BACKUP_ENCRYPTION_KEY. Export a consistent SQLite snapshot, encrypt it, store a verified independent copy, then perform a restore drill from that external copy. Do not encrypt a live main SQLite file in place of creating a consistent snapshot first.
5. Real iPhone Safari and Android Chrome checks for font layout, audio gestures, image preparation, sharing, PIN and RSVP; production load/performance measurements and an operations/incident contact.
Visual scope: the existing vector direction is retained; no photographic-equivalence claim or artistic quality score is inferred from hashes.

**READY may be assigned only after these relevant external gates have real evidence.** This report deliberately does not claim public deployment, real provider delivery, a stable production disk or commercial launch readiness.
