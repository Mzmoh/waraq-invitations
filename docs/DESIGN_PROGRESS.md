# وَرَق — تقرير التطوير السينمائي

التاريخ: 27 نوفمبر 2026. فرع المراجعة: `design/20261127-cinematic-kit`.
قاعدة العمل المتحقق منها بعد `git fetch`: `e96c0f0e60e2404f6d71cbe2d7d51df65ec432fc`، آخر HEAD لفرع إصلاح PR #4 وقت الفحص. كان مجلد العمل نظيفًا. لم يُدمج PR #4، ولم يُعدّل main، ولم يُنفّذ نشر.

## التنفيذ الفعلي

| المرحلة | الحالة | النتيجة |
|---|---|---|
| A — Discovery | PASS | JavaScript ES modules وNode، بدون React/Next؛ ثماني فئات و80 قالبًا؛ لا AGENTS.md في المشروع أو أسلاف مسار العمل المفحوصة؛ فحص المكتبات والاختبارات وخط الأساس |
| B — Safe setup | PASS | استخدام Three r180 الموجود وWAAPI/CSS/native View Transitions؛ تثبيت تبعيات package.json المثبتة الإصدارات محليًا دون install scripts؛ لا مكتبة إنتاج جديدة |
| C — Optical proof | PASS | WebGL2/GLSL، خلفية إجرائية إلى FBO، أخذ عينات منكسرة، IOR وسمك وخشونة وتشتت وإضاءة؛ اختبار تغيّر البكسلات ومقارنة مع CSS blur وفيديو فعلي |
| D — Homepage | PASS | دخولية 1600ms بالشعار الموجود، تخطٍ وسياسة جلسة وحد أقصى 1750ms؛ ظهور أسطر عربية كاملة؛ Hero تفاعلي مستمر ومشهد أكبر؛ ظهور الأقسام وخطوات مرتبطة بالتمرير؛ تشغيل وإيقاف واضحان |
| E — Studio | PASS | خادم تطوير صريح على loopback، presets، تحكم بالمواد والإضاءة والجودة والحركة والألوان، حفظ المادة محليًا، JSON export/import مضبوط، قياس FPS بعينات فعلية، إعادة الدخولية وRTL/LTR |
| F — Invitation experience | PASS | انتقال الصورة العامة من البطاقة إلى موضع المعاينة عبر Native View Transitions، مع واجهة تحميل للصورة عند تأخر وحدة الدعوة؛ Back/Forward واستعادة التمرير؛ لم تتغير هويات القوالب أو بيانات المحرر |
| G — Shared pages | PASS | انتقال قصير للصفحات، حالات لمس وHover وFocus مشتركة، إبراز التركيز في المحرر والنماذج؛ استمرار مساحة Dashboard الفاتحة المقروءة وحركة منخفضة دون إضافة مشاهد GPU للجداول |
| H — QA | PASS / BLOCKED | الاختبارات المحلية والبناء موثقة أدناه؛ الأجهزة الفعلية وقبول الاستضافة للنسخة المرشحة لم يُنفّذا |

هذا تطوير تراكمي فوق مشهد الزجاج والواجهات القائمة، وليس ادعاء بإعادة بناء القوالب الثمانين أو الداشبورد من الصفر. استُخدم شعار الظرف الموجود في المشروع، بما فيه الدخولية وfavicon، دون توليد علامة جديدة.

## التشغيل والمراجعة

شغّل `npm run dev:design` من جذر المستودع. هذا الخادم يستخدم SQLite مؤقتة مستقلة تزول عند الإغلاق:

- الصفحة الرئيسية: <http://127.0.0.1:4318/>
- الاستوديو: <http://127.0.0.1:4318/dev/design-studio>
- القوالب: <http://127.0.0.1:4318/occasions>

الاستوديو موجود في `dev/` ويُخدم فقط عبر `scripts/design-studio.mjs`، ولا يتطلب تغيير خادم الإنتاج. تطبيق المشروع العادي يعيد 404 لمسار الاستوديو وملفاته، والبناء ينسخ `public/` دون `dev/`. ليس مجرد إخفاء رابط أو فحص hostname داخل JavaScript مشحون للإنتاج.

## الأدلة المرئية

الصور التالية من الموقع نفسه؛ المراجع الأصلية لم تُرفع:

