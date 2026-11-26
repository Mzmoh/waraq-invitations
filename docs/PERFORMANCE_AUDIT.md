# Performance audit — measured development checkpoint

Report: 2026-11-26. Baseline: local `b10f352`, content corresponding to remote cinematic commit `7ff6986ba626fefdff6ca0c87bf1dbd94e93665f`. Measurements were collected during the continuing development session; original artifact timestamps and per-run observations are retained in [measurements.json](performance/measurements.json). This is not hosted production acceptance.

## Browser conditions and observations

Chrome 158.0.8127.37, Windows 10.0.26300, Intel i5-12400F; Node v26.13.0, disposable local SQLite HTTP server. CDP DevTools Slow 4G: 562.5 ms latency, 180,000 bytes/s download, 84,375 bytes/s upload; CPU throttled 4×. Viewport 390×844, DPR 1, Arabic, fresh context and disabled cache for every run. Three runs per route and version. Software WebGL is permitted for this desktop experiment. These are not physical phone measurements.

LCP uses PerformanceObserver, CLS uses session windows excluding recent input. Event Timing interaction IDs provide a **lab interaction sample**, not field INP/p75 or CrUX. Transfer includes navigation and resources recorded by the runner. Frame gaps use requestAnimationFrame during initial loading and interaction; they are not compositor FPS. The Chromium preset is defined in [NetworkManager.ts](https://github.com/ChromeDevTools/devtools-frontend/blob/main/front_end/core/sdk/NetworkManager.ts).

| Median / observation | Home before | Home after | Gallery before | Gallery after |
|---|---:|---:|---:|---:|
| LCP, ms | 5260 | 2836 | 5976 | 3932 |
| CLS | 0.28538 | 0.03163 | 0.28538 | 0.00233 |
| Lab interaction sample, ms | 40 | 40 | 64 | 48 |
| Worst lab interaction across three runs, ms | 40 | **424** | 384 | 88 |
| TTFB, ms | 562.6 | 562.6 | 562.6 | 562.5 |
| Transferred bytes | 1,303,464 | 604,618 | 701,240 | 448,044 |
| rAF gap p95, ms | 16.8 | 16.8 | 16.8 | 16.8 |
| Largest rAF gap across runs, ms | 284.3 | **618.9** | 334.5 | 217.3 |

TTFB is dominated by network emulation; no server TTFB improvement is established. Home cold interaction/frame regressions remain open, and their cause is not proven. Final home LCP samples: 2996, 2836, 2816 ms; interaction samples: 424, 40, 40 ms. Gallery LCP: 3948, 3932, 3932 ms; interaction samples: 88, 48, 48 ms. Do not describe animation as uniformly improved or the trial as meeting field Core Web Vitals. An intermediate excessive-module-preload experiment worsened LCP and was rejected; its full observations are preserved too.

Changes: metadata-only catalog on browsing routes; full artwork registry on preview/editor demand; reuse/filter existing tiles; four measured module preloads; constrained font priority; critical header/app dimensions; public text gzip/ETag. Visible occasion imagery remains eager; only offscreen content is lazy. The featured guest image remains high priority. No AI feature was added, so no AI streaming was introduced.

## PostgreSQL EXPLAIN and bounded reads

Actual PostgreSQL 18.7 via PGlite 0.5.17/WASM, not hosted Supabase. Synthetic fixture: four owners, 600 invitations, 12,000 replies (20 each), 4,000-character messages. EXPLAIN ANALYZE BUFFERS FORMAT JSON, query text, plan nodes and samples: [before](performance/postgres-before.json), [indexes/RLS](performance/postgres-indices.json), [paged](performance/postgres-after.json).

| Observation | Original | Original query + indexes/RLS | New bounded page |
|---|---:|---:|---:|
| EXPLAIN execution, ms | 43.097 | 11.693 | 6.905 |
| Warm API list wall median, ms | 41.2058 | 10.2226 | 8.3202 |
| Returned rows | 150 | 150 | 30 |
| Response bytes | 44,843 | — | 9,089 |

The first two columns perform the same-sized query. The last performs less work by design and is not a like-for-like unlimited-list speed comparison. Invitation index uses owner/updatedAt/id, replies use invitation/createdAt/id. RLS computes owned invitations once instead of repeating the ownership lookup per reply. Old reply aggregate repeated 150 times and its ownership lookup 3,000 times; new page reads 31 lookahead rows and aggregates its replies once. Required list fields replace full invitation JSON.

Keyset pagination uses descending timestamp **and ID**, bounded limits, validated cursors, explicit status filtering and full-state totals. Responses and admin reports are also bounded. List wire SQL commands increased 6→7 because totals are now included; no claim of fewer total list commands is made. Independent selects share one transaction without concurrent BEGIN operations on a single connection.

The same four existing photo references required four ownership SELECTs/48 wire commands before and one SELECT/30 commands afterward. This is the measured N+1 removal; ownership checks remain enforced. Warm samples and exact query counts are in measurements.json. Other media cleanup/binding paths use set-based queries. PostgreSQL FORCE RLS and backend role boundaries remain active. No production database migration was run.

## Images, caching and UI feedback

Same 1400×933, 187,102-byte stationery input, Chrome canvas at CPU 4×, three runs:

| Observation | Original | New |
|---|---:|---:|
| Main encoded image bytes | 195,072 JPEG | 146,966 WebP |
| Responsive variant bytes | none | 28,066 (480 px) |
| Total encoded output bytes | 195,072 | 175,032 |
| Serialized payload characters | 260,161 | 233,517 |
| Encode wall median, ms | 125.6 | **248.6** |

Encoding latency regressed because alternative formats and a responsive source require more work. Async Blob encoding reduces warm long-task durations (107/108→81/87 ms), but cold long task worsened 309→402 ms. This is an open device-performance limitation, not a zero-stall claim. A more expensive two-variant design was discarded. AVIF is accepted as input where the browser decodes it; **AVIF output encoding is not implemented**. Actual guest selection at 390 px/DPR1 chose the 480 px private source: 28,066 encoded bytes / 28,366 transfer bytes. PIN denied it before unlock.

Main images and variants preserve ownership, canonical private URLs and transactional binding. API, guest/private media responses use no-store and CDN no-store. Public static files use bounded gzip cache, weak ETag, revalidation and Vary: Accept-Encoding. Vercel routing/cache rules are prepared; real edge behavior is unverified.

Auth/list requests overlap. Slow operations show skeletons after 180 ms; fast operations do not flash. Report resolution alone uses optimistic state, disables repeat submission and rolls back on injected 503. Publishing/privacy/deletion still await server confirmation. Filter/load-more race guards prevent appending results into the wrong view.

## Reproduction and scope

Install the lockfile dependencies in an authorized environment. Use disposable data only. Set PLAYWRIGHT_MODULE / PGLITE_MODULE to installed package locations if packages are supplied by the runtime. SHARP_MODULE is optional for visual sheets.

```sh
node scripts/perf-postgres.mjs before
node scripts/perf-postgres.mjs indices
node scripts/perf-postgres.mjs after
node scripts/perf-ownership.mjs
node scripts/perf-images.mjs before
node scripts/perf-images.mjs after
# For browser before, PERF_APP_ROOT must point to the preserved baseline checkout.
node scripts/perf-browser.mjs before
node scripts/perf-browser.mjs after
node tests/performance-browser.mjs
```

Frozen original API/photo implementations and baseline main-file hash are under benchmarks/baseline. The browser runner refuses a mislabeled baseline main file. Raw local artifacts are under test-results/performance; the committed measurements file retains observations and conditions for review. Benchmarks must run without simultaneous browser suites for comparable timing.

Changed areas: server/api-portable, pagination, database/auth/static-performance, trial handler/PostgreSQL, validation/store and SQLite migrations; Supabase migrations 0004–0006; Worker adapter; main/dashboard/editor/invitation; async UI and catalog; build scripts/Vercel rules; benchmarks and tests. No template ID, account hash, PIN secret, invitation data, original SQLite entry point or main branch was replaced.

Open gates: cold home interaction trace/fix and physical-device validation; faster off-main-thread image encoding evaluation; real Supabase network EXPLAIN/load, pg TLS/pooler, Storage and Vercel CDN/HTTPS; field INP and external public guest acceptance. The optional legacy Worker build is currently blocked by missing esbuild, while Node/Vercel static builds are separately checked. See TEST_RESULTS.md and RELEASE_READINESS.md for acceptance status.
