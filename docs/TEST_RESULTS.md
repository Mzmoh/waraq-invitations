# نتائج التحقق

التحقق المحلي بتاريخ 22 نوفمبر 2026. خادم الاختبار يملك قاعدة مستقلة عن بيانات التشغيل.

| الفحص | النتيجة الفعلية |
|---|---|
| `npm test` | 36 تحققًا ناجحًا، صفر فشل. يشمل اختبارات خدمة الخادم واستمرار الجلسات والردود بعد إعادة التشغيل |
| `npm run build` | نجح فحص صياغة 44 وحدة وبناء تطبيق Node مع 80 غلافًا |
| `node tests/worker-contract.mjs` | نجح عقد النسخة المستضافة على محاكي واجهة D1 فوق SQLite |
| Playwright على Chrome المكتبي | 16 مجموعة ناجحة، صفر فشل، وصفر أخطاء JavaScript غير معالجة |
| القوالب | 80 معرّفًا فريدًا، 8 أقسام، 10 قوالب في كل قسم. فتح كل معاينة وتفعيل الكشف تفاعليًا |
| العرض | الرئيسية والأقسام والمحرر فُحصت بعروض 360 و390 و430 و768 و1440 بكسل |
| رحلة الزواج | تحرير، إضافة صورة وتبديلها وحذفها، معاينة، تسجيل، استعادة المسودة، نشر وفتح بجلسة ضيف مستقلة |
| الوقت | الثواني وتوقيت بغداد، فجوة وتكرار التوقيت الصيفي في نيويورك، الوقت المنتهي |
| المشاركة | تنزيل ICS، إظهار QR، حفظ رد حضور واعتذار، أرشفة وإبطال قراءة الرابط |
| ضوابط الوصول | منع قراءة وتعديل دعوة مالك آخر وقراءة الردود العامة، حماية صورة المسودة وPIN، إبطال جلسة PIN عند تغييره |
| التزامن | طلبا تعديل بنفس النسخة ينتج عنهما نجاح واحد وتعارض واحد |
| النسخة المستضافة | بناء Worker يضم 116 أصلًا، اختبار التسجيل بملف ارتباط آمن والنشر والضيف وRSVP وحظر CSRF |

توجد لقطات تحقق محلية داخل `test-results/final/`. تختبر محاكاة أبعاد الشاشة منطق الاستجابة داخل Chrome المكتبي. فحص Safari على iPhone فعلي وChrome على Android فعلي ومقاييس LCP وINP على الأجهزة الواقعية ما زال مطلوبًا. فحص الصياغة المتاح لا يساوي فحص TypeScript strict، لأن التنفيذ مكتوب بوحدات JavaScript.

تعذّر نشر رابط الإنترنت بسبب فشل DNS في بيئة التنفيذ. محاولة رفع المصدر أعادت `Could not resolve host: git.chatgpt-team.site`، وأخفق فحص DNS لـ github.com أيضًا. لم يصل المصدر إلى مستودع الاستضافة ولم تُنشأ نسخة منشورة. هوية المشروع محجوزة داخل `.openai/hosting.json` لاستئناف نفس الموقع بعد استعادة الاتصال.



## Verified finishing run — 2026-11-22

| Command / evidence | Actual outcome |
|---|---|
| npm test | 44 passed, 0 failed; includes backup/restore, missing/stale versions, owner-isolated lifecycle, idempotency, safe CSV and recovery race regression |
| npm run build | Passed, 49 JavaScript modules checked and 80 covers included |
| node tests/browser.mjs | 16 passed, 0 failed; all 80 preview openings, editor/signup/publish, phone guest, ICS/QR/RSVP |
| node tests/finishing-browser.mjs | 7 journeys passed; persisted typography/media/audio, Undo/Redo, replay, narrow layout, lifecycle, mail-unavailable UI, live reduced motion |
| node tests/dashboard-browser.mjs | Passed dashboard integration runner: auth, filters, PIN, replies, QR/PNG, archive/re-publish and admin visibility |
| node tests/template-visuals.mjs | 80 opening captures, eight contact sheets, 80 distinct screenshot hashes, 0 browser exceptions; sheets inspected |
| node scripts/review-reference-videos.mjs | Captured beginning/middle/later frames of four local references; inspected reference frames for envelope opening, stationery details and maps |
| npm install | Blocked: registry.npmjs.org DNS ENOTFOUND |
| npm run build:hosting | Blocked: missing esbuild; no fresh Worker bundle acceptance claimed |
| Git source-host connectivity | Blocked: git.chatgpt-team.site could not resolve |

