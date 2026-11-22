import { templates } from './templates/index.js';

const categories = [
  ['general','دعوة مخصصة','Custom invitation','art-deco','M4 6h16v12H4z M4 6l8 7 8-7'],
  ['ramadan','رمضان','Ramadan','golden-crescent','M19.5 15A8 8 0 0 1 9 4a8 8 0 1 0 10.5 11Z'],
  ['fitr','عيد الفطر','Eid al-Fitr','eidiyah-envelope','M4 8h16v12H4z M12 8v12 M3 12h18 M12 8C5 8 5 2 9 4c2 1 3 4 3 4Zm0 0c7 0 7-6 3-4-2 1-3 4-3 4Z'],
  ['hajj','الحج','Hajj','kaaba-elegance','M3 8l9-5 9 5v10l-9 4-9-4z M3 8l9 5 9-5 M12 13v9'],
  ['adha','عيد الأضحى','Eid al-Adha','baghdad-tradition','M4 20h16 M6 20V9c0-3 6-6 6-6s6 3 6 6v11 M10 20v-6h4v6'],
  ['wedding','زواج','Wedding','blush-floral-envelope','M4 6h16v12H4z M4 6l8 7 8-7'],
  ['baby','مولود جديد','New baby','clouds-stars','M6 17a4 4 0 1 1 .8-7.9 6 6 0 0 1 11.2 2A3 3 0 0 1 18 17Z'],
  ['graduation','تخرّج','Graduation','golden-diploma','m2 9 10-5 10 5-10 5z M6 11v6c4 3 8 3 12 0v-6 M22 9v6'],
];