| الدليل | المسار |
|---|---|
| قبل، سطح المكتب | [الصورة](cinematic-kit/before-desktop.webp) |
| بعد، سطح المكتب | [الصورة](cinematic-kit/after-desktop.webp) |
| قبل، الموبايل | [الصورة](cinematic-kit/before-mobile.webp) |
| بعد، الموبايل مع Reduced Motion | [الصورة](cinematic-kit/after-mobile.webp) |
| المقارنة البصرية | [الصورة](cinematic-kit/optical-comparison.webp) |
| الدخولية | [الصورة](cinematic-kit/intro.webp) |
| انتقال الموبايل، الوجهة | [الصورة](cinematic-kit/mobile-detail.webp) |

التسجيلات الأصلية محلية ومستثناة من Git: `test-results/cinematic-kit/desktop.webm` للدخولية والتخطي والتمرير والإيقاف؛ `mobile.webm` للبطاقة والتفاصيل وBack/Forward؛ `optical.webm` للشبكة والإعدادات والاستيراد وإعادة الدخولية. هذه تسجيلات Playwright من المتصفح، وليست فيديوهات المراجع أو slideshow من الصور. صور PNG الكاملة والنتائج والسجلات في المجلد نفسه. لا توجد نسخة مستضافة لهذه التسجيلات.

## الاختبارات والحدود

| الاختبار | الحالة | الدليل |
|---|---|---|
| `npm test` | PASS | 58 اختبارًا، قبل وبعد؛ `test-results/cinematic-kit-unit.txt` |
| `npm run test:trial` | PASS | 21 اختبارًا، قبل وبعد؛ PostgreSQL تجريبي معزول محليًا عبر PGlite؛ `cinematic-kit-trial.txt` |
| `npm run test:e2e` | PASS | 16 مجموعة: الفئات، فتح 80 قالبًا، المحرر، signup والنشر، PIN وRSVP والضيف المستقل؛ `cinematic-kit-lifecycle.txt` |
| `npm run test:e2e:dashboard` | PASS | التسجيل والتوجيه، الترشيح، PIN وRSVP وQR وPNG، خمسة مقاسات، الأرشفة وإعادة النشر ورفض الصلاحيات؛ `cinematic-kit-dashboard.txt` |
| `npm run test:e2e:finishing` | PASS | 8 رحلات: حفظ وتخصيص، صور وصوت أصلي، undo/redo، توقيت بغداد، تشغيل صوت صريح، CSV وحذف مؤكد، خطأ البريد، Reduced Motion؛ `cinematic-kit-finishing.txt` |
| `npm run test:e2e:release` | PASS | 5 مجموعات منها استعادة كلمة المرور والتحقق بصندوق بريد محاكى وفتح 80 قالبًا على 390px؛ `cinematic-kit-release.txt` |
| `npm run test:e2e:cinematic` | PASS | 7 مجموعات، أبعاد المادة الفعلية، ثبات العرض المستقل، عدم تحميل Three مع Reduced Motion/Save-Data/غياب WebGL، RTL/LTR؛ `cinematic-kit-existing.txt` |
| `npm run test:e2e:performance` | PASS | 3 مجموعات: optimistic rollback، skeleton بطلب بطيء، طلبات مستقلة متوازية، صورة خاصة 480px بعد PIN؛ `cinematic-kit-ux-performance.txt` |
| `npm run test:e2e:photos` | PASS | 6 مجموعات: Worker/CSP، فك الصور والتحويل والـfallback والحدود وتنظيف URLs؛ `cinematic-kit-photos.txt` |
| `npm run test:e2e:kit` | PASS | 6 مجموعات إضافية للدخولية، حركة مستمرة بعد سبع ثوانٍ، ثمانية عروض 360–2560px وRTL/LTR وkeyboard، انتقال فعلي واستعادة التمرير، استبعاد الاستوديو، اختلاف بكسلات IOR/سمك/صفر الانكسار، JSON، تسجيل الفيديو؛ [النتيجة](cinematic-kit/after-results.json) |
| `npm run lint` + `npm run build` + `npm run build:trial` | PASS | فحص JavaScript والبناء؛ لا تغيير على إعداد المنطقة أو CA أو إعادة التوجيه |
| `npm run build:hosting` + `npm run test:hosting` | PASS | Worker contract: static/auth/draft/publish/guest/RSVP/ownership/CSRF |
| Console / Network في رحلة التصميم | PASS | صفر pageerror وconsole.error وHTTP 5xx في الجولة النهائية؛ أخطاء 404 المقصودة لاختبار منع الاستوديو تُفحص خارج صفحات المتصفح |
| Firefox / WebKit / هواتف فعلية | BLOCKED | لم تتوفر اختبارات عليها في هذه الدفعة؛ محاكاة Chrome للموبايل لا تعادل جهاز iPhone/Android فعليًا |
| قارئ شاشة وتدقيق WCAG شامل | BLOCKED | تحقق keyboard والتركيز والدلالات وReduced Motion والعروض، دون ادعاء شهادة WCAG أو اختبار قارئ شاشة شامل |
| Candidate على Vercel/Supabase | BLOCKED | لم يُنشر المرشح، احترامًا لطلب المستخدم؛ الاختبارات الوظيفية الجديدة محلية ببيانات صناعية مستقلة |
| AI streaming / payments | N/A | لا توجد وظيفة متأثرة تستدعي إضافتها |

