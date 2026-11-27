# WARAQ — Luxury Cinematic Glass

Historical implementation notes. The current recovery-based cinematic-kit checkpoint, test evidence and local studio are documented in [DESIGN_PROGRESS.md](DESIGN_PROGRESS.md). Hosting statements below describe their original checkpoint, not the current recovered deployment.

Development branch: engineering/20261124-cinematic-glass. No main merge or deployment.

## Delivered interface

The existing static application is retained. The home page now has a Deep Violet editorial composition, Coral primary action, Amber accents, locally served Arabic typography and an original seal/ribbon glass scene. Category art, all 80 template IDs, invitation rendering and the invitation editor are retained. The dashboard uses a light workspace within the violet shell to keep forms readable.

The scene also opens independently at /motion.html. It starts at 6 seconds, 30 fps, 16:9; its controls edit title, supporting text, five scene colors, duration, motion strength and 9:16 format. Controls use native labeled inputs, whole shaped Arabic words in the DOM and textContent for edited text. They customize this showcase, not the identities or saved data of every invitation template. No video encoder/export feature is claimed.

## Optical implementation

Three.js r180/0.180.0 is self-hosted under public/vendor/three with its MIT license and upstream provenance. The renderer loads dynamically only on eligible showcase pages. No CDN, external fonts/HDR, import map or Next.js conversion is needed. A local procedural PMREM room supplies reflection lighting; opaque stationery-inspired seals and ribbon meshes sit behind the glass and participate in Three's physical transmission render pass.

| Parameter | Value |
|---|---|
| Slab outer size | 4.9 × 3.6 × 0.24 world units |
| Outline corner radius | 0.35 |
| Transmission / IOR | 1 / 1.46 |
| Optical thickness / roughness | 0.65 / 0.16 |
| Clearcoat / camera FOV | 1 / 33 degrees |
| Initial rotation / angular speed | -0.22 rad / +0.035 rad per second |
| Vertical drift bound | 0.035 world units |
| Camera speed / travel bound | 0.1 units per second initially, eased within 5% of slab width |
| Readable hold | Last 25%, 4.5–6 seconds at defaults |

RoundedBoxGeometry would clamp the corner radius to half the 0.24 depth. A rounded Shape with a small beveled extrusion preserves the requested planar radius and full outer dimensions instead. Browser inspection measured [4.900000095, 3.599999905, 0.239999995]. This is rasterized physically based transmission/refraction, not offline path-traced caustics.

glass-motion.js provides one deterministic timeline. Slab, forms, camera and text reveal all sample the same clock. Pausing/offscreen visibility excludes elapsed hidden time. Seek supports deterministic capture at frameIndex/30. The final quarter has identical transforms and was compared as identical stage screenshots. Text stays in accessible DOM layers rather than separate Arabic glyph meshes.

Developer entry points: mountGlassScene(host, options) in glass-scene.js; glassDefaults, glassOptions and glassFrame in glass-motion.js. The host's glassController exposes read-only configuration/inspection and seek(seconds) for local review/capture. Optical and motion parameters have explicit bounds; scene palette accepts only six-digit hex colors.

## Progressive rendering

- Reduced Motion, Save-Data, low reported memory (≤4 GiB), ≤2 logical cores, missing/lost WebGL2 or explicit light mode use a static vector/gradient alternative. The alternative is intentionally not presented as physical refraction.
- Reduced Motion/Save-Data/unsupported WebGL were verified to avoid downloading Three's two modules. Existing template/guest pages do not load Three.
- Visible eligible scenes render at a maximum device pixel ratio of 1.5 and sample the configured 30 fps. No shadow maps, remote HDR or continuous particles are added. An early sustained render-cost safeguard falls back to the light view.
- Offscreen/hidden scenes pause; finished scenes stop scheduling frames. Resources, observers and context-loss listeners are cleaned up. Bfcache navigation pauses and resumes instead of disposing a restored page.
- Browser hardware reports are optional/approximate. Software-WebGL and desktop viewport emulation do not establish iPhone/Android performance or production LCP/INP.

## Actual verification

| Check | Result |
|---|---|
| npm test | 56 passed, zero failed, including 3 deterministic motion/clock tests |
| npm run test:trial | 17 PostgreSQL/RLS/migration tests passed using local PGlite |
| Existing Playwright runner | 16 passed; all 80 previews/reveals and editor/signup/publish/guest RSVP retained |
| New cinematic browser runner | 7 passed: actual material/bounds/render calls, customization/9:16, identical hold captures, Reduced Motion/narrow layouts, no-WebGL/Save-Data gates, English LTR/template isolation, no uncaught errors |
| Node and trial static builds | Passed, 68 JS modules checked and 80 covers retained |

Evidence: test-results/cinematic/results.json, home-desktop.png, home-mobile.png, portrait-glass.png, portrait-reduced.png and home-english.png; cinematic unit/build/regression logs. Desktop, mobile fallback and portrait captures were inspected. Browser tests use disposable SQLite; PostgreSQL tests use synthetic data. Existing commercial release gates remain open.

## Resume and deployment boundary

The earlier Windows sandbox-path fault no longer prevents local tools in this session. The existing uncommitted trial adapter was preserved and included as a separate checkpoint before this visual change. No production data was migrated, no purchase made and no main merge authorized. A valid Vercel/Supabase deployment and real public link remain unverified; see VERCEL_SUPABASE_TRIAL.md for setup and rollback boundaries.
