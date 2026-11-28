const sections=[
 ['requests','طلبات الإيجار','Rental requests','▤'],
 ['accounts','الحسابات','Accounts','◉'],
 ['invitations','الدعوات','Invitations','◇'],
 ['templates','القوالب','Templates','▧'],
 ['social','روابط التواصل','Social links','↗']
];
const socialNames={instagram:'Instagram',tiktok:'TikTok',whatsapp:'WhatsApp'};
function el(tag,klass,content) {
 const element=document.createElement(tag);
 if(klass)element.className=klass;
 if(content!==undefined)element.textContent=content;
 return element;
}
function group(tag,klass,...children){
 const element=el(tag,klass);element.append(...children);return element;
}
function button(text,action,klass='sa-button'){
 const element=el('button',klass,text);element.type='button';element.onclick=action;return element;
}
function field(text,control){
 return group('label','sa-field',el('span','',text),control);
}
function input(name,type='text',value=''){
 return Object.assign(el('input'),{name,type,value});
}
function option(value,name){
 return Object.assign(el('option','',name),{value});
}
function anchor(text,href){
 return Object.assign(el('a','sa-button',text),{href});
}
function actionForm(form,out,action){
 form.onsubmit=async event=>{
  event.preventDefault();
  const controls=[...form.querySelectorAll('button')];
  controls.forEach(control=>control.disabled=true);
  out.textContent='';
  try{await action(new FormData(form),event.submitter?.value);}
  catch(error){out.textContent=error.message;}
  finally{controls.forEach(control=>control.disabled=false);form.oninput?.();}
 };
}
export async function renderSuperAdmin(page,{state,api,t,templates}){
 const status=el('p','sa-status');status.setAttribute('role','status');
 const nav=el('nav','sa-nav');nav.setAttribute('aria-label',t('أقسام الإدارة','Management sections'));
 const content=el('section','sa-content');
 const metrics=el('div','sa-metrics');
 const sidebar=group('aside','sa-sidebar',group('div','sa-brand',el('span','sa-brand-icon','و'),group('div','',el('strong','',t('وَرَق','WARAQ')),el('small','',t('إدارة المنصة','Platform management')))),nav,
  anchor(t('البلاغات والمناسبات','Reports and occasions'),'/admin?section=moderation'),
  anchor(t('دعواتي','My invitations'),'/dashboard'));
 const main=group('div','sa-main',group('header','sa-header',
  el('h1','',t('لوحة إدارة وَرَق','WARAQ management')),
  el('p','sa-muted',t('راجع طلبات الإيجار وتابع الحسابات والدعوات من مكان واحد.','Review rentals and manage accounts and invitations.'))),metrics,status,content);
 page.classList.add('super-admin');
 page.replaceChildren(sidebar,main);
 const locale=document.documentElement.lang;
 const number=value=>new Intl.NumberFormat(locale).format(Number(value));
 const formatDate=(value,timeZone)=>new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short',timeZone}).format(new Date(value));
 const name=template=>t(template?.titleAr,template?.titleEn);
 const names={pending:t('بانتظار المراجعة','Pending review'),approved:t('مقبول','Approved'),
 rejected:t('مرفوض','Declined'),all:t('جميع الطلبات','All requests')};
 let view=0,active='requests',filter='pending',account=null;
 const more=(label,load)=>button(label,async event=>{
  const control=event.currentTarget;control.disabled=true;
  try{await load(control);}catch(error){status.textContent=error.message;control.disabled=false;}
 });
 const empty=()=>el('p','sa-empty',t('لا توجد عناصر في هذه القائمة.','There are no items in this list.'));
 async function refreshMetrics(){
  const overview=await api('/admin/rental-overview');
  const labels=[['pending',t('طلبات تنتظر المراجعة','Pending requests')],['live',t('إيجارات نشطة','Active rentals')],
   ['accounts',t('الحسابات','Accounts')],['invitations',t('الدعوات','Invitations')]];
  metrics.replaceChildren(...labels.map(([key,label])=>group('div','sa-metric',el('span','sa-muted',label),el('strong','',number(overview[key])))));
 }
 function table(headers,rows){
  const head=group('thead','',group('tr','',...headers.map(header=>Object.assign(el('th','',header),{scope:'col'}))));
  const body=el('tbody');
  rows.forEach(row=>body.append(group('tr','',...row.map((value,i)=>{
   const cell=el('td');cell.dataset.label=headers[i];cell.append(value);return cell;
  }))));
  return group('div','sa-table-wrap',group('table','sa-table',head,body));
 }
 async function review(item,trigger){
  const dialog=el('dialog','sa-dialog');
  const detailTitle=el('h2','',item.title);detailTitle.id='review-title';
  dialog.setAttribute('aria-labelledby',detailTitle.id);
  const close=button(t('إغلاق','Close'),()=>dialog.close());
  const response=el('p','sa-status');response.setAttribute('role','status');
  const detail=group('div','sa-review-detail',el('p','sa-muted',t('جارٍ تحميل بيانات الدعوة…','Loading invitation details…')));
  dialog.append(group('div','sa-row-heading',detailTitle,close),detail,response);
  dialog.addEventListener('close',()=>{dialog.remove();if(trigger.isConnected)trigger.focus();else content.querySelector('h2')?.focus();},{once:true});
  page.append(dialog);dialog.showModal();
  try{
   const info=await api('/admin/rentals/'+item.id);
   detail.replaceChildren(el('p','sa-muted',item.email),
    table([t('مدة الإيجار','Duration'),t('موعد المناسبة','Event time'),t('المكان','Venue')],
     [[number(item.days)+' '+t('يوم','days'),info.start_at?formatDate(info.start_at,info.time_zone||undefined)+' · '+(info.time_zone||''):'—',info.place||'—']]),
    ...(info.message?[el('p','sa-note',info.message)]:[]),
    group('div','sa-review-note',el('h3','',t('ملاحظة العميل','Customer note')),el('p','sa-note',item.note||'—')));
   const form=el('form','sa-form');
   const confirmed=input('confirmed','checkbox');
   const reference=input('reference');reference.maxLength=120;
   const approve=Object.assign(el('button','sa-button sa-primary',t('موافقة وتفعيل الرابط','Approve and activate link')),{value:'approved',disabled:true});
   const decline=Object.assign(el('button','sa-button',t('رفض الطلب','Decline request')),{value:'rejected'});
   form.oninput=()=>{approve.disabled=!confirmed.checked||!reference.value.trim();};
   form.append(field(t('مرجع التسوية الخارجية','External settlement reference'),reference),
    group('label','sa-check',confirmed,el('span','',t('أؤكد أن التسوية الخارجية تمت','I confirm that external settlement is complete'))),
    group('div','sa-action-row',approve,decline));
   dialog.append(form);
   actionForm(form,response,async (data,verdict)=>{
    if(!verdict)return;
    if(verdict==='rejected'&&!window.confirm(t('تأكيد رفض الطلب؟','Decline this request?')))return;
    await api('/admin/rentals/'+item.id,'POST',{state:verdict,settlementConfirmed:data.has('confirmed'),settlementReference:data.get('reference')});
    dialog.close();await open('requests');content.querySelector('h2')?.focus();await refreshMetrics();
    status.textContent=t('تم حفظ القرار.','Decision saved.');
   });
  }catch(error){response.textContent=error.message;}
 }
 async function requests(panel,ticket){
  const chooser=el('select');chooser.append(...Object.entries(names).map(([key,label])=>option(key,label)));chooser.value=filter;
  chooser.onchange=()=>{filter=chooser.value;void open('requests');};
  const list=el('div','sa-list');
  panel.append(field(t('حالة الطلب','Request status'),chooser),list);
  async function load(cursor,control){
   const result=await api('/admin/rentals?state='+filter+(cursor?'&cursor='+encodeURIComponent(cursor):''));
   if(ticket!==view)return;
   control?.remove();
   if(!cursor&&!result.items.length)list.append(empty());
   for(const item of result.items){
    const top=group('div','sa-row-heading',group('div','',el('h3','',item.title),el('p','sa-muted',item.email)),el('span','sa-pill sa-'+item.state,names[item.state]));
    const brief=group('div','sa-request-meta',el('span','',number(item.days)+' '+t('يوم','days')),el('time','',formatDate(item.createdAt)));
    const row=group('article','sa-request',top,brief);
    if(item.note)row.append(el('p','sa-note',item.note));
    if(item.settlement_ref)row.append(el('p','sa-muted',t('مرجع التسوية','Settlement reference')+' · '+item.settlement_ref));
    if(item.state==='pending')row.append(button(t('مراجعة الطلب','Review request'),event=>review(item,event.currentTarget),'sa-button sa-primary'));
    list.append(row);
   }
   if(result.pagination.hasMore)list.append(more(t('عرض المزيد من الطلبات','Load more requests'),control=>load(result.pagination.nextCursor,control)));
  }
  await load();
 }
 async function records(panel,ticket,type){
  const isAccount=type==='accounts';
  if(!isAccount&&account)panel.append(button(t('عرض دعوات كل الحسابات','Show invitations from all accounts'),()=>{account=null;void open('invitations');}));
  const list=el('div','sa-list');panel.append(list);
  async function load(after,control){
   const params=new URLSearchParams();
   if(after)params.set('after',after);
   if(!isAccount&&account)params.set('account',account);
   const result=await api('/admin/'+(isAccount?'accounts':'all-invitations')+'?'+params);
   if(ticket!==view)return;
   control?.remove();
   if(!result.items.length){list.append(empty());return;}
   const headers=isAccount?[t('الحساب','Account'),t('الدور','Role'),t('عدد الدعوات','Invitations'),t('الإجراء','Action')]:
    [t('الدعوة','Invitation'),t('الحساب','Account'),t('حالة الرابط','Link status'),t('نهاية الإيجار','Rental ends')];
   const rows=result.items.map(item=>isAccount?[item.email,item.role==='admin'?t('مدير','Administrator'):t('عميل','Customer'),
    number(item.invitation_count),button(t('عرض دعوات الحساب','View invitations'),()=>{account=item.id;void open('invitations');})]:
    [item.title||item.id,item.email,item.link_active?t('متاح','Open'):item.rental_until&&new Date(item.rental_until)<=new Date()?t('منتهي','Expired'):t('مغلق','Closed'),
     item.rental_until?formatDate(item.rental_until):'—']);
   const current=list.querySelector('tbody');
   const next=table(headers,rows);
   if(current)current.append(...next.querySelector('tbody').children);else list.append(next);
   if(result.next)list.append(more(t('عرض المزيد','Load more'),control=>load(result.next,control)));
  }
  await load();
 }
 async function designs(panel,ticket){
  const {items}=await api('/admin/custom-templates');
  if(ticket!==view)return;
  const form=el('form','sa-form sa-create');
  const base=Object.assign(el('select'),{name:'base'});
  base.append(...templates.map(template=>option(template.id,name(template))));
  const ar=input('titleAr'),en=input('titleEn');
  for(const title of [ar,en]){title.required=true;title.maxLength=80;}
  const bg=input('background','color','#211932'),accent=input('accent','color','#dcb98a');
  form.append(el('h3','',t('قالب جديد','New template')),field(t('التصميم الأساس','Base design'),base),
   group('div','sa-fields',field(t('الاسم بالعربية','Arabic name'),ar),field(t('الاسم بالإنجليزية','English name'),en)),
   group('div','sa-fields',field(t('لون الخلفية','Background'),bg),field(t('اللون المميز','Accent'),accent)),
   el('button','sa-button sa-primary',t('حفظ قالب كمسودة','Save template as draft')));
  actionForm(form,status,async data=>{await api('/admin/custom-templates','POST',Object.fromEntries(data));await open('templates');status.textContent=t('تم حفظ مسودة القالب.','Template draft saved.');});
  panel.append(form);
  if(!items.length)panel.append(empty());
  for(const item of items){
   const visible=state.templates.find(x=>x.id===item.id)?.published;
   const card=group('article','sa-request',group('div','sa-row-heading',el('h3','',t(item.title_ar,item.title_en)),el('span','sa-pill',visible?t('منشور','Published'):t('مسودة','Draft'))));
   const swatches=el('div','sa-swatches');
   for(const color of [item.background,item.accent]){const swatch=el('span');swatch.style.backgroundColor=color;swatch.title=color;swatches.append(swatch);}
   const publish=more(visible?t('إخفاء القالب','Hide template'):t('نشر القالب','Publish template'),async()=>{
    await api('/admin/templates/'+item.id,'PATCH',{published:!visible});await open('templates');
   });
   card.append(swatches,group('div','sa-action-row',publish,...(visible?[anchor(t('عرض القالب','View template'),'/templates/'+item.id)]:[])));panel.append(card);
  }
 }
 async function links(panel,ticket){
  const catalog=await api('/catalog');
  if(ticket!==view)return;
  const values=new Map(catalog.social.map(entry=>[entry.platform,entry.url]));
  for(const [platform,label] of Object.entries(socialNames)){
   const form=el('form','sa-form sa-social');
   const url=input('url','url',values.get(platform)||'');url.dir='ltr';url.maxLength=500;
   form.append(field(label,url),el('button','sa-button',t('حفظ الرابط','Save link')));
   actionForm(form,status,async data=>{
    await api('/admin/social/'+platform,'PATCH',{url:data.get('url').trim()});
    status.textContent=t('تم حفظ روابط التواصل.','Social links saved.');
   });
   panel.append(form);
  }
 }
 async function open(key){
  active=key;const ticket=++view;status.textContent='';
  for(const target of nav.children)target.setAttribute('aria-pressed',String(target.dataset.section===key));
  const section=sections.find(section=>section[0]===key);
  const title=el('h2','',t(section[1],section[2]));title.tabIndex=-1;
  const body=el('div','sa-section-body');
  const loading=el('p','sa-muted',t('جارٍ التحميل…','Loading…'));loading.setAttribute('role','status');
  body.append(loading);content.replaceChildren(title,body);
  content.setAttribute('aria-busy','true');
  try{
   if(key==='requests')await requests(body,ticket);
   else if(key==='templates'){
    state.templates=(await api('/admin')).templates;
    if(ticket===view)await designs(body,ticket);
   }else if(key==='social')await links(body,ticket);
   else await records(body,ticket,key);
  }catch(error){
   if(ticket===view){status.textContent=error.message;body.append(button(t('إعادة المحاولة','Try again'),()=>open(active)));}
  }finally{loading.remove();if(ticket===view)content.setAttribute('aria-busy','false');}
 }
 for(const [key,ar,en,icon] of sections){
  const item=button('',()=>{if(key==='invitations')account=null;void open(key);},'sa-nav-button');
  const symbol=el('span','sa-nav-icon',icon);symbol.setAttribute('aria-hidden','true');
  item.dataset.section=key;item.append(symbol,el('span','',t(ar,en)));nav.append(item);
 }
 await Promise.all([open('requests'),refreshMetrics().catch(error=>status.textContent=error.message)]);
}