Fresh browser evidence: test-results/production-finish/, test-results/template-review/, test-results/reference-review/. Playwright/Sharp came from the available primary runtime; Chrome was already installed. All automated data writes used disposable databases. No real device Safari/Android test or real D1 deployment was performed.

Observed failures fixed during this run: a non-specific photo-button test selector after adding a main-photo action; RTL page overflow from a negative-positioned honeypot; four-digit day wrapping; stale recovery invalidating a newer token; overly broad asset cleanup affecting other invitations Undo. Existing RSVP test now explicitly starts a new submission identity for the second simulated guest; retry of the same identity is separately tested as one saved response.


## Release gate — 2026-11-24

- npm test: 49 passed, 0 failed, including actual HTTP per-client RSVP isolation behind the exact trusted proxy.
- npm run build: passed, 53 JavaScript modules and 80 covers.
- Main browser runner: 16 passed. Finishing runner: 7 journeys passed. Dashboard integration passed.
- Release browser runner: three local WOFF fonts decoded (local load samples 8/9/10 ms); full reset/verification UI with simulated Resend inbox; all 80 template reveals at 390 px without horizontal overflow. Evidence: test-results/release-gate/results.json and test-results/release/. No actual email was sent.
- Snapshot tests: SQLite consistent backup/restore plus AES-256-GCM roundtrip, wrong-key/tamper rejection and no output on authentication failure. External storage not configured.
- Docker CLI absent; Docker build/Compose/Caddy runtime not executed. Optional YAML parse attempt blocked by missing PyYAML; no successful config-validation claim.
- Executor DNS: ENOTFOUND for github.com, git.chatgpt-team.site and api.resend.com. No production hostname/IP provided, so website-domain DNS and public-link operation remain untested.
- No physical iPhone Safari/Android browser session available. Local font timings are not production LCP/INP or mobile-network measurements.


## Development branch continuation — 2026-11-24

Stage 1 command: node --test tests/backup.test.mjs tests/backup-race.test.mjs — 3 passed. Regression first failed on the previous implementation because a foreign-key-corrupt snapshot remained published. Intermediate pending WAL/SHM failure was corrected before continuing.

Stage 2 command: node --test tests/encrypted-backup.test.mjs tests/backup.test.mjs tests/backup-race.test.mjs — 6 passed, 0 failed. The 32 MiB test validates content hashes and single-writer publication; it does not claim a production peak-RSS measurement.
Full regression: npm test — 53 passed; npm run build — passed, 54 modules; tests/browser.mjs — 16 passed. Evidence: test-results/backup-hardening/browser-results.json. The application catalog, accounts, editor, image/audio and guest source files were not changed.


## Vercel / Supabase trial — 2026-11-24 (local source not yet uploaded)

