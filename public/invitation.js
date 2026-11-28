import {enhanceExperience} from './experience.js';
import {withDesign} from './rental-template.js';
import { templates, scene } from './templates/index.js';
import { validMap } from './editor-model.js';
import { downloadCalendar, shareInvitation, downloadShareCard, showQR } from './invitation-share.js';
export { downloadCalendar, shareInvitation, downloadShareCard, showQR };

const sessions = new WeakMap();
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hex = value => /^#[a-f\d]{6}$/i.test(value || '') ? value : '';
const bound = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.min(max,Math.max(min,Number(value))) : fallback;
const textPair = en => (ar, english) => en ? english : ar;
const categories = {
 general:['دعوة خاصة','An invitation'],ramadan:['دعوة رمضانية','A Ramadan invitation'],fitr:['عيد الفطر','Eid al-Fitr'],
 hajj:['حج مبرور','A Hajj celebration'],adha:['عيد الأضحى','Eid al-Adha'],wedding:['دعوة زفاف','A wedding invitation'],
 baby:['بشرى مولود','A birth announcement'],graduation:['حفل تخرج','Graduation celebration']
};

const list = value => Array.isArray(value) ? value : [];
function names(template,data,txt) {
  switch(template.category) {
    case 'wedding': return [data.groom, data.bride].filter(Boolean).join(txt(' و',' & '));
    case 'graduation': return data.graduate;
    case 'baby': return data.babyName;
    case 'hajj': return data.pilgrim;
    default: return '';
  }
}
export function countdownParts(instant, now = Date.now()) {
  const seconds = Math.max(0,Math.ceil((Date.parse(instant)-now)/1000));
  return Number.isFinite(seconds) && seconds > 0 ? [Math.floor(seconds/86400),Math.floor(seconds/3600)%24,Math.floor(seconds/60)%60,seconds%60] : null;
}
function formatDate(instant, zone, en, hijri=false) {
  if(!instant || !Number.isFinite(Date.parse(instant))) return '';
  const options={timeZone:zone || 'Asia/Baghdad',dateStyle:'full'};
  if(!hijri) options.timeStyle='medium';
  const locale=(en?'en-GB':'ar-IQ')+(hijri?'-u-ca-islamic-umalqura':'-u-ca-gregory');
  try { return new Intl.DateTimeFormat(locale,options).format(new Date(instant)); }
  catch { return new Intl.DateTimeFormat(locale,{...options,timeZone:'UTC'}).format(new Date(instant)); }
}
function responsivePhoto(image){
  const variants=(Array.isArray(image.variants)?image.variants:[]).filter(v=>safePhoto(v)&&Number.isInteger(v.width)&&v.width>0&&v.width<=1400);
  if(!variants.length||!Number.isInteger(image.width))return '';
  return ' srcset="'+esc([...variants,{src:safePhoto(image),width:image.width}].map(v=>v.src+' '+v.width+'w').join(', '))+'" sizes="(max-width: 600px) 100vw, 600px"';
}
function safePhoto(image) {
  const url = String(image?.src || '');
  return /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(url) || /^\/api\/assets\/[\w/-]+$/.test(url) ? url : '';
}
const icon = (id) => '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">'+ ({
  calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M4 11h16"/>',
  pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.4"/>',
  share:'<path d="M12 15V3m-4 4 4-4 4 4M6 12H4v9h16v-9h-2"/>',
  pause:'<path d="M9 5v14m6-14v14"/>', play:'<path d="m8 5 10 7-10 7z"/>',
  open:'<path d="M3 9v11h18V9L12 3 3 9Zm0 0 9 6 9-6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>'
}[id] || '')+'</svg>';
function section(title,body,kind) {
  return '<section class="inv-block inv-'+kind+'"><h3>'+title+'</h3>'+body+'</section>';
}
function extraFields(template,data,t) {
  const pairs=[];
  if(data.gatheringType) pairs.push([t('المناسبة','Occasion'),data.gatheringType]);
  if(template.category==='baby') pairs.push([t('الوالدان','Parents'),data.parents],[t('تاريخ الميلاد','Born'),data.birthDate]);
  if(template.category==='graduation') pairs.push([t('المؤسسة','Institution'),data.institution],[t('التخصص','Department'),data.department],[t('الدفعة','Class'),data.cohort]);
  if(template.category==='wedding') pairs.push([t('استقبال الضيوف','Reception'),data.receptionTime]);
  if(template.category==='general') list(data.customFields).forEach(f=>pairs.push([f.label,f.value]));
  const entries=pairs.filter(([key,value])=>key && value);
  return entries.length?'<dl class="inv-meta">'+entries.map(([key,value])=>'<div><dt>'+esc(key)+'</dt><dd>'+esc(value)+'</dd></div>').join('')+'</dl>':'';
}
function sections(data,options,t) {
  const blocks={};
  if(data.showCountdown!==false && Number.isFinite(Date.parse(data.startAt))) {
    blocks.countdown=section(t('نلتقي بعد','Counting down'),'<div data-counter class="inv-digits" role="timer"></div>','countdown');
  }
  const map = data.mapsUrl && validMap(data.mapsUrl) ? data.mapsUrl : '';
  if(data.place||data.address||map) {
    blocks.venue=section(t('مكان اللقاء','Where to meet'),'<strong>'+esc(data.place)+'</strong><p>'+esc(data.address)+'</p>'+
      (map?'<a class="inv-btn" target="_blank" rel="noopener noreferrer" href="'+esc(map)+'">'+icon('pin')+t('افتح الخريطة','Open map')+'</a>':''),'venue');
  }
  const schedule=list(data.schedule).filter(item=>item?.title);
  if(schedule.length) blocks.schedule=section(t('برنامج المناسبة','Order of events'),'<ol class="inv-timeline">'+schedule.map(item=>'<li><time dir="ltr">'+esc(item.time)+'</time><span>'+esc(item.title)+'</span></li>').join('')+'</ol>','schedule');
  const photos=list(data.images).filter(im=>im.role!=='background').filter(safePhoto);
  if(photos.length) blocks.gallery=section(t('ألبوم الصور','Photo album'),'<div class="inv-photos">'+photos.map(image=>{
    const x=bound(image.x,0,100,50),y=bound(image.y,0,100,50),zoom=bound(image.zoom,1,3,1);
    return '<figure><img loading="lazy" decoding="async" alt="'+esc(image.alt || t('صورة المناسبة','Event photograph'))+'" style="object-position:'+x+'% '+y+'%;transform-origin:'+x+'% '+y+'%;transform:scale('+zoom+') rotate('+bound(image.rotation,-180,180,0)+'deg)" src="'+esc(safePhoto(image))+'"'+responsivePhoto(image)+'></figure>';
  }).join('')+'</div>','gallery');
  if(data.rsvpEnabled) {
    const limit=bound(data.maxGuests,1,100,1);
    const preview=options.preview;
    blocks.rsvp=section(t('تشرفنا بحضورك','Will you join us?'),
      '<form class="inv-rsvp-form"><label>'+t('اسم الضيف','Guest name')+'<input name="name" required maxlength="90" autocomplete="name"></label>'+
      '<label>'+t('ردّ الدعوة','Your response')+'<select name="attending"><option value="yes">'+t('سأحضر','I will attend')+'</option><option value="no">'+t('أعتذر عن الحضور','I cannot attend')+'</option></select></label>'+
      '<label data-party>'+t('عدد الحاضرين','Number attending')+'<input name="count" type="number" value="1" min="1" max="'+limit+'" required></label>'+
      '<label>'+t('رسالة اختيارية','Optional message')+'<textarea name="comment" maxlength="500" rows="2"></textarea></label>'+
      '<button class="inv-btn inv-primary" type="submit">'+t('إرسال الرد','Send response')+'</button>'+
      (preview?'<small>'+t('يمكنك تجربة النموذج في المعاينة.','Try the form in preview.')+'</small>':'')+
      '<p data-feedback role="status"></p></form>','rsvp');
  }
  const order=Array.isArray(data.sections)?data.sections:['countdown','venue','schedule','gallery','rsvp'];
  return [...new Set(order)].map(key=>Object.hasOwn(blocks,key)?blocks[key]:'').join('');
}
export function renderInvitation(root, template, data={}, options={}) {
  sessions.get(root)?.();
  const en=(data.language || options.lang || document.documentElement.lang)==='en';
  const t=textPair(en);
  const category=categories[template.category] || categories.general;
  const heading=data.title || category[en?1:0];
  const hostNames=names(template,data,t);
  const primary=hostNames || heading;
  const shownDate=formatDate(data.startAt,data.timeZone,en);
  const intro=template.titleEn || '';
  const envelope=/envelope|wax seal/i.test(intro);
  const portrait=list(data.images).filter(im=>im.role!=='background').sort((a,b)=>Number(!!b.primary)-Number(!!a.primary)).find(safePhoto);
  const portraitLead=portrait && /wax seal|editorial|photo album|birth announcement|photo timeline/i.test(intro);
  const initials=template.category==='wedding' ? [data.groom,data.bride].filter(Boolean).map(s=>Array.from(s.trim())[0]).join(' · ') : '';

  const theme=template.colorTokens || {};
  const paused=matchMedia('(prefers-reduced-motion: reduce)').matches || !!options.paused;
  const card=document.createElement('article');
  card.dataset.layout=template.layout || template.sceneComposition?.layout || 'folio';
  card.dataset.category=template.category;
  card.className='inv-card'+(options.opened?' opened':'')+(paused?' inv-paused':'')+(envelope?' inv-envelope-theme':'')+(options.preview?' inv-preview':'');
  card.dir=en?'ltr':'rtl';card.lang=en?'en':'ar';
  card.style.setProperty('--inv-accent',hex(data.accent)||hex(theme.accent)||'#b98e5f');
  card.style.setProperty('--inv-bg',hex(theme.background)||hex(theme.bg)||'#28213c');
  card.style.setProperty('--inv-paper',hex(theme.paper)||'#faf5ec');
  if(data.font==='sans')card.style.setProperty('--inv-serif','system-ui,sans-serif');
  else if(!data.font && template.typography)card.style.setProperty('--inv-serif',template.typography);
  card.innerHTML='<div class="inv-tools"><button type="button" class="inv-motion"></button><button type="button" data-skip>'+t('تخطي المقدمة','Skip intro')+'</button></div>'+
    '<header class="inv-stage"><div class="inv-art" aria-hidden="true">'+scene(template)+'</div><div class="inv-stage-shade"></div>'+
    '<div class="inv-stage-copy"><span class="inv-eyebrow">'+esc(data.occasion || category[en?1:0])+'</span><h1>'+esc(primary)+'</h1></div>'+
    (envelope?'<button class="inv-seal-target" type="button" data-open aria-label="'+t('افتح ختم الدعوة','Open the invitation seal')+'"></button>':'')+
    '<div class="inv-stage-foot"><button type="button" class="inv-open" data-open>'+icon('open')+t('افتح الدعوة','Open invitation')+'</button></div></header>'+
    '<div class="inv-body" '+(options.opened?'':'hidden')+'><div class="inv-stationery">'+
    (portraitLead?'<figure class="inv-portrait"><img decoding="async" loading="eager" fetchpriority="high" src="'+esc(safePhoto(portrait))+'"'+responsivePhoto(portrait)+' alt="'+esc(portrait.alt||t('صورة المناسبة','Event portrait'))+'" style="object-position:'+bound(portrait.x,0,100,50)+'% '+bound(portrait.y,0,100,50)+'%;transform-origin:'+bound(portrait.x,0,100,50)+'% '+bound(portrait.y,0,100,50)+'%;transform:scale('+bound(portrait.zoom,1,3,1)+') rotate('+bound(portrait.rotation,-180,180,0)+'deg)"></figure>':'')+
    '<div class="inv-diamond" aria-hidden="true">'+esc(initials || '✧')+'</div>'+
    '<h2 tabindex="-1">'+esc(hostNames?heading:primary)+'</h2>'+(hostNames?'<h3 class="inv-names">'+esc(hostNames)+'</h3>':'')+
    (data.hosts?'<p class="inv-hosts">'+esc(data.hosts)+'</p>':'')+(data.message?'<p class="inv-message">'+esc(data.message)+'</p>':'')+
    (shownDate?'<p class="inv-date">'+icon('calendar')+'<span>'+esc(shownDate)+'</span></p><small>'+esc(data.timeZone || 'Asia/Baghdad')+'</small>':'')+
    (data.showHijri&&shownDate?'<p>'+esc(formatDate(data.startAt,data.timeZone,en,true))+'<br><small>'+t('قد يختلف التاريخ الهجري حسب رؤية الهلال.','The local moon sighting may vary.')+'</small></p>':'')+
    extraFields(template,data,t)+'</div>'+sections(data,options,t)+
    '<footer class="inv-end"><div class="inv-actions">'+(shownDate?'<button type="button" data-calendar class="inv-btn">'+icon('calendar')+t('أضف للمفكرة','Add to calendar')+'</button>':'')+
    (!options.preview && options.slug?'<button type="button" data-share class="inv-btn">'+icon('share')+t('مشاركة الدعوة','Share invitation')+'</button><a class="inv-btn" target="_blank" rel="noopener noreferrer" href="https://wa.me/?text='+encodeURIComponent(heading+' '+location.href)+'">'+t('واتساب','WhatsApp')+'</a><button type="button" data-qr class="inv-btn">QR</button>':'')+
    (/^\+?[0-9\s()-]{7,22}$/.test(data.phone || '')?'<a class="inv-btn" href="tel:'+String(data.phone).replace(/[^\d+]/g,'')+'">'+t('اتصل بالمضيف','Call host')+'</a>':'')+
    (data.rsvpEnabled && /^https:\/\//i.test(data.rsvpUrl || '')?'<a class="inv-btn" target="_blank" rel="noopener noreferrer" href="'+esc(data.rsvpUrl)+'">'+t('رابط تأكيد الحضور','RSVP link')+'</a>':'')+
    '</div><div class="inv-qr" hidden></div><p data-share-note role="status"></p><p>'+t('يسعدنا أن نشارككم هذه المناسبة','Thank you for sharing this occasion with us')+'</p>'+
    ((!options.preview && options.slug)?'<details class="inv-report"><summary>'+t('الإبلاغ عن الدعوة','Report invitation')+'</summary><form><label>'+t('سبب البلاغ','Reason for reporting')+'<textarea name="reason" required minlength="3" maxlength="1500" rows="2"></textarea></label><button class="inv-btn" type="submit">'+t('إرسال البلاغ','Send report')+'</button><p role="status"></p></form></details>':'')+'</footer></div>';
  root.replaceChildren(card);
  const $=selector=>card.querySelector(selector);
  const body=$('.inv-body'),motion=$('.inv-motion');
  let motionPaused=paused, timer, revealTimer, observer,disposed=false;
  const controller=new AbortController();
  function syncMotion() {
    card.classList.toggle('inv-paused',motionPaused); card.classList.toggle('motion-off',motionPaused);
    motion.innerHTML=(motionPaused?icon('play'):icon('pause'))+'<span>'+(motionPaused?t('تشغيل الحركة','Play motion'):t('إيقاف الحركة','Pause motion'))+'</span>';
    motion.setAttribute('aria-pressed',String(motionPaused));
    card.querySelectorAll('svg').forEach(svg=>{try{if(motionPaused)svg.pauseAnimations?.();else svg.unpauseAnimations?.();}catch{}});
  }
  motion.onclick=()=>{motionPaused=!motionPaused;syncMotion();};syncMotion();
  function scrollEffects() {
    observer?.disconnect();
    if(!('IntersectionObserver' in window)) return;
    observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(entry.isIntersecting) {entry.target.classList.add('inv-appear');observer.unobserve(entry.target);}
    }),{threshold:.06});
    card.querySelectorAll('.inv-block').forEach(node=>observer.observe(node));
  }
  function showDetails(skip) {
    if(card.classList.contains('opened'))return;
    card.classList.add('opened');
    if(skip)card.classList.add('inv-skip');
    body.hidden=false;
    const delay=(skip||motionPaused)?0:envelope?1000:640;
    revealTimer=setTimeout(()=>{
      const target=$('.inv-stationery h2');
      target.focus({preventScroll:true});
      body.scrollIntoView({block:'start',behavior:(skip||motionPaused)?'instant':'smooth'});
      card.querySelectorAll('[data-open]').forEach(button=>button.hidden=true);
    },delay);
    scrollEffects();
  }
  card.querySelectorAll('[data-open]').forEach(button=>button.onclick=()=>showDetails(false));
  $('[data-skip]').onclick=()=>showDetails(true);
  if(options.opened)scrollEffects();
  const counter=$('[data-counter]');
  const units=en?['Days','Hours','Minutes','Seconds']:['يوم','ساعة','دقيقة','ثانية'];
  function tick() {
    if(!counter||disposed)return;
    const parts=countdownParts(data.startAt);
    if(!parts){counter.textContent=data.startedMessage||t('بدأت المناسبة','The occasion has started');return;}
    if(!counter.children.length)counter.innerHTML=units.map(unit=>'<span><b></b><small>'+unit+'</small></span>').join('');
    parts.forEach((value,i)=>{counter.children[i].firstChild.textContent=String(value).padStart(2,'0');});
    timer=setTimeout(tick,Math.max(60,1000-Date.now()%1000+10));
  }
  tick();
  if($('[data-calendar]'))$('[data-calendar]').onclick=()=>downloadCalendar({...data,slug:options.slug});
  if($('[data-share]'))$('[data-share]').onclick=async()=>{if(await shareInvitation(location.href,heading)==='copied')$('[data-share-note]').textContent=t('تم نسخ الرابط','Link copied');};
  if($('[data-qr]'))$('[data-qr]').onclick=()=>{const wrap=$('.inv-qr');wrap.hidden=!wrap.hidden;if(!wrap.hidden)showQR(wrap,location.href);};
  const report=$('.inv-report form');
  if(report)report.onsubmit=async event=>{
    event.preventDefault();
    const submit=report.querySelector('button'), status=report.querySelector('[role=status]');
    submit.disabled=true;
    try {
      const response=await fetch('/api/public/'+encodeURIComponent(options.slug)+'/report',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({reason:report.elements.reason.value.trim()})});
      if(!response.ok)throw new Error();
      status.textContent=t('وصل البلاغ إلى إدارة المنصة.','Your report has been sent to the platform team.');
      report.elements.reason.readOnly=true;
    }catch{if(!controller.signal.aborted){status.textContent=t('تعذر إرسال البلاغ. أعد المحاولة لاحقًا.','Could not send the report. Please try again later.');submit.disabled=false;}}
  };
  const form=$('.inv-rsvp-form');
  if(form) {
    form.elements.attending.onchange=()=>{const declined=form.elements.attending.value==='no';form.querySelector('[data-party]').hidden=declined;form.elements.count.disabled=declined;};
    const submissionKey='waraq-rsvp:'+options.slug;
    let submissionId;
    try {submissionId=sessionStorage.getItem(submissionKey)||crypto.randomUUID();sessionStorage.setItem(submissionKey,submissionId);}catch{submissionId=crypto.randomUUID();}
    const trap=document.createElement('input');trap.name='website';trap.tabIndex=-1;trap.autocomplete='off';trap.setAttribute('aria-hidden','true');trap.style.cssText='position:fixed;left:0;top:0;width:1px;height:1px;clip-path:inset(50%);opacity:0;pointer-events:none';form.append(trap);
    form.onsubmit=async event=>{
      event.preventDefault();
      const feedback=form.querySelector('[data-feedback]');
      if(options.preview || !options.slug){feedback.textContent=t('ظهر ردّك في المعاينة. تُحفظ الردود بعد النشر.','Preview received. Responses are saved on the published invitation.');return;}
      const submit=form.querySelector('[type=submit]');submit.disabled=true;
      const attending=form.elements.attending.value==='yes';
      try{
        const response=await fetch('/api/public/'+encodeURIComponent(options.slug)+'/rsvp',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({name:form.elements.name.value.trim(),attending,count:attending?Number(form.elements.count.value):0,comment:form.elements.comment.value.trim(),submissionId,website:trap.value})});
        if(!response.ok)throw new Error(response.status===429?t('انتظر قليلًا قبل إعادة المحاولة.','Please wait before trying again.'):t('تعذر حفظ الرد. تحقق من البيانات وأعد المحاولة.','Could not save your response. Check your details and try again.'));
        form.replaceChildren(Object.assign(document.createElement('p'),{textContent:t('شكرًا لك، وصل ردّك إلى المضيف.','Thank you. Your host has received your response.'),role:'status'}));
      }catch(error){if(!controller.signal.aborted){feedback.textContent=error.message;submit.disabled=false;}}
    };
  }
  const disposeExperience=enhanceExperience(card,template,data,options);
  const cleanup=()=>{disposeExperience();disposed=true;clearTimeout(timer);clearTimeout(revealTimer);observer?.disconnect();controller.abort();sessions.delete(root);};
  sessions.set(root,cleanup);return cleanup;
}

