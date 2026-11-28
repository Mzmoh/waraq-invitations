import {renderCinematicHome} from './home-cinematic.js';
import {withDesign,renderSocial} from './rental-template.js';
import { templates } from './templates/catalog.js';

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
const safe = value=>String(value).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
let custom=[],rentals=false;
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
    <div class="nav-actions"><button class="lang-button" type="button" lang="${t('en','ar')}" aria-label="${t('EN — Switch to English','عربي — التبديل إلى العربية')}">${t('EN','عربي')}</button>
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
  const {hiddenTemplates = [],hiddenCategories = [],custom:designs=[],social,rentals:enabled} = await response.json();
  custom=designs;rentals=Boolean(enabled);
  renderSocial(footer.querySelector('.footer-inner'),social);
  occasions = categories.filter(c => !hiddenCategories.includes(c[0]));
  gallery = [...templates,...custom.map(d=>withDesign(templates.find(x=>x.id===d.base),d)).filter(Boolean)].filter(template => !hiddenTemplates.includes(template.id) && occasions.some(c=>c[0]===template.category));
}

function occasionTiles(eager=false) {
  return `<div class="occasion-grid">${occasions.map(c=>{
    const first = gallery.find(template => template.id === c[3]) || gallery.find(template=>template.category===c[0]);
    return `<a class="occasion-tile" href="/occasions/${c[0]}">
      <span class="occasion-art" data-category="${c[0]}">${first ? `<img src="${first.thumbnail}" alt="" loading="${eager?'eager':'lazy'}" decoding="async" width="360" height="260">` : icon(c[4],42)}</span>
      <span class="occasion-name">${icon(c[4],19)}<strong>${ctitle(c)}</strong></span>
    </a>`;
  }).join('')}</div>`;
}
function cards(list,eagerCount=0) {
  return list.map((template,index) => `<article class="template-tile"><a href="/templates/${template.id}">
    <div class="template-art"><img src="${template.thumbnail}" width="360" height="260" alt="" loading="${index<eagerCount?'eager':'lazy'}" decoding="async"></div>
    <div class="template-caption"><h3>${safe(title(template))}</h3><span>${t('معاينة حية','Live preview')}</span></div>
  </a></article>`).join('');
}