## الأداء

الأرقام الخام وشروط القياس في [قبل](cinematic-kit/before-performance.json) و[بعد](cinematic-kit/after-performance.json). ثلاث زيارات، Chrome على نفس الجهاز، 390×844 وDPR2، cache معطل، CPU×4، latency 150ms وتنزيل 1.6Mbps ورفع 0.75Mbps، SQLite محلية. الاختلافات الصغيرة ليست دليلًا على تحسن ميداني، ولا توجد بيانات INP/CrUX.

الجهاز: Windows x64، Intel Core i5-12400F، Chrome 158.0.8127.37، Node v26.13.0. استُخدم `--enable-unsafe-swiftshader` لإتاحة مسار WebGL الاختباري؛ ذلك لا يثبت أداء GPU فعليًا. جرى أيضًا فقد السياق عمدًا باستخدام WEBGL_lose_context، وعمل fallback مع بقاء النص واضحًا: [الدليل](cinematic-kit/context-loss.json).

| القياس | قبل | بعد |
|---|---:|---:|
| وسيط LCP المحلي | 888ms | 892ms |
| أكبر LCP من الزيارات الثلاث | 1284ms | 1488ms |
| CLS | 0.03163 | 0.03166 |
| وسيط بايتات الموارد المرصودة | 602,772 | 608,409 |
| وسيط /api/catalog المحلي | 0.79ms | 0.97ms |

وسيط LCP متقارب؛ عينة التحميل الأولى للمرشح أبطأ ويجب متابعة ذلك على الأجهزة الفعلية، دون ادعاء تسريع. تغير API المحلي بأجزاء millisecond يقع ضمن ضجيج العينة ولا يقارن باستضافة Supabase. وسيط فحص الاستضافة الحالية للقراءة فقط 252.6ms؛ جميع الاستجابات 200. متوسط آخر 120 فاصل رسم للمقارنة 59.8 FPS، وللمشهد 59.8 FPS على هذا المختبر.

عداد الاستوديو يسجل فواصل RAF التي تُقدَّم فيها إطارات فعلية؛ عداد Three يُحدَّث عند إضافة رسم، ولا يعرض هدف 60 باعتباره نتيجة. عينات آخر 120 إطارًا في [FPS للمقارنة](cinematic-kit/fps.json) و[FPS للمشهد](cinematic-kit/scene-fps.json). هذه قياسات مختبرية مع السماح بـsoftware WebGL وليست ضمانًا على GPU أو هاتف العميل. للمشهد مستويات high/low وfallback، مع خفض DPR بعد قياس تكلفة البداية، وتوقف عند الخروج من الشاشة أو إخفاء التبويب.

فحص القراءة فقط للموقع الحالي: [العينات](cinematic-kit/hosted-current.json)، خمس استجابات 200 بعد استبعاد طلب تسخين. لم تُجر مقارنة hosted before/after للمرشح. رقم 443ms القديم يبقى قياسًا تاريخيًا بظروفه، وليس وعدًا ولا خط أساسًا قابلًا للمقارنة مع SQLite المحلية.

مراجعة مسار البيانات: لم يتغير `/api/catalog` أو اختيار الأعمدة أو pagination أو صلاحيات الأصول؛ اختبارات bounded access والخصوصية والتحميل الموازي والـoptimistic rollback قائمة. لم تُنشأ فهارس أو migrations أو تعديلات قاعدة بيانات لأغراض التصميم. بقي lazy loading والصور المتجاوبة والتحويل عبر Worker كما هو.

