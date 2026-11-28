import {delayedSkeleton,optimisticChange} from './async-ui.js';
import {withDesign,renderSocial} from './rental-template.js';
import { templates } from './templates/index.js';

const lang = () => document.documentElement.lang.startsWith('en') ? 'en' : 'ar';
const t = (ar, en) => lang() === 'en' ? en : ar;
const categoryNames = {
  general:['عام','General'], ramadan:['رمضان','Ramadan'], fitr:['عيد الفطر','Eid al-Fitr'],
  hajj:['الحج','Hajj'], adha:['عيد الأضحى','Eid al-Adha'], wedding:['زواج','Wedding'],
  baby:['مولود جديد','New baby'], graduation:['تخرج','Graduation']
};
const category = id => categoryNames[id] ? t(...categoryNames[id]) : id;
const labels = {
  draft:['مسودة','Draft'],published:['منشورة','Published'],archived:['مؤرشفة','Archived']
};
const template = id => templates.find(item => item.id === id);
const templateName = item => item ? t(item.titleAr,item.titleEn) : '';
const statusName = status => labels[status] ? t(...labels[status]) : status;
const title = invitation => invitation.data?.title || templateName(template(invitation.templateId)) || t('دعوة','Invitation');
const detailPath = id => '/dashboard/invitations/'+encodeURIComponent(id);
const editPath = invitation => '/create/'+encodeURIComponent(invitation.templateId)+'?id='+encodeURIComponent(invitation.id);
const guestLink = invitation => new URL('/i/'+encodeURIComponent(invitation.slug),location.origin).href;
const authPath = () => '/auth?next='+encodeURIComponent(location.pathname+location.search);
const n = number => new Intl.NumberFormat(lang()).format(number);
function prettyDate(stamp) {
  if (!stamp) return '';
  const date = new Date(stamp);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(lang(), {dateStyle:'medium'}).format(date);
}
function el(tag,className,text) {
  const node = document.createElement(tag);
  if(className) node.className=className;
  if(text!==undefined) node.textContent=text;
  return node;
}
function box(className,...children) {
  const node=el('div',className);
  node.append(...children);
  return node;
}
function link(text,href,cls='db-btn') {
  const result=el('a',cls,text);
  result.href=href;
  return result;
}
function button(text,action,cls='db-btn') {
  const b=el('button',cls,text); b.type='button';
  b.addEventListener('click',action);
  return b;
}
function message() {
  const result=el('p','db-message');
  result.setAttribute('role','status');
  result.setAttribute('aria-live','polite');
  return result;
}
function start(root) {
  const section=el('section','db-page');
  section.append(el('p','db-load',t('جارٍ التحميل…','Loading…')));
  root.replaceChildren(section);
  const clear=delayedSkeleton(section);new MutationObserver((_,observer)=>{if(!section.querySelector('.db-load')){clear();observer.disconnect();}}).observe(section,{childList:true});
  return section;
}
function panel(...children) { return box('db-panel',...children); }
function heading(text, description='') {
  return box('db-heading',el('h1','',text),...(description?[el('p','db-sub',description)]:[]));
}
function line(text,values) { return box('db-line',el('span','db-sub',text),el('strong','',values)); }
function notice(page,error,retry) {
  const texts={401:[t('سجّل الدخول لفتح دعواتك','Sign in to open your invitations'),t('متابعة','Continue'),authPath()],
    403:[t('هذه الصفحة متاحة لمسؤولي المنصة','This page requires administrator access'),t('دعواتي','My invitations'),'/dashboard'],
    404:[t('تعذّر العثور على الدعوة','Invitation unavailable'),t('دعواتي','My invitations'),'/dashboard']};
  const choice=texts[error.status];
  page.replaceChildren(panel(heading(choice?.[0] || t('تعذّر تحميل الصفحة','This page could not be loaded')),
    choice ? link(choice[1],choice[2]) : button(t('إعادة المحاولة','Try again'),retry)));
}
async function api(path,method='GET',body) {
  const options={method,credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}};
  if (method!=='GET') {
    options.headers['Content-Type']='application/json';
    options.body=JSON.stringify(body??{});
  }
  const response=await fetch('/api'+path,options);
  const value=await response.json().catch(()=>({}));
  const errorMessages={
    BAD_CREDENTIALS:'Check your email and password.', EMAIL_IN_USE:'This email address cannot be used.',
    INVALID_INPUT:'Check the details and try again.', NOT_FOUND:'This invitation is unavailable.',
    FORBIDDEN:'Administrator access required.', AUTH_REQUIRED:'Sign in to continue.',
    RATE_LIMIT:'Too many requests. Please try again later.', SERVER_ERROR:'The server could not complete your request.'
  };
  const englishError=lang()==='en' ? errorMessages[value.error?.code||value.code] : '';
  if(!response.ok) throw Object.assign(new Error(englishError||value.error?.message||(typeof value.error==='string'?value.error:'')||t('تعذّر تنفيذ الطلب. حاول مجددًا.','Request failed. Please try again.')),{status:response.status});
  return value;
}
function act(text,action,out,cls) {
  return button(text,async event=>{
    const control=event.currentTarget;
    control.disabled=true;
    out.textContent='';
    try {await action(control);}
    catch(error) {out.textContent=error.message || t('تعذّر تنفيذ الطلب','Request failed');}
    finally {control.disabled=false;}
  },cls);
}
function guestState(invitation) {
  if(invitation.rentalUntil&&!invitation.linkActive&&new Date(invitation.rentalUntil)<=new Date())return el('span','db-state',t('منتهية','Expired'));
  return el('span','db-state db-'+invitation.status,statusName(invitation.status));
}
function nextDestination() {
  const raw=new URLSearchParams(location.search).get('next');
  if (!raw) return '/dashboard';
  try {
    const next=new URL(raw,location.origin);
    if(next.origin===location.origin && /^\/(create\/[\w-]+|dashboard(?:\/invitations\/[\w-]+)?|admin)\/?$/.test(next.pathname)) return next.pathname+next.search+next.hash;
  } catch {}
  return '/dashboard';
}
function labeled(text,input) {
  const label=el('label','db-field');
  label.append(el('span','',text),input);
  return label;
}
export async function renderAuth(root) {
  const page=start(root);
  const mode=new URLSearchParams(location.search).get('mode');
  if(['forgot','reset','verify'].includes(mode)) {
    const token=new URLSearchParams(location.hash.slice(1)).get('token');
    if(token)history.replaceState(null,'',location.pathname+location.search);
    const out=message(),form=el('form','db-form');
    const input=el('input');input.required=true;
    input.type=mode==='forgot'?'email':'password';input.autocomplete=mode==='forgot'?'email':'new-password';
    if(mode==='reset'){input.minLength=8;input.maxLength=128;}
    const submit=el('button','db-btn db-primary',t('متابعة','Continue'));submit.type='submit';
    if(mode!=='verify')form.append(labeled(mode==='forgot'?t('البريد الإلكتروني','Email'):t('كلمة المرور الجديدة','New password'),input));
    form.append(out,submit);
    form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;try{
      const result=await api('/auth/'+mode,'POST',mode==='forgot'?{email:input.value.trim()}:{token,password:input.value});
      out.textContent=mode==='forgot'?t('إذا كان الحساب موجودًا ستصلك رسالة بخطوات الاستعادة.','If the account exists, an email with recovery steps will arrive.'):t('تمت العملية. يمكنك تسجيل الدخول.','Completed. You can sign in.');
      if(mode!=='forgot')input.disabled=true;
    }catch(error){out.textContent=error.message;submit.disabled=false;}};
    page.replaceChildren(heading(mode==='forgot'?t('استعادة كلمة المرور','Password recovery'):mode==='reset'?t('كلمة مرور جديدة','Set a new password'):t('تأكيد البريد','Verify email')),form,link(t('تسجيل الدخول','Sign in'),'/auth'));return;
  }
  try {
    const {user}=await api('/me');
    if(user) { location.replace(nextDestination()); return; }
    const email=el('input'); email.type='email'; email.autocomplete='email'; email.maxLength=254; email.dir='ltr'; email.required=true; email.name='email';
    const password=el('input'); password.required=true; password.type='password'; password.name='password'; password.dir='auto';
    const passwordLabel=labeled(t('كلمة المرور','Password'),password);
    const out=message();
    const toggler=button('',()=>setMode(!signup),'db-text-btn');
    const submit=el('button','db-btn db-primary'); submit.type='submit';
    const h=el('h1');
    const help=el('p','db-sub');
    const hint=el('p','db-sub');
    const form=el('form','db-form');
    const show=button(t('إظهار كلمة المرور','Show password'),()=>{
      const hidden=password.type==='password';
      password.type=hidden?'text':'password';
      show.textContent=hidden?t('إخفاء كلمة المرور','Hide password'):t('إظهار كلمة المرور','Show password');
      show.setAttribute('aria-pressed',String(hidden));
    },'db-text-btn');
    form.append(labeled(t('البريد الإلكتروني','Email address'),email),passwordLabel,show,hint,out,submit);
    let signup=new URLSearchParams(location.search).get('mode')==='register';
    function setMode(mode) {
      signup=mode; out.textContent='';
      password.autocomplete=mode?'new-password':'current-password';
      password.minLength=mode?8:1; password.maxLength=128;
      hint.textContent=mode?t('اختر كلمة مرور من ٨ أحرف على الأقل.','Use a password with at least 8 characters.'):'';
      h.textContent=mode?t('أنشئ حسابك','Create your account'):t('تسجيل الدخول','Sign in');
      help.textContent=t('احفظ دعواتك وشاركها وتابع ردود ضيوفك.','Save invitations, share them and keep track of guest replies.');
      submit.textContent=mode?t('إنشاء الحساب','Create account'):t('دخول','Sign in');
      toggler.textContent=mode?t('عندي حساب بالفعل','I already have an account'):t('إنشاء حساب جديد','Create an account');
    }
    form.addEventListener('submit',async event=>{
      event.preventDefault(); if(submit.disabled) return;
      submit.disabled=true; toggler.disabled=true; out.textContent=t('جارٍ التحقق…','Please wait…');
      try {
        await api(signup?'/auth/register':'/auth/login','POST',{email:email.value.trim(),password:password.value});
        location.replace(nextDestination());
      } catch(error) {out.textContent=error.message; submit.disabled=false; toggler.disabled=false;}
    });
    setMode(signup);
    const art=el('div','db-auth-art');
    const cover=template('blush-floral-envelope')||templates[0];
    if(cover) {const img=el('img');img.src=cover.thumbnail;img.alt='';art.append(img);}
    page.replaceChildren(box('db-auth',art,box('db-auth-main',h,help,form,toggler,link(t('نسيت كلمة المرور؟','Forgot password?'),'/auth?mode=forgot','db-text-btn'))));
  } catch(error) {notice(page,error,()=>renderAuth(root));}
}
function accountBar(user,out) {
  const actions=box('db-actions');
  actions.append(act(t('تنظيف الملفات غير المستخدمة','Clean unused uploads'),async()=>{
    if(!window.confirm(t('إزالة الملفات غير المرتبطة بدعوات؟ قد تفقد إمكانية التراجع عن صور قديمة.','Remove uploads not linked to invitations? This may remove old images from Undo history.')))return;
    await api('/assets','DELETE',{confirm:'unused'});out.textContent=t('تم تنظيف الملفات غير المستخدمة.','Unused uploads removed.');
  },out,'db-text-btn'));
  actions.append(act(t('تأكيد البريد الإلكتروني','Verify email'),async()=>{
    await api('/auth/request-verification','POST',{});out.textContent=t('تم طلب إرسال رسالة تأكيد.','Verification email requested.');
  },out,'db-text-btn'));
  if(user.role==='admin') actions.append(link(t('إدارة المنصة','Administration'),'/admin','db-text-btn'));
  actions.append(act(t('خروج','Sign out'),async()=>{
    await api('/auth/logout','POST'); location.assign('/');
  },out,'db-text-btn'));
  return box('db-account',el('span','db-account-email',user.email),actions);
}
function displayList(page,user,invitations,state={}) {
  let pagination=state.pagination,activeStatus='all',filterVersion=0;const totals=state.totals||{},cache=new Map([['all',{invitations,pagination}]]);
  const more=button(t('عرض المزيد','Load more'),async()=>{more.disabled=true;const requestedStatus=activeStatus,requestedList=invitations;try{const result=await api('/invitations?status='+requestedStatus+'&cursor='+encodeURIComponent(pagination.nextCursor));requestedList.push(...result.invitations);cache.set(requestedStatus,{invitations:requestedList,pagination:result.pagination});if(activeStatus===requestedStatus){invitations=requestedList;pagination=result.pagination;renderFilter(activeStatus);}}catch(error){out.textContent=error.message;}finally{more.disabled=false;}});
  const out=message(), body=el('div','db-list'), filters=box('db-filters');
  const filterNames=['all','draft','published','archived'];
  function renderFilter(active) {
    const filtered=invitations.filter(item=>active==='all'||item.status===active);
    more.hidden=!pagination?.hasMore;
    for(const item of filters.children) item.setAttribute('aria-pressed',String(item.dataset.status===active));
    body.replaceChildren();
    if(!filtered.length) {
      const any=Object.values(totals).some(v=>Number(v)>0)||invitations.length;
      const msg=any?t('لا توجد دعوات بهذه الحالة.','No invitations with this status.'):t('أنشئ دعوتك الأولى','Create your first invitation');
      body.append(panel(el('h2','',msg),...(any?[]:[link(t('اختر مناسبة','Choose an occasion'),'/occasions','db-btn db-primary')])));
    }
    filtered.forEach((inv,index)=>{
      const design=template(inv.templateId);
      const item=el('article','db-row'); 
      if(design) {const cover=el('img','db-thumb');cover.alt='';cover.src=design.thumbnail;cover.loading=index<2?'eager':'lazy';item.append(cover);}
      const name=link(title(inv),detailPath(inv.id),'db-record-name');
      const meta=[templateName(design),prettyDate(inv.updatedAt)].filter(Boolean).join(' · ');
      const replyCount=t('الردود','Replies')+' '+n(inv.responseCount||0);
      const actions=box('db-actions',link(t('تعديل','Edit'),editPath(inv)),link(t('التفاصيل والردود','Details and replies'),detailPath(inv.id)));
      const row=box('db-row-info',guestState(inv),name,el('p','db-sub',meta),el('p','db-sub',replyCount),actions);
      item.append(row);body.append(item);
    });
  }
  for(const status of filterNames) {
    const label=status==='all'?t('الكل','All'):statusName(status);
    const count=status==='all'?(Object.values(totals).reduce((a,v)=>a+Number(v),0)||invitations.length):(totals[status]??invitations.filter(v=>v.status===status).length);
    const b=button(label+' · '+n(count),async()=>{const version=++filterVersion;b.disabled=true;try{let result=cache.get(status);if(!result){result=await api('/invitations?status='+status);cache.set(status,result);}if(version!==filterVersion)return;activeStatus=status;invitations=result.invitations;pagination=result.pagination;renderFilter(status);}catch(error){out.textContent=error.message;}finally{b.disabled=false;}},'db-filter');
    b.dataset.status=status;filters.append(b);
  }
  page.replaceChildren(accountBar(user,out),box('db-top',heading(t('دعواتي','My invitations')),link(t('إنشاء دعوة','Create invitation'),'/occasions','db-btn db-primary')),out,filters,body,more);
  renderFilter('all');
}
async function copyUrl(url,out) {
  try {
    if(!navigator.clipboard?.writeText) throw new Error();
    await navigator.clipboard.writeText(url);
    out.textContent=t('نُسخ رابط الدعوة.','Invitation link copied.');
  } catch {
    const input=el('input','db-input'); input.readOnly=true;input.dir='ltr';input.value=url;input.setAttribute('aria-label',t('رابط الدعوة','Invitation link'));
    out.replaceChildren(document.createTextNode(t('انسخ الرابط المحدد.','Copy the selected link.')),input);input.focus();input.select();
  }
}
function repliesPanel(responses,summary) {
  const people=responses.reduce((sum,r)=>sum+(r.attending?Number(r.count):0),0);
  const declined=responses.filter(r=>!r.attending).length;
  const rows=el('ul','db-replies');
  responses.forEach(r=>{
    const row=el('li');
    row.append(box('db-split',el('strong','',r.name),el('span','db-sub',r.attending?t('حاضر','Attending')+' · '+n(r.count):t('معتذر','Declined'))));
    if(r.comment) row.append(el('p','db-sub',r.comment));
    if(r.createdAt) row.append(el('small','db-sub',prettyDate(r.createdAt)));
    rows.append(row);
  });
  return panel(el('h2','',t('ردود الضيوف','Guest replies')),
    box('db-metrics',line(t('الردود','Replies'),n(summary?.total??responses.length)),line(t('الحاضرون','Attendees'),n(summary?.people??people)),line(t('الاعتذارات','Declines'),n(summary?.declined??declined))),
    responses.length?rows:el('p','db-sub',t('تظهر ردود ضيوفك هنا بعد إرسالها.','Guest replies will appear here as they arrive.')));
}
async function displayDetail(root,page,inv,responses,replyState={}) {
  const out=message(), design=withDesign(template(inv.custom?.base??inv.templateId),inv.custom);
  const live=inv.status==='published', shareable=live && inv.linkActive!==false;
  const url=shareable?guestLink(inv):null;
  const pending=inv.rental?.state==='pending';
  const expired=live&&inv.rentalUntil&&new Date(inv.rentalUntil)<=new Date();
  const canEdit=!pending&&!(inv.rentalUntil&&!expired&&live);
  const top=box('db-top',heading(title(inv),templateName(design)),guestState(inv));
  const edit=link(t('تعديل الدعوة والخصوصية','Edit invitation and privacy'),editPath(inv),'db-btn db-primary');
  const changing=act(live?t('أرشفة وإيقاف الرابط','Archive and disable link'):t('نشر الدعوة','Publish invitation'),async()=>{
    if(live && !window.confirm(t('سيُغلق رابط الضيوف حتى تعيد نشر الدعوة. متابعة؟','The guest link will close until you publish again. Continue?'))) return;
    await api('/invitations/'+encodeURIComponent(inv.id)+(live?'/archive':'/publish'),'POST');
    await renderDashboard(root,inv.id);
  },out);
  const manage=panel(el('h2','',t('إعدادات الدعوة','Invitation settings')),
    line(t('حالة الرابط','Link status'),pending?t('بانتظار الموافقة','Awaiting approval'):expired?t('انتهت مدة الإيجار','Rental ended'):shareable?t('متاح للضيوف','Open to guests'):live?t('القالب موقوف من إدارة المنصة','Template disabled by an administrator'):t('متوقف','Inactive')),
    line(t('الخصوصية','Privacy'),inv.settings?.privacy==='pin'?t('رمز دخول','PIN protected'):inv.settings?.privacy==='public'?t('عامة','Public'):t('غير مدرجة','Unlisted')),line(t('آخر تحديث','Last update'),prettyDate(inv.updatedAt)),box('db-actions',...(canEdit?[edit]:[]),...(!inv.rentals||(live&&!expired&&!pending)?[changing]:[])));
  if(inv.rentalUntil)manage.append(line(t('نهاية الإيجار بتوقيت جهازك','Rental ends in your device time zone'),new Intl.DateTimeFormat(lang(),{dateStyle:'medium',timeStyle:'short'}).format(new Date(inv.rentalUntil))));
  page.replaceChildren(link(t('العودة إلى دعواتي','Back to my invitations'),'/dashboard','db-text-btn'),top,out,manage);
  if(inv.rentals){
    const request=panel(el('h2','',t('طلب الإيجار','Rental request')));
    request.id='rental-request';
    const last=inv.rental;
    if(last){
      request.append(line(t('الحالة','Status'),{pending:t('بانتظار المراجعة','Awaiting review'),approved:t('تمت الموافقة','Approved'),rejected:t('لم يُقبل الطلب','Declined')}[last.state]),line(t('الأيام المطلوبة','Requested days'),n(last.days)));
      if(last.note)request.append(el('p','db-sub',last.note));
    }
    if(!pending&&(!live||expired)){
      const form=el('form','db-rental-form');
      const days=el('input','db-input');Object.assign(days,{type:'number',min:1,max:365,required:true,value:7});
      const note=el('textarea','db-input');note.maxLength=1000;note.rows=3;
      const send=el('button','db-btn db-primary',t('إرسال طلب الإيجار','Send rental request'));
      const feedback=message();
      form.append(el('p','db-sub',t('تبدأ المدة عند الموافقة. كل يوم يعادل 24 ساعة.','Your term starts on approval. Each day is 24 hours.')),labeled(t('مدة الإيجار بالأيام','Rental days'),days),labeled(t('ملاحظة للإدارة (اختياري)','Note for the administrator (optional)'),note),send,feedback);
      form.onsubmit=async event=>{
        event.preventDefault();send.disabled=true;feedback.textContent='';
        try{await api('/invitations/'+encodeURIComponent(inv.id)+'/rent','POST',{days:days.valueAsNumber,note:note.value,expectedUpdatedAt:inv.updatedAt});await renderDashboard(root,inv.id);}
        catch(error){feedback.textContent=error.message;send.disabled=false;}
      };
      request.append(form);
    }
    page.append(request);
    if(location.hash==='#rental-request'){request.tabIndex=-1;request.focus();}
  }
  if(shareable) {
    const shareOut=message(), q=el('div','db-qr');
    const {showQR,downloadShareCard}=await import('./invitation-share.js');
    const qrButton=button(t('إظهار رمز QR','Show QR code'),()=>{
      if(q.childElementCount) {q.replaceChildren();qrButton.textContent=t('إظهار رمز QR','Show QR code');qrButton.setAttribute('aria-expanded','false');}
      else {try{showQR(q,url);qrButton.textContent=t('إخفاء الرمز','Hide code');qrButton.setAttribute('aria-expanded','true');}catch(error){shareOut.textContent=error.message;}}
    });
    qrButton.setAttribute('aria-expanded','false');
    const open=link(t('فتح رابط الضيوف','Open guest link'),url); open.target='_blank';open.rel='noopener noreferrer';
    const whatsapp=link(t('مشاركة واتساب','Share on WhatsApp'),'https://wa.me/?text='+encodeURIComponent(title(inv)+'\n'+url));
    whatsapp.target='_blank'; whatsapp.rel='noopener noreferrer';
    const actions=box('db-actions',open,act(t('نسخ الرابط','Copy link'),()=>copyUrl(url,shareOut),shareOut),whatsapp,qrButton,
      act(t('تحميل بطاقة المشاركة','Download share card'),()=>downloadShareCard({...inv.data,settings:inv.settings},url),shareOut));
    page.append(panel(el('h2','',t('مشاركة الدعوة','Share invitation')),actions,shareOut,q));
  }
  const replies=box('db-replies-page');const paintReplies=()=>{replies.replaceChildren(repliesPanel(responses,replyState.summary));if(replyState.pagination?.hasMore)replies.append(act(t('عرض ردود إضافية','Load more replies'),async()=>{const result=await api('/invitations/'+encodeURIComponent(inv.id)+'/responses?cursor='+encodeURIComponent(replyState.pagination.nextCursor));responses.push(...result.responses);replyState=result;paintReplies();},out));};paintReplies();page.append(replies);
  page.append(panel(el('h2','',t('إدارة الدعوة','Manage invitation')),box('db-actions',
    link(t('تصدير الردود CSV','Export responses CSV'),'/api/invitations/'+encodeURIComponent(inv.id)+'/responses.csv'),
    act(t('نسخ الدعوة','Duplicate invitation'),async()=>{
      const body={};
      if(inv.settings?.privacy==='pin') {body.pin=window.prompt(t('رمز دخول جديد للنسخة، 4–12 رقمًا','New PIN for the copy, 4–12 digits'));if(body.pin===null)return;}
      const result=await api('/invitations/'+encodeURIComponent(inv.id)+'/copy','POST',body);
      location.assign(editPath(result.invitation));
    },out),
    act(t('حذف نهائي','Delete permanently'),async()=>{
      if(!window.confirm(t('حذف الدعوة وردودها نهائيًا؟ لا يمكن التراجع.','Permanently delete this invitation and its replies? This cannot be undone.')))return;
      await api('/invitations/'+encodeURIComponent(inv.id),'DELETE',{confirm:inv.id});location.assign('/dashboard');
    },out)
  )));
}
export async function renderDashboard(root,id) {
  const page=start(root);
  try {
    if(!id){const [{user},state]=await Promise.all([api('/me'),api('/invitations')]);if(!user){notice(page,{status:401});return;}displayList(page,user,state.invitations,state);return;}
    const {user}=await api('/me');if(!user){notice(page,{status:401});return;}
    const path='/invitations/'+encodeURIComponent(id);
    const [{invitation},replyState]=await Promise.all([api(path),api(path+'/responses')]);
    await displayDetail(root,page,invitation,replyState.responses,replyState);
  } catch(error){notice(page,error,()=>renderDashboard(root,id));}
}
export async function renderAdmin(root) {
  const page=start(root);
  try {
    const state=await api('/admin');
    if(state.rentals&&new URLSearchParams(location.search).get('section')!=='moderation'){
      const {renderSuperAdmin}=await import('./super-admin.js');
      return await renderSuperAdmin(page,{state,api,t,templates});
    }
    const out=message();
    const headingBar=box('db-top',heading(t('إدارة المنصة','Administration')),link(t('دعواتي','My invitations'),'/dashboard'));
    const tabs=box('db-filters'), content=el('div','db-admin-items');
    const pending=new Set();
    function manage(active) {
      for(const tab of tabs.children) tab.setAttribute('aria-pressed',String(tab.dataset.section===active));
      content.replaceChildren();
      const list=state[active] || [];
      if(active==='reports'&&state.pagination?.hasMore)content.append(act(t('عرض بلاغات إضافية','Load more reports'),async()=>{const result=await api('/admin?cursor='+encodeURIComponent(state.pagination.nextCursor));state.reports.push(...result.reports);state.pagination=result.pagination;manage(active);},out));
      if(!list.length){content.append(panel(el('p','db-sub',t('لا توجد عناصر لعرضها.','Nothing to display.')))); return;}
      list.forEach(item=>{
        const isReport=active==='reports';
        const h=active==='templates'?templateName(template(item.id))||item.id:active==='categories'?category(item.id):item.reason;
        const current=isReport?item.status==='open':item.published;
        const sub=isReport?item.slug+' · '+prettyDate(item.createdAt):item.id;
        const status=isReport?(current?t('مفتوح','Open'):t('معالَج','Resolved')):(current?t('ظاهر','Visible'):t('مخفي','Hidden'));
        const action=isReport?(current?t('تحديد كمعالَج','Resolve'):t('إعادة فتح','Reopen')):(current?t('إخفاء','Hide'):t('إظهار','Show'));
        const row=box('db-admin-row',box('db-admin-caption',el('h3','',h),el('p','db-sub',sub)),el('span','db-state',status));
        row.append(act(action,async()=>{
          const value=isReport?{status:current?'resolved':'open'}:{published:!current};
          if(isReport){const previous={status:item.status};pending.add(item.id);try{await optimisticChange({apply:()=>{Object.assign(item,value);manage(active);},commit:()=>api('/admin/'+active+'/'+encodeURIComponent(item.id),'PATCH',value),rollback:()=>{Object.assign(item,previous);manage(active);}});}finally{pending.delete(item.id);manage(active);}}else{await api('/admin/'+active+'/'+encodeURIComponent(item.id),'PATCH',value);Object.assign(item,value);manage(active);}out.textContent=t('حُفظ التغيير.','Changes saved.');
        },out));
        if(pending.has(item.id))row.querySelector('button').disabled=true;
        content.append(row);
      });
    }
    for(const [key,ar,en] of [['categories','المناسبات','Occasions'],['templates','القوالب','Templates'],['reports','البلاغات','Reports']]) {
      const b=button(t(ar,en)+' · '+n(state[key]?.length||0),()=>manage(key),'db-filter');
      b.dataset.section=key;tabs.append(b);
    }
    page.replaceChildren(...(state.rentals?[link(t('العودة إلى لوحة الإدارة','Back to platform management'),'/admin')]:[]),headingBar,out,tabs,content);manage('categories');
  } catch(error) {notice(page,error,()=>renderAdmin(root));}
}



