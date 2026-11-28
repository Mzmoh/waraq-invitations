# WARAQ — design and engine checkpoint

## Art direction and tokens

Preserve the existing invitation atelier: deep `#221b49`, paper `#fff5f1`, coral `#ff675f`, amber `#ffbc66`, violet `#7059f3`. Existing Amiri headings and Noto Naskh text stay shaped as complete lines/words. Layout uses the existing symmetric max-1320px grid and responsive gutters (48px desktop, 16px phone). Hero expresses stationery, seals and ribbon; the real templates remain the central product imagery. No external brand, invented testimonials, statistics or product artwork.

Material defaults stay in `public/glass-motion.js`: slab 4.9×3.6×0.24, radius .35, transmission 1, IOR 1.46, thickness .65, roughness .16, clearcoat 1, FOV 33°, rotation -.22rad, initial rotation speed .035rad/s, bounded .035 vertical drift and bounded camera lateral motion .1 units/s initially. These belong to the showcase, not every template.

Motion: intro 1600ms / safety removal 1750ms; headline/section reveals 650ms with 55ms stagger across whole elements; ordinary native page transition 180–320ms; app field feedback 160ms, no perpetual table motion. Browser reduced-motion preference disables nonessential intro/reveals/parallax/route animation; content remains present. All interactive controls remain HTML, with visible keyboard focus, touch press state and pause for continuous motion.

## Two optical scenes, different responsibilities

`public/glass-scene.js` extends the existing Three renderer. MeshPhysicalMaterial refracts meshes behind the slab through Three's transmission render target. A procedural PMREM room supplies environment lighting. The same motion clock drives pose, pointer offset and scroll offset. `interactive:true` keeps the home scene alive after the six-second entrance; the standalone `/motion.html` retains its deterministic final reading hold. Resize/offscreen/visibility/pause/disposal remain bounded. Startup measured draw cost can lower DPR from high to .75 and then use a light fallback if still too costly. This is rasterized PBR transmission, not path tracing or live capture of arbitrary HTML.

`dev/optical-proof.js` is a separate developer comparison with one WebGL2 context:

1. Procedural grid/disc shader writes to an RGBA texture attached to an FBO.
2. Rounded SDF and finite-difference bevel normals determine displacement.
3. GLSL `refract` uses IOR, thickness and refraction strength to sample the texture. Channel offsets approximate dispersion; neighboring samples approximate roughness.
4. Schlick Fresnel, a bounded highlight and rim contribution compose the surface. Sampling clamps at texture edges. The texture being sampled is not the framebuffer currently being drawn into.

The CSS side displays a comparable 12×8 grid/disc with the same clock-driven position parameters, using actual CSS backdrop blur. Their rasterization is not a pixel-exact paired control: CSS gradients and GLSL smoothstep differ. The shader's deterministic zero-refraction and varied-IOR/size screenshots provide the additional displacement evidence. No arbitrary DOM is captured into WebGL. CSS fallback surfaces elsewhere do not claim physical refraction.

Studio sliders validate finite bounded numbers; JSON is capped at 16KiB and schemaVersion 1, with allowlisted scene fields, validated hex colors and no innerHTML interpolation of imported values. Material persists in localStorage, not the database. Export includes optics plus numeric scene/motion/palette settings. Presets: signature, crystal, frosted. Scene quality: adaptive, low, explicit light fallback. FPS is a rolling mean of observed intervals, never a hard-coded target.

## Navigation

Native cross-document View Transitions preserve full-document routing, browser history, new-tab links and existing business logic. Each public template artwork and its preview share a unique `template-<id>` name. A short-lived session item contains only the clicked public SVG cover/title/path; it is strictly path-checked and consumed on arrival. If asynchronous preview code is not yet ready, an HTML cover shell supplies the named destination before the native snapshot; the real preview replaces it normally. Direct links and unsupported browsers retain the ordinary loading/rendering path. Transition skip promise rejections are handled, without swallowing application/API errors. No auth, invitation or tenant data is copied into the transition item.

## Page inventory

| Route | Treatment | Data and state |
|---|---|---|
| `/` | Expressive intro, hero, headings, native scroll reveals, reversible step motion | Existing visible catalog, true 8/80 counts |
| `/occasions`, `/occasions/:category` | Light card lift/press/focus, native navigation | Existing filter/search and hidden-template policy |
| `/templates/:id` | Shared image-to-preview destination, real invitation renderer | Existing category-specific composition and opening |
| `/create/:id` | Restrained focus/rim feedback, light workspace | Existing live preview, uploads, draft/save/publish; untouched data logic |
| `/dashboard`, `/dashboard/invitations/:id` | Short route transition, restrained buttons/fields | Actual invitation lists, PIN, replies, exports and archive |
| `/auth`, `/login`, `/register`, `/admin` | Existing functional layouts plus shared low-motion shell | Existing guards, recovery, verification and administration |
| `/i/:slug` | Existing invitation identity and motion preferences | Existing private/public/PIN/RSVP logic and explicit audio |
| `/motion.html` | Existing standalone deterministic showcase controls | No invitation mutations |
| `/dev/design-studio` | Separate opt-in loopback server only | Disposable SQLite, no production route/assets |

## Reference mapping

All eleven contact sheets and the supplied reference image were inspected. Three additional decoded frames per source were extracted locally. R01/R02/R04/R08 were also played from the original files at 4× in Chrome for motion review; this is not audio transcription or frame-by-frame analysis. R10 was sampled at 7.3, 50.8 and 119.7 seconds, not watched in full. Local evidence: `test-results/cinematic-kit/reference-review/review.json` and `samples.jpg`.

| Reference and approximate interval | Applied observation | Acceptance evidence |
|---|---|---|
| R08, 5–13s | Card/image expansion into detail; return to list | Actual mobile video; named destination at snapshot time; scroll restored on Back/Forward |
| R01, 0–5s and 8–23s | Brief brand entrance, staged headline, section sequencing | Intro video, skip/session/reduced tests, native scroll recording |
| R02/R03, .7–7.5s | Blur changes clarity; optical material changes position of details | CSS vs FBO video; IOR/thickness/zero-refraction pixel comparison |
| R04/R05, 3–12s | Bevel/rim and moving background make thickness visible | SDF normals, channel sampling and material sliders |
| R06/R07, .4–5s | Hierarchy and restrained feedback in a working dashboard | Existing real dashboard data preserved; subtle focus/button layer, integration suite |
| R09, .5–6s | Press feedback for a small control | HTML button press states and reduced-motion override |
| R10, selected samples | Implementation reference only | No instructions or code copied/executed from video |
| R11, 1–15s | Section/product rhythm, distinct visual identity | Template artwork remains different by occasion; 80 preview openings pass |

No reference video, original contact sheet or reference image is shipped in `public/`, Git evidence or build output. Own-site screenshots are small review artifacts; original recordings remain local.
