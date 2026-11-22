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