const app = document.querySelector('#app');
const header = document.querySelector('#site-header');
const footer = document.querySelector('#site-footer');
const lang = localStorage.getItem('waraq-language') === 'en' ? 'en' : 'ar';
const t = (ar,en) => lang === 'en' ? en : ar;
document.documentElement.lang = lang;
document.documentElement.dir = t('rtl','ltr');
const [page, id, item] = location.pathname.split('/').filter(Boolean);
const icon = (path,size=24) => `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
const mark = icon('M2.5 5.5h19v13h-19z M2.5 5.5l9.5 7.4 9.5-7.4 M7 20.5h10',22);
const brand = `<a class="brand" href="/" aria-label="${t('وَرَق، الرئيسية','Waraq home')}"><span>${mark}</span><strong>${t('وَرَق','Waraq')}</strong></a>`;
const ctitle = c => t(c[1],c[2]);
const title = template => t(template.titleAr,template.titleEn);
const active = name => page === name ? ' aria-current="page"' : '';
let gallery = templates;
let occasions = categories;

function siteChrome() {
  header.innerHTML = `<a class="jump" href="#app">${t('انتقل إلى المحتوى','Skip to content')}</a>
  <div class="wrap header-inner">${brand}
    <nav aria-label="${t('التنقل الرئيسي','Main navigation')}">
      <a href="/occasions"${active('occasions')}>${t('القوالب','Templates')}</a>
      <a href="/dashboard"${active('dashboard')}>${t('دعواتي','My invitations')}</a>
    </nav>
    <div class="nav-actions"><button class="lang-button" type="button" lang="${t('en','ar')}" aria-label="${t('تبديل إلى الإنجليزية','Switch to Arabic')}">${t('EN','عربي')}</button>
    <a class="studio-button header-cta" href="/occasions">${t('أنشئ دعوتك','Create invitation')}</a></div>
  </div>`;
  header.querySelector('button').onclick = () => {
    localStorage.setItem('waraq-language',t('en','ar'));
    location.reload();
  };
  footer.innerHTML = `<div class="wrap footer-inner">${brand}<span>${t('استوديو الدعوات الإلكترونية','Digital invitation studio')}</span><a href="/occasions">${t('استكشف المناسبات','Browse occasions')}</a></div>`;
}
async function getCatalog() {
  const response = await fetch('/api/catalog');
  if (!response.ok) throw new Error('Catalog unavailable');
  const {hiddenTemplates = [],hiddenCategories = []} = await response.json();
  occasions = categories.filter(c => !hiddenCategories.includes(c[0]));
  gallery = templates.filter(template => !hiddenTemplates.includes(template.id) && occasions.some(c=>c[0]===template.category));
}

function occasionTiles() {
  return `<div class="occasion-grid">${occasions.map(c=>{
    const first = gallery.find(template => template.id === c[3]) || gallery.find(template=>template.category===c[0]);
    return `<a class="occasion-tile" href="/occasions/${c[0]}">
      <span class="occasion-art" data-category="${c[0]}">${first ? `<img src="${first.thumbnail}" alt="" loading="lazy" width="360" height="260">` : icon(c[4],42)}</span>
      <span class="occasion-name">${icon(c[4],19)}<strong>${ctitle(c)}</strong></span>
    </a>`;
  }).join('')}</div>`;
}
function cards(list) {
  return list.map(template => `<article class="template-tile"><a href="/templates/${template.id}">
    <div class="template-art"><img src="${template.thumbnail}" width="360" height="260" alt="" loading="lazy"></div>
    <div class="template-caption"><h3>${title(template)}</h3><span>${t('معاينة حية','Live preview')}</span></div>
  </a></article>`).join('');
}

function home() {
  const featured = ['royal-navy-wax-seal','golden-crescent','ivory-lace','graduation-cap-toss'].map(id=>gallery.find(x=>x.id===id)).filter(Boolean);
  const demo = gallery.find(x=>x.id==='royal-navy-wax-seal') || gallery[0];
  app.innerHTML = `<div class="wrap landing">
    <section class="studio-hero" aria-labelledby="hero-title">
      <div class="hero-copy"><div class="hero-rule" aria-hidden="true">✦</div>
      <h1 id="hero-title">${t('لكلّ مناسبة<br>دعوة <em>تليق بها.</em>','Every occasion<br>deserves an <em>invitation.</em>')}</h1>
      <p>${t('صمّم دعوة متحركة بتفاصيلك. شاركها برابط، ودع ضيوفك يفتحونها كما يفتحون ظرفًا حقيقيًا.','Design a moving invitation with your details. Share it by link and give guests an envelope they can open.')}</p>
      <div class="hero-actions"><a class="studio-button" href="/occasions">${t('أنشئ دعوتك','Create invitation')}</a>
      ${demo ? `<a class="studio-button secondary" href="/templates/${demo.id}">${icon('m9 5 11 7-11 7z',16)}${t('جرّب فتح دعوة','Open a sample')}</a>` : ''}</div></div>
      <div class="hero-art">
        <img src="/media/wax-stationery.webp" width="1400" height="933" fetchpriority="high" alt="${t('ظرف عاجي مختوم بالشمع فوق قماش خمري','Ivory envelope with a wax seal on burgundy velvet')}">
        ${demo ? `<a class="hero-hotspot" href="/templates/${demo.id}">${icon('m9 5 11 7-11 7z',17)}${t('معاينة الدعوة','Preview invitation')}</a>` : ''}
      </div>
    </section>
    <section class="studio-section"><div class="section-heading"><h2>${t('اختر مناسبتك','Choose your occasion')}</h2></div>${occasionTiles()}</section>
    ${featured.length ? `<section class="studio-section"><div class="section-heading"><h2>${t('قوالب مختارة','Featured invitations')}</h2><a href="/occasions">${t('كل المناسبات','All occasions')}</a></div><div class="template-grid">${cards(featured)}</div></section>` : ''}
    <section class="studio-section studio-steps"><h2>${t('من اختيار القالب إلى إرسال الدعوة','From template to guest link')}</h2>
      <ol><li><strong>${t('اختر القالب','Choose')}</strong><p>${t('افتح معاينة حيّة قبل الاختيار.','Open a live preview before choosing.')}</p></li><li><strong>${t('أضف تفاصيلك','Customize')}</strong><p>${t('أضف النص والصور واضبط وقت المناسبة.','Add text, photos and your event time.')}</p></li><li><strong>${t('شارك الرابط','Share')}</strong><p>${t('يفتح الضيف الدعوة من هاتفه ويستطيع تأكيد حضوره.','Guests open your invitation on their phones and can RSVP.')}</p></li></ol>
      <a class="studio-button" href="/occasions">${t('استكشف القوالب','Explore templates')}</a>
    </section>
  </div>`;
}
function browse() {
  const category = occasions.find(c=>c[0]===id);
  if (id && !category) return missing();
  if (!category) {
    app.innerHTML = `<div class="wrap studio-content"><h1>${t('المناسبات','Occasions')}</h1><p class="studio-lead">${t('اختر نوع المناسبة لتستعرض قوالبها.','Choose an occasion to explore its templates.')}</p>${occasionTiles()}</div>`;
    return;
  }
  const options = gallery.filter(template=>template.category===id);
  const styles = [...new Set(options.map(template=>template.style))];
  const styleEn = {'فاخر':'Luxury','كلاسيكي':'Classic','عصري':'Modern','ناعم':'Soft','تراثي':'Traditional','هادئ':'Quiet'};
  app.innerHTML = `<div class="wrap studio-content"><a class="crumb" href="/occasions">${t('كل المناسبات','All occasions')}</a>
  <h1>${ctitle(category)}</h1>
  <form class="studio-filter" role="search"><label>${t('ابحث عن قالب','Search templates')}<input name="query" type="search" autocomplete="off"></label>
  <label>${t('الأسلوب','Style')}<select name="style"><option value="">${t('جميع الأساليب','All styles')}</option>${styles.map(style=>`<option value="${style}">${t(style,styleEn[style]||style)}</option>`).join('')}</select></label></form>
  <p role="status" class="result-count"></p><div class="template-grid" id="browse-grid"></div></div>`;
  const form = app.querySelector('form');
  const update = () => {
    const query = form.elements.query.value.trim().toLowerCase();
    const list = options.filter(x=>(!form.elements.style.value || x.style===form.elements.style.value) &&
      [x.titleAr,x.titleEn].some(value=>value.toLowerCase().includes(query)));
    app.querySelector('.result-count').textContent = list.length ? t(`عدد القوالب ${list.length}`,`${list.length} templates`) : t('ماكو قالب يطابق البحث.','No templates match your search.');
    app.querySelector('#browse-grid').innerHTML = cards(list);
  };
  form.onsubmit = e=>e.preventDefault();
  form.addEventListener('input',update);
  form.addEventListener('change',update);
  update();
}
function missing() {
  app.innerHTML = `<div class="wrap studio-content"><h1>${t('الصفحة غير متوفرة','Page unavailable')}</h1><a class="studio-button" href="/occasions">${t('عرض المناسبات','Browse occasions')}</a></div>`;
}
async function preview(template) {
  const category = categories.find(c=>c[0]===template.category);
  document.title = `${title(template)} | وَرَق`;
  app.innerHTML = `<div class="wrap studio-content studio-preview"><div><a class="crumb" href="/occasions/${category[0]}">${ctitle(category)}</a>
  <h1>${title(template)}</h1><p class="studio-lead">${t('جرّب الفتح والتمرير كما يراهما ضيوفك.','Try opening and scrolling through the invitation as a guest.')}</p>
  <a class="studio-button" href="/create/${template.id}">${t('استخدم هذا القالب','Use this template')}</a></div>
  <div class="preview-device" id="template-preview"></div></div>`;
  const {renderInvitation} = await import('./invitation.js');
  const examples = {
    general:['أمسية صيفية','A summer evening'],ramadan:['أمسية رمضانية','A Ramadan evening'],
    fitr:['عيدكم مبارك','Eid Mubarak'],hajj:['حجّ مبرور','Hajj Mabroor'],adha:['عيد الأضحى المبارك','Eid al-Adha'],
    wedding:['ليلى وعمر','Layla and Omar'],baby:['أهلًا يا نور','Welcome, Noor'],graduation:['حفل تخرّج مريم','Mariam’s graduation'],
  };
  const example = examples[template.category];
  renderInvitation(app.querySelector('#template-preview'),template,{
    title:t(...example),message:t('يسعدنا تشاركونا هاللحظة.','We would love to share this moment with you.'),
    startAt:new Date(Date.now()+86400000*10+3723000).toISOString(),timeZone:'Asia/Baghdad',place:t('قاعة الورد','Rose Hall'),
  },{preview:true,lang});
}
async function boot() {
  if (page === 'i') {
    document.body.classList.add('guest-page');
    const {renderGuest} = await import('./invitation.js');
    return renderGuest(app,id);
  }
  siteChrome();
  if (page === 'dashboard' || page === 'admin' || page === 'auth' || page === 'login') {
    const {renderDashboard,renderAdmin,renderAuth} = await import('./dashboard.js');
    if (page === 'dashboard') return renderDashboard(app,page === 'dashboard' && id === 'invitations' ? item : undefined);
    if (page === 'admin') return renderAdmin(app);
    return renderAuth(app);
  }
  if (page === 'create' && new URLSearchParams(location.search).has('id')) {
    const existing = templates.find(x=>x.id===id);
    if (!existing) return missing();
    const {renderEditor} = await import('./editor.js');
    return renderEditor(app,existing);
  }
  await getCatalog();
  if (!page) return home();
  if (page === 'occasions') return browse();
  const template = gallery.find(x=>x.id===id);
  if (!template) return missing();
  if (page === 'templates') return preview(template);
  if (page === 'create') {
    const {renderEditor} = await import('./editor.js');
    return renderEditor(app,template);
  }
  return missing();
}
boot().catch(error=>{
  console.error(error);
  app.innerHTML = `<div class="wrap studio-content" role="alert"><h1>${t('تعذّر تحميل الصفحة','Could not load page')}</h1><button class="studio-button" type="button">${t('أعد المحاولة','Try again')}</button></div>`;
  app.querySelector('button').onclick=()=>location.reload();
}).finally(()=>app.setAttribute('aria-busy','false'));