function home() { return renderCinematicHome(app,{gallery,t,icon,occasionTiles,cards}); }
function browse() {
  const category = occasions.find(c=>c[0]===id);
  if (id && !category) return missing();
  if (!category) {
    app.innerHTML = `<div class="wrap studio-content"><h1>${t('المناسبات','Occasions')}</h1><p class="studio-lead">${t('اختر نوع المناسبة لتستعرض قوالبها.','Choose an occasion to explore its templates.')}</p>${occasionTiles(true)}</div>`;
    const section=document.createElement('section');section.className='wrap studio-section';
    section.innerHTML=`<h2>${t('كل القوالب','All templates')}</h2><form class="studio-filter" role="search"><label>${t('ابحث عن قالب','Search templates')}<input name="query" type="search" autocomplete="off"></label><label>${t('المناسبة','Occasion')}<select name="category"><option value="">${t('جميع المناسبات','All occasions')}</option>${occasions.map(c=>`<option value="${c[0]}">${ctitle(c)}</option>`).join('')}</select></label></form><p role="status"></p><div class="template-grid"></div>`;
    app.append(section);const form=section.querySelector('form');form.onsubmit=e=>e.preventDefault();
    section.querySelector('.template-grid').innerHTML=cards(gallery);const tiles=[...section.querySelectorAll('.template-tile')];
    const update=()=>{const q=form.elements.query.value.trim().toLowerCase();const list=gallery.filter(x=>(!form.elements.category.value||x.category===form.elements.category.value)&&[x.titleAr,x.titleEn].some(s=>s.toLowerCase().includes(q)));section.querySelector('[role=status]').textContent=t(`عدد القوالب: ${list.length}`,`${list.length} templates`);const visible=new Set(list.map(t=>t.id));tiles.forEach((tile,i)=>tile.hidden=!visible.has(gallery[i].id));};
    form.addEventListener('input',update);form.addEventListener('change',update);update();return;
  }
  const options = gallery.filter(template=>template.category===id);
  const styles = [...new Set(options.map(template=>template.style))];
  const styleEn = {'فاخر':'Luxury','كلاسيكي':'Classic','عصري':'Modern','ناعم':'Soft','تراثي':'Traditional','هادئ':'Quiet'};
  app.innerHTML = `<div class="wrap studio-content"><a class="crumb" href="/occasions">${t('كل المناسبات','All occasions')}</a>
  <h1>${ctitle(category)}</h1>
  <form class="studio-filter" role="search"><label>${t('ابحث عن قالب','Search templates')}<input name="query" type="search" autocomplete="off"></label>
  <label>${t('الأسلوب','Style')}<select name="style"><option value="">${t('جميع الأساليب','All styles')}</option>${styles.map(style=>`<option value="${style}">${t(style,styleEn[style]||style)}</option>`).join('')}</select></label></form>
  <p role="status" class="result-count"></p><div class="template-grid" id="browse-grid"></div></div>`;
  const form = app.querySelector('form');app.querySelector('#browse-grid').innerHTML=cards(options,4);const tiles=[...app.querySelectorAll('#browse-grid .template-tile')];
  const update = () => {
    const query = form.elements.query.value.trim().toLowerCase();
    const list = options.filter(x=>(!form.elements.style.value || x.style===form.elements.style.value) &&
      [x.titleAr,x.titleEn].some(value=>value.toLowerCase().includes(query)));
    app.querySelector('.result-count').textContent = list.length ? t(`عدد القوالب ${list.length}`,`${list.length} templates`) : t('ماكو قالب يطابق البحث.','No templates match your search.');
    const visible=new Set(list.map(t=>t.id));tiles.forEach((tile,i)=>tile.hidden=!visible.has(options[i].id));
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
  // Keep the incoming cover mounted while a cold network loads the renderer.
  // Clearing the device before this import leaves an empty frame on hosting.
  const {renderInvitation} = await import('./invitation.js');
  const transitionCover=app.querySelector('[data-transition-cover]');
  const category = categories.find(c=>c[0]===template.category);
  document.title = `${title(template)} | وَرَق`;
  app.innerHTML = `<div class="wrap studio-content studio-preview"><div><a class="crumb" href="/occasions/${category[0]}">${ctitle(category)}</a>
  <h1>${safe(title(template))}</h1><p class="studio-lead">${t('جرّب الفتح والتمرير كما يراهما ضيوفك.','Try opening and scrolling through the invitation as a guest.')}</p>
  <a class="studio-button" href="/create/${template.id}">${t('استخدم هذا القالب','Use this template')}</a></div>
  <div class="preview-device" id="template-preview" style="view-transition-name:invitation-preview"></div></div>`;
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
  if(transitionCover)app.querySelector('#template-preview').append(transitionCover);
  // Release the temporary cover only after the real preview font is decoded.
  await document.fonts.ready;
  app.querySelector('#template-preview .inv-card')?.setAttribute('id','preview-ready');
  document.dispatchEvent(new Event('waraq:preview-ready'));
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
    if (page === 'dashboard') {
      void getCatalog().catch(()=>{});
      return renderDashboard(app,id === 'invitations' ? item : undefined);
    }
    if (page === 'admin') return renderAdmin(app);
    return renderAuth(app);
  }
  if (page === 'create' && new URLSearchParams(location.search).has('id')) {
    const {templates:full}=await import('./templates/index.js');
    let existing = full.find(x=>x.id===id);
    if(!existing&&id?.startsWith('custom-')){
      const key=new URLSearchParams(location.search).get('id');
      const response=await fetch('/api/invitations/'+encodeURIComponent(key));
      if(response.status===401){location.assign('/auth?next='+encodeURIComponent(location.pathname+location.search));return;}
      if(!response.ok)return missing();
      const {invitation}=await response.json();
      if(invitation.custom?.id===id)existing=withDesign(full.find(x=>x.id===invitation.custom.base),invitation.custom);
    }
    if (!existing) return missing();
    const {renderEditor} = await import('./editor.js');
    return renderEditor(app,existing);
  }
  await getCatalog();
  if (!page) {
    home();
    const extra=document.createElement('div');extra.className='wrap';
    extra.innerHTML=`<section class="studio-section"><h2>${t('تفاصيل تليق بمناسبتك','Everything for your occasion')}</h2><div class="template-grid">${[
      [t('معاينة متحركة','Animated preview'),t('جرّب القالب قبل الاختيار، وعدّل مع معاينة مباشرة.','Try the design before choosing and customize with a live preview.')],
      [t('رابط وخصوصية','Sharing and privacy'),t('شارك الرابط أو QR، واختر حماية الدعوة برمز دخول.','Share a link or QR code and optionally protect the invitation with a PIN.')],
      [t('ردود ضيوفك','Guest replies'),t('تابع تأكيدات الحضور وصدّرها من لوحة دعوتك.','Track attendance replies and export them from your invitation dashboard.')]
    ].map(([title,body])=>`<article class="studio-feature"><h3>${title}</h3><p>${body}</p></article>`).join('')}</div></section><section class="studio-section studio-faq"><h2>${t('أسئلة شائعة','Frequently asked questions')}</h2>${[
      [t('هل أحتاج حسابًا؟','Do I need an account?'),t('يمكنك تجربة المحرر بدون حساب. تحتاج حسابًا لحفظ الدعوة على السيرفر ونشرها.','You can try the editor without an account. Sign in to save to the server and publish.')],
      [t('هل أستطيع التعديل بعد النشر؟','Can I edit after publishing?'),rentals?t('يمكن تعديل المسودة قبل إرسال طلب الإيجار. لتعديل دعوة إيجار نشطة، أوقف رابطها أولًا.','Edit your draft before requesting rental. To edit an active rental, disable its link first.'):t('نعم، عدّل من دعواتي ثم أكد نشر التغييرات. يبقى رابط الدعوة نفسه.','Yes. Edit from My invitations and publish the changes. The guest link stays the same.')],
      [t('هل يصل الصوت تلقائيًا؟','Does audio start automatically?'),t('يختار الضيف تشغيل الصوت بنفسه احترامًا لإعدادات المتصفح.','Guests choose to play audio themselves, respecting browser policies.')],
      [t('هل الرابط المحلي يفتح عند الضيوف؟','Can guests open a local link?'),t('روابط localhost و127.0.0.1 للتجربة على جهازك. المشاركة عبر الإنترنت تتطلب موقعًا منشورًا على استضافة عامة.','localhost and 127.0.0.1 are for testing on your device. Internet sharing requires a deployed public host.')]
    ].map(([q,a])=>`<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</section>`;
    app.append(extra);return;
  }
  if (page === 'occasions') return browse();
  let template = gallery.find(x=>x.id===id);
  if(template&&['templates','create'].includes(page)){const {templates:full}=await import('./templates/index.js');const design=custom.find(x=>x.id===id);template=withDesign(full.find(x=>x.id===(design?.base??id)),design);}
  if (!template) return missing();
  if (page === 'templates') return preview(template);
  if (page === 'create') {
    const {renderEditor} = await import('./editor.js');
    return renderEditor(app,template,undefined,{rentals});
  }
  return missing();
}
const booted=boot().catch(error=>{
  console.error(error);
  app.innerHTML = `<div class="wrap studio-content" role="alert"><h1>${t('تعذّر تحميل الصفحة','Could not load page')}</h1><button class="studio-button" type="button">${t('أعد المحاولة','Try again')}</button></div>`;
  app.querySelector('button').onclick=()=>location.reload();
}).finally(()=>{app.setAttribute('aria-busy','false');document.dispatchEvent(new Event('waraq:page-ready'));});
// A template must be ready for the incoming shared-element snapshot. Other
// routes keep their existing immediate loading shell and asynchronous boot.
if(page==='templates')await booted;