export async function renderGuest(root,slug) {
  const en=document.documentElement.lang==='en', t=textPair(en);
  const path='/api/public/'+encodeURIComponent(slug);
  const controller=new AbortController();
  const active=()=>root.isConnected && !controller.signal.aborted && root.contains(panel);
  const panel=document.createElement('div');panel.className='inv-gate';panel.dir=en?'ltr':'rtl';root.replaceChildren(panel);
  panel.textContent=t('جارٍ فتح الدعوة…','Opening invitation…');
  async function load(pin) {
    try{
      const response=await fetch(path+(pin===undefined?'':'/unlock'),pin===undefined?{cache:'no-store',signal:controller.signal}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin}),signal:controller.signal});
      const json=await response.json();
      if(!active())return;
      if(response.status===401 || json.code==='PIN_REQUIRED') {
        panel.innerHTML='<form><span aria-hidden="true" class="inv-gate-seal">✧</span><h1>'+t('دعوة خاصة','A private invitation')+'</h1><label>'+t('أدخل رمز الدعوة المرسل من المضيف','Enter the code shared by your host')+'<input type="password" name="pin" maxlength="64" required autocomplete="off"></label><button type="submit" class="inv-btn inv-primary">'+t('افتح الدعوة','Open invitation')+'</button><p role="status"></p></form>';
        if(pin!==undefined)panel.querySelector('[role=status]').textContent=t('تعذر فتح الدعوة بهذا الرمز.','The code did not open the invitation.');
        panel.querySelector('form').onsubmit=event=>{event.preventDefault();const form=event.currentTarget;form.querySelector('button').disabled=true;load(form.elements.pin.value);};return;
      }
      if(!response.ok)throw new Error(response.status===404?t('هذه الدعوة غير متاحة حاليًا.','This invitation is currently unavailable.'):response.status===429?t('انتظر قليلًا قبل إعادة المحاولة.','Please wait before trying again.'):t('تعذر تحميل الدعوة.','Could not load this invitation.'));
      const invitation=json.invitation;
      const template=withDesign(templates.find(item=>item.id===(invitation.custom?.base??invitation.templateId)),invitation.custom);
      if(!template)throw new Error(t('قالب الدعوة غير متاح.','Invitation design unavailable.'));
      document.title=invitation.data.title || template.titleAr;
      renderInvitation(root,template,{...invitation.data,...invitation.settings},{slug});
    }catch(error){if(active()) {panel.replaceChildren();const p=document.createElement('p');p.textContent=error.message;panel.append(p);const retry=document.createElement('button');retry.className='inv-btn';retry.textContent=t('أعد المحاولة','Try again');retry.onclick=()=>load();panel.append(retry);}}
  }
  await load();
  return ()=>{controller.abort();sessions.get(root)?.();};
}