npm test: 53 passed. Trial routes/migration/storage suites on actual PGlite PostgreSQL + pgcrypto: 17 passed, including all 80 template create/publish/guest routes, RLS ownership, PIN, media, RSVP receipts, admin, mocked recovery, read-only demo migration and failure rollback. npm run build:trial and npm run build passed, 61 modules checked. Evidence: local test-results/trial-latest.txt. Tests subsequently renamed to tests/trial/*.test.mjs without behavior changes.

These results apply to the local implementation, not the documentation-only remote snapshot. No fresh trial browser run, hosted Supabase/Storage test, Vercel deployment, real mail, physical device or pg TLS/network driver verification is claimed. Local tools became unavailable because the executor received a Windows-invalid /workspace sandbox permission path. Full limitations and resume steps: VERCEL_SUPABASE_TRIAL.md.



## Cinematic identity — 2026-11-24

npm test: 56 passed, 0 failed. npm run test:trial: 17 passed on local PostgreSQL/PGlite, 0 failed. Existing tests/browser.mjs: 16 passed, including all 80 template reveals and full signup/publish/guest journey. tests/cinematic-browser.mjs: 7 passed, including actual WebGL material/bounds, editable scene and 9:16, stable final hold, no-Three reduced mode, no-WebGL/Save-Data fallbacks and English LTR. Node build and trial static build passed, 68 JS modules checked. Evidence: test-results/cinematic/results.json and cinematic-*.log. Desktop/390px fallback/portrait captures inspected. No physical-device, hosted Vercel/Supabase or production performance acceptance claimed.
# Latest continuation — 2026-11-26

GitHub follow-up: the first PR run on Ubuntu/Node 24.22.3 passed all 58 core checks but failed the trial harness on an unsupported pgcrypto package subpath. The local absolute-package override had concealed this difference. tests/trial/helpers.mjs now uses the public package export for normal installs. Failure evidence: docs/validation/ci-initial-failure.log. A new provider run is required; local success is not substituted for CI success.

Environment: Node v26.13.0, Windows, installed Chrome 158; PostgreSQL 18.7 via PGlite 0.5.17/WASM. Synthetic users/data only. Main remains b0bada68; development changes are unmerged. Original reports below remain historical evidence.

| Executed check | Final result / evidence |
|---|---|
| npm test | 58 pass, 0 fail; test-results/performance/core-final.log |
| npm run test:trial | 18 pass, 0 fail; trial-final.log; actual WASM PostgreSQL/RLS, mocked object service |
| Node build / Vercel static build | Both pass; 77 modules validated, 80 covers retained; build-final.log / build-trial-final.log |
| Main browser suite | 16 pass, 0 fail; browser-final.log; all 80 previews/reveals, signup, photo replacement/removal, date/time, publish, guest, RSVP, mobile |
| Finishing browser suite | 8 journeys, 0 uncaught errors; finishing-final.log; saved date edited and reloaded at seconds precision, Baghdad/New York conversion, persisted typography/rotation/background/audio, undo/redo, copy/CSV/delete, reduced motion and missing-mail error |
| Dashboard browser | Integration pass; dashboard-final.log; PIN, guest, RSVP, admin denial, archive/republish and five widths |
| Cinematic browser | 7 groups pass, no uncaught errors; cinematic-final.log; clock/controls, WebGL/fallback, RTL/LTR and reduced motion |
| Focused performance UX | 3 groups pass; ux-final.log; optimistic rollback on 503, delayed skeleton without fast flash, parallel auth/list, private 480px source denied before PIN |
| Template capture | Before AND after: 80 openings + 80 opened at 390×780, no browser exceptions; design-review-before.log / design-review-after.log; committed sheets/manifest under docs/design |
| Pagination/security regression | Included in core/trial counts: 71 tied timestamps without duplicates, bounded/invalid cursors, cross-owner media attachment/read denial, protected cache headers, RLS/GC/bounded parallel-upload cleanup |
| Optional legacy Worker build | BLOCKED / failed: missing esbuild module. test-results/performance/worker-build.log. Worker source/mock updated but fresh bundle acceptance is not claimed. |
| Vercel/Supabase network / public invitation | NOT RUN: no connected hosting/project credentials. Local RLS/storage stand-ins do not prove provider access, CDN or pg TLS. |
| Physical iPhone Safari / Android Chrome | NOT RUN: no usable attached device session. Viewport emulation is not physical acceptance. |

Timing evidence: docs/performance/measurements.json and three full PostgreSQL EXPLAIN artifacts; methodology and before/after tables in PERFORMANCE_AUDIT.md. Slow 4G/4× CPU browser benchmarks ran separately before this final concurrent functional-check batch. No field INP, hosted TTFB or estimated metric is substituted.

Intermediate failures: an unfiltered-empty-state expectation exposed an actual filtered-list message bug, which was corrected; visible-tile selector updated after intentional DOM reuse. An excessive preload experiment worsened LCP and was rejected. The new saved-date regression initially checked an async poll too early; an explicit successful PATCH response is now awaited before reload, and the full eight-journey suite passes. No application date change was needed. Failed run logs are retained locally. Image encode latency and home cold interaction/frame gaps are measured regressions still open.