## الملفات والتراخيص

الملفات المعدلة: `public/home-cinematic.js`, `cinematic-ui.js`, `glass-scene.js`, `cinematic.css`, `index.html`, `main.js`؛ `package.json` لأمري التشغيل والاختبار فقط؛ `scripts/check.mjs` لفحص وحدات `dev/` أيضًا. أضيفت `public/cinematic-motion.js`, `navigation-motion.js`, `favicon.svg`, `dev/*`, `scripts/design-studio.mjs`, `tests/cinematic-kit-browser.mjs`، وهذا التقرير ومواصفة المحرك والأدلة المختصرة. لا فرق في `api/`, `server/`, `supabase/`, `drizzle/`, `worker/` أو `vercel.json`.

| المورد | الإصدار / الرخصة | الاستخدام |
|---|---|---|
| Three.js الموجود | r180 / MIT، الرخصة في `public/vendor/three/LICENSE` | MeshPhysicalMaterial وPMREM؛ لا استبدال للحزمة |
| Amiri / Noto Arabic | SIL OFL 1.1، ملفات OFL وSOURCES.json في `public/fonts/` | الخطوط الموجودة دون استيراد خطوط جديدة |
| Playwright الموجود | 1.62.1 / Apache-2.0 | اختبارات وسياقات متصفح مؤقتة؛ لا ملف متصفح المستخدم |
| esbuild / pg الموجودان | 0.27.0 / 8.16.3، MIT | البناء والاختبارات كما هما |
| PGlite الموجود | 0.5.17 / Apache-2.0 | اختبار PostgreSQL معزول |
| FFmpeg للاختبار | Playwright build 1011 / LGPL-2.1 | أداة تسجيل واستخراج إطارات محلية، لا تشحن للموقع |
| UI UX Pro Max | المهارة المحلية المقروءة | بحث `luxury invitation cinematic atelier` أعاد Liquid Glass؛ استُخدمت إرشادات الوصول والحركة، مع إبقاء ألوان WARAQ بدل ألوان البحث العامة |
| Taste Skill | snapshot `952435f63acece7d2fcb4b4d3c1786c1c43603e0`، MIT | فحص SKILL.md وLICENSE؛ لم تُثبت hooks أو تُشغّل scripts. بعض قواعدها تتعارض مع طلب المستخدم، لذلك لم تُفرض على المشروع |
| Vercel agent-skills | snapshot `5a37a6329fbad3666c3207392a6a7c0110e92efb` | مراجعة web-design-guidelines ومصدرها المثبت؛ ترخيص جذر المجموعة غير مثبت، لا كود منها في الإنتاج |
| Playwright CLI | snapshot `dc5f4d5616ab5a28ded12fd7101a4d49bd59a820`، Apache-2.0 | مراجعة المهارة؛ استخدم الاختبار API الموجود بدل تثبيت CLI عالمي |
| WAAPI / CSS / WebGL2 | APIs متصفح | تطبيق أصلي، دون GSAP أو Motion أو Lenis أو React أو مكتبات مدفوعة |

المراجع التقنية: [Three](https://threejs.org/docs/)، [Native View Transitions](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API). لم تُنسخ أصول أو هوية WEB VISION. استُخرج ZIP مع التحقق من المسارات إلى المجلد الشقيق `../CINEMATIC_WEB_KIT/` خارج `public`، وأضيف استثناء محلي مناسب في `.git/info/exclude` أيضًا. لقطات فحص المراجع الأصلية باقية محليًا في `test-results` وليست ضمن ملفات Git.

## الرجوع والعوائق

الرجوع الآمن قبل الدمج: إغلاق PR التصميم أو العودة إلى فرع `fix/20261126-vercel-trial-availability`. لا بيانات تحتاج rollback؛ لا تغييرات استضافة حدثت. بعد دمج مُصرّح به مستقبلًا يمكن عمل `git revert` لالتزام التصميم وحده، مع الحفاظ على التزام الإصلاح `e96c0f0` وتغييرات TLS والمنطقة. لا تستخدم reset --hard ولا حذف ملفات المستخدم.

تبقى مراجعة الجودة الفنية من المستخدم، واختبار أجهزة فعلية ومتصفحات أخرى، وقبول النسخة المرشحة على بيئة استضافة مصرح بها؛ لم يُدّعَ التطابق الكامل مع كل المراجع أو اعتماد إطلاق إنتاجي شامل.
