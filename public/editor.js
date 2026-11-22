import { renderInvitation } from './invitation.js';
import { specialFields, localDateTime, utcCandidates, validMap, sectionLabels, localDraft } from './editor-model.js';
import { preparePhoto } from './editor-images.js';

function node(tag, props={}, ...children) {
  const element = document.createElement(tag);
  Object.assign(element, props);
  element.append(...children);
  return element;
}
function button(label, action, className='ed-secondary') {
  const element = node('button',{type:'button',className,textContent:label});
  element.addEventListener('click',action);
  return element;
}
async function api(path,method='GET',body) {
  const response = await fetch('/api'+path,{
    method,cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},
    body:body ? JSON.stringify(body) : undefined
  });
  const result = await response.json();
  if (!response.ok) throw Object.assign(Error(result.message || result.error || String(response.status)),{status:response.status,code:result.code});
  return result;
}
const choices = {
  ramadan:[['إفطار','Iftar'],['سحور','Suhoor'],['معايدة','Greeting']],
  eid:[['دعوة تجمع','Family gathering'],['معايدة','Greeting']],
  hajj:[['استقبال الحجاج','Welcome home'],['تهنئة','Congratulations']]
};
export async function renderEditor(root,template,initialId) {
  if (!document.querySelector('link[href="/editor.css"]')) document.head.append(node('link',{rel:'stylesheet',href:'/editor.css'}));
  const en = document.documentElement.lang.startsWith('en');
  const t=(ar,english)=>en?english:ar;
  let id=initialId || new URL(location.href).searchParams.get('id');
  let user, record, busy=false, step=new URL(location.href).searchParams.get('resume')==='publish'?3:0, cleanup=()=>{}, previewTimer, saveTimer, revision=0, savedRevision=-1, queue=Promise.resolve(), blocked=false;
  const localKey='new:'+template.id;
  const rootPanel=node('main',{className:'ed-studio'}); root.replaceChildren(rootPanel);
  const status=node('span',{className:'ed-status',role:'status'});
  const announce=(message,error=false)=>{status.textContent=message;status.classList.toggle('ed-error',error)};
  rootPanel.append(status);announce(t('جارٍ فتح المحرر…','Opening editor…'));
  let pending;
  try {
    user=(await api('/me')).user;
    if (id && !user) {location.assign('/auth?next='+encodeURIComponent(location.pathname+location.search)); return}
    if (id) {
      record=(await api('/invitations/'+encodeURIComponent(id))).invitation;
      if(record.templateId!==template.id) {
        location.replace('/create/'+encodeURIComponent(record.templateId)+'?id='+encodeURIComponent(id));return;
      }
    } else { try {pending=await localDraft(localKey)} catch {} }
  } catch(error) {announce(t('تعذّر فتح المحرر. ','Unable to open editor. ')+error.message,true);return}
  const data=Object.assign({title:'',hosts:'',message:'',language:en?'en':'ar',timeZone:'Asia/Baghdad',
    startAt:'',showCountdown:true,showHijri:false,sections:Object.keys(sectionLabels),font:'serif',images:[],schedule:[],customFields:[]},(record || pending)?.data);
  const settings=Object.assign({privacy:'unlisted',rsvpEnabled:true,maxGuests:4},(record || pending)?.settings);
  delete settings.pin;
  let wall = pending?.wall || localDateTime(data.startAt,data.timeZone);
  let pinStored=Boolean(record?.settings?.hasPin || record?.settings?.privacy==='pin');
  let serverVersion=record?.updatedAt, conflict=false;
  const isPublished = record?.status==='published';
  const mobileTabs=node('nav',{className:'ed-mobiles'});
  mobileTabs.setAttribute('aria-label',t('أوضاع المحرر','Editor views'));
  const setView = mode=>{rootPanel.dataset.view=mode;for(const b of mobileTabs.children)b.setAttribute('aria-pressed',String(b.dataset.mode===mode))};
  for(const [mode,name] of [['form',t('تعديل','Edit')],['preview',t('معاينة','Preview')]]) {
    const b=button(name,()=>setView(mode));b.dataset.mode=mode;mobileTabs.append(b);
  }
  const heading=node('header',{className:'ed-heading'},
    node('div',{},node('a',{href:'/templates/'+template.id,textContent:t(template.titleAr,template.titleEn)}),
    node('h1',{textContent:t('محرّر الدعوة','Invitation editor')})),status);
  const layout=node('div',{className:'ed-layout'});
  const panel=node('section',{className:'ed-panel'});
  const steps=node('nav',{className:'ed-steps'});steps.setAttribute('aria-label',t('مراحل التخصيص','Editing steps'));
  const fields=node('div',{className:'ed-fields'}),actions=node('div',{className:'ed-actions'});
  const formTitle=node('h2');
  const form=node('form',{noValidate:true},formTitle,fields,actions);
  form.onsubmit=e=>e.preventDefault();
  const preview=node('div',{className:'ed-preview'});
  const screen=node('div',{className:'ed-screen'},preview);
  const previewTitle=node('header',{className:'ed-preview-title'},node('strong',{textContent:t('معاينة حية','Live preview')}),
    button(t('أعِد فتح الدعوة','Replay opening'),()=>refresh(false)));
  const aside=node('aside',{className:'ed-aside'},previewTitle,screen);
  panel.append(steps,form);layout.append(panel,aside);rootPanel.replaceChildren(heading,mobileTabs,layout);setView('form');
  function refresh(open) {
    if (!rootPanel.isConnected) {cleanup();return}
    const opened=open ?? Boolean(preview.querySelector('.inv-card.opened'));
    const scroll=screen.scrollTop;
    cleanup();cleanup=renderInvitation(preview,template,{...data,...settings,pin:undefined},{preview:true,lang:data.language,opened}) || (()=>{});
    screen.scrollTop=opened?scroll:0;
  }
  function snapshot() {
    const {pin,...safeSettings}=settings;
    return structuredClone({data,settings:safeSettings,wall});
  }
  function saveLocal() {return localDraft(localKey,'put',snapshot())}
  function adoptId(nextId) {
    id=nextId;
    const url=new URL(location.href);url.searchParams.set('id',id);history.replaceState(history.state,'',url);
  }
  function save(auto=false) {
    const v=revision;
    const body=structuredClone({templateId:template.id,data,settings});
    const snap=snapshot();
    const operation=queue.then(async()=>{
      if(conflict)throw Error(t('تغيّرت الدعوة في جلسة أخرى. اختر طريقة استئناف التعديل.','This invitation changed in another session. Choose how to continue.'));
      if(savedRevision>=v && id)return;
      if (!user) {
        await localDraft(localKey,'put',snap);
        if(v===revision)announce(t('حُفظت مسودة على هذا الجهاز','Draft saved on this device'));
        return;
      }
      if(auto && isPublished) return;
      if(auto && body.settings.privacy==='pin' && !(/^\d{4,12}$/.test(body.settings.pin || '') || (pinStored && !body.settings.pin))){
        announce(t('أكمل رمز الدخول لحفظ المسودة الخاصة.','Complete the PIN to save this private draft.'));
        return;
      }
      if(id && serverVersion)body.expectedUpdatedAt=serverVersion;
      let res;
      try {res=await api('/invitations'+(id?'/'+encodeURIComponent(id):''),id?'PATCH':'POST',body)}
      catch(error){
        if(error.status===409 && id){
          conflict=true;draw();
          throw Error(t('تغيّرت الدعوة في جلسة أخرى. يمكنك حفظ تعديلاتك في نسخة جديدة.','This invitation changed in another session. You can save your edits as a new copy.'));
        }
        throw error;
      }
      if(!id){adoptId(res.invitation.id);await localDraft(localKey,'delete').catch(()=>{})}
      serverVersion=res.invitation.updatedAt;
      pinStored=body.settings.privacy==='pin';
      savedRevision=v;
      if(v===revision)announce(t('تم الحفظ في حسابك','Saved to your account'));
    });
    queue=operation.catch(()=>{});return operation;
  }
  function changed() {
    revision++;clearTimeout(previewTimer);previewTimer=setTimeout(()=>refresh(),110);
    clearTimeout(saveTimer);
    announce(isPublished?t('تغييرات بانتظار النشر','Unpublished changes'):t('تغييرات بانتظار الحفظ','Saving changes…'));
    if(!isPublished)saveTimer=setTimeout(()=>save(true).catch(error=>announce(t('تعذّر الحفظ. ','Could not save. ')+error.message,true)),650);
  }
  function field(key,ar,english,type='text',opts={}) {
    const target=opts.target || data;
    const value=opts.value ?? target[key] ?? '';
    const label=node('label',{className:'ed-field'},node('span',{textContent:t(ar,english)}));
    let input;
    if(opts.options) {
      input=node('select');for(const [v,name] of opts.options)input.append(node('option',{value:v,textContent:name}));
      input.value=value;
    } else if(type==='textarea') {
      input=node('textarea',{value,rows:3,maxLength:2000});
    } else {
      input=node('input',{type});
      if(type==='checkbox'){input.checked=Boolean(value);label.classList.add('ed-toggle')}
      else input.value=value;
      if(type==='text'||type==='url'||type==='tel')input.maxLength=opts.limit || (type==='url'?2000:320);
      if(opts.attrs)for(const [k,v] of Object.entries(opts.attrs))input.setAttribute(k,v);
    }
    input.name=key;
    input.addEventListener(opts.options?'change':'input',()=>{
      const val=type==='checkbox'?input.checked:type==='number'||type==='range'?Number(input.value):input.value;
      if(opts.set)opts.set(val);else target[key]=val;
      input.setCustomValidity('');
      if(opts.validate && !opts.validate(val))input.setCustomValidity(t('تحقق من هذا الحقل','Check this field'));
      changed();if(opts.after)opts.after();
    });
    label.append(input);return label;
  }
  function choice(key,ar,english,values,opts={}) {return field(key,ar,english,'select',{...opts,options:values})}
  function optionPairs(rows) {return rows.map(pair=>[t(...pair),t(...pair)])}
  function info(text) {return node('p',{className:'ed-note',textContent:text})}
  function subsection(title,...items){return node('section',{className:'ed-group'},node('h3',{textContent:title}),...items)}
  const names=[t('النصوص','Wording'),t('الموعد والمكان','Time & place'),t('الصور والتصميم','Photos & design'),t('النشر','Publish')];
  function wording() {
    fields.append(field('title','عنوان الدعوة','Invitation title','text',{limit:160}),
      field('occasion','اسم المناسبة','Occasion'),field('hosts','أسماء المضيفين','Hosts'),
      field('message','نص الدعوة','Invitation message','textarea'));
    for(const [key,ar,english,type] of specialFields[template.category] || []) {
      if(choices[type]) {
        const pairs=optionPairs(choices[type]);
        if(data[key] && !pairs.some(([v])=>v===data[key]))pairs.push([data[key],data[key]]);
        fields.append(choice(key,ar,english,[['',t('اختر النوع','Choose a type')],...pairs]));
      }else fields.append(field(key,ar,english,type));
    }
    if(template.category==='general') fields.append(rowsEditor('customFields',t('حقول خاصة','Custom fields'),[
      ['label','عنوان الحقل','Label'],['value','القيمة','Value']
    ],t('أضف حقلًا','Add field')));
  }
  function rowsEditor(key,title,columns,addLabel) {
    const group=subsection(title);
    data[key].forEach((row,i)=>{
      const item=node('div',{className:'ed-row'});
      for(const [k,ar,english,type] of columns)item.append(field(k,ar,english,type,{target:row}));
      item.append(button(t('حذف','Remove'),()=>{data[key].splice(i,1);changed();draw()}));
      group.append(item);
    });
    if(data[key].length<12)group.append(button(addLabel,()=>{data[key].push(Object.fromEntries(columns.map(([key])=>[key,''])));changed();draw()}));
    return group;
  }
  function timing() {
    let warning=info(''),overlap=node('div');
    function syncTime() {
      const matches=utcCandidates(wall,data.timeZone);
      if(!matches.includes(data.startAt))data.startAt=matches[0] || '';
      warning.textContent=wall && !matches.length?t('هذا الوقت غير موجود في المنطقة الزمنية المحددة. غيّر وقت البداية.','This time does not exist in that time zone. Choose another start time.'):'';
      overlap.replaceChildren();
      if(matches.length>1)overlap.append(choice('startAt','يتكرر هذا التوقيت، اختر الموعد','Repeated clock time, choose an instant',matches.map((v,i)=>[v,(i?t('المرة الثانية','Second occurrence'):t('المرة الأولى','First occurrence'))+' · '+v.slice(11,19)+' UTC'])));
    }
    const zones=[...new Set(['Asia/Baghdad','UTC',data.timeZone,...(Intl.supportedValuesOf?.('timeZone') || ['Asia/Dubai','Europe/London','America/New_York'])])];
    fields.append(field('wall','تاريخ ووقت البداية','Start date and time','datetime-local',{value:wall,attrs:{step:'1'},set:v=>{wall=v;syncTime()}}),
      choice('timeZone','المنطقة الزمنية','Time zone',zones.map(z=>[z,z]),{after:syncTime}),warning,overlap,
      field('showCountdown','إظهار العد التنازلي','Show countdown','checkbox'),
      field('startedMessage','رسالة عند بداية المناسبة','Message when the event begins'),
      field('showHijri','عرض التاريخ الهجري أيضًا','Show Hijri date','checkbox'),
      info(t('قد يختلف التاريخ الهجري حسب رؤية الهلال في بلدك.','The observed Hijri date may vary by country.')),
      field('place','اسم المكان','Venue name'),field('address','العنوان','Address'),
      field('mapsUrl','رابط خرائط Google','Google Maps link','url',{validate:validMap}),
      field('phone','رقم التواصل مع رمز الدولة','Contact phone with country code','tel'),
      rowsEditor('schedule',t('برنامج المناسبة','Event schedule'),[['time','الوقت','Time','time'],['title','الفقرة','Activity']],t('أضف فقرة','Add activity')));
    syncTime();
  }
  function design() {
    const upload=node('input',{type:'file',accept:'image/jpeg,image/png,image/webp',multiple:true});
    const drop=node('label',{className:'ed-drop'},node('strong',{textContent:t('اختَر الصور أو اسحبها هنا','Choose or drop your photos')}),upload,
      info(t('حتى 4 صور · JPG، PNG، WebP · 12 ميغابايت للصورة','Up to 4 images · JPG, PNG, WebP · 12 MB each')));
    let loading=false;
    async function appendPhotos(files) {
      if(loading || !files.length)return;
      if(files.length+data.images.length>4){announce(t('الحد الأقصى أربع صور.','Up to four images per invitation.'),true);return}
      loading=true;upload.disabled=true;announce(t('جارٍ تهيئة الصور…','Preparing photos…'));
      try {
        const batch=[];
        for(const f of files)batch.push(await preparePhoto(f,t));
        data.images.push(...batch);changed();draw();
      }catch(error){announce(error.message,true)}
      finally{loading=false;upload.disabled=false;upload.value=''}
    }
    upload.onchange=()=>appendPhotos([...upload.files]);
    drop.ondragover=e=>{e.preventDefault();drop.classList.add('over')};drop.ondragleave=()=>drop.classList.remove('over');
    drop.ondrop=e=>{e.preventDefault();drop.classList.remove('over');appendPhotos([...e.dataTransfer.files])};
    const album=subsection(t('صور الدعوة','Invitation photos'),drop);
    data.images.forEach((photo,i)=>{
      const image=node('img',{src:photo.src,alt:photo.alt || t('معاينة الاقتصاص','Crop preview')});
      const showCrop=()=>{image.style.objectPosition=photo.x+'% '+photo.y+'%';image.style.transformOrigin=image.style.objectPosition;image.style.transform='scale('+photo.zoom+')'};showCrop();
      const item=node('div',{className:'ed-photo'},node('div',{className:'ed-crop'},image),field('alt','وصف الصورة','Image description','text',{target:photo}));
      for(const [key,ar,eng,min,max,inc] of [['x','الموضع الأفقي','Horizontal focus',0,100,1],['y','الموضع العمودي','Vertical focus',0,100,1],['zoom','التكبير','Zoom',1,2,.05]])
        item.append(field(key,ar,eng,'range',{target:photo,attrs:{min,max,step:inc},after:showCrop}));
      const replacement=node('input',{type:'file',accept:upload.accept});
      replacement.onchange=async()=>{if(!replacement.files[0])return;try{data.images[i]={...await preparePhoto(replacement.files[0],t),alt:photo.alt};changed();draw()}catch(e){announce(e.message,true)}};
      item.append(node('label',{className:'ed-field'},node('span',{textContent:t('استبدال الصورة','Replace photo')}),replacement),
        button(t('حذف الصورة','Remove photo'),()=>{data.images.splice(i,1);changed();draw()}));
      album.append(item);
    });
    const order=subsection(t('ترتيب الأقسام','Section order'));
    data.sections.forEach((key,i)=>{
      const row=node('div',{className:'ed-order'},node('span',{textContent:t(...sectionLabels[key])}));
      for(const [dir,label] of [[-1,t('للأعلى','Up')],[1,t('للأسفل','Down')]]){
        const move=button(label,()=>{[data.sections[i],data.sections[i+dir]]=[data.sections[i+dir],data.sections[i]];changed();draw()});move.disabled=!data.sections[i+dir];row.append(move);
      }
      order.append(row);
    });
    fields.append(album,field('accent','لون التمييز','Accent color','color',{value:data.accent || template.colorTokens?.accent || '#956643'}),
      choice('font','نمط الخط','Typeface',[['serif',t('كلاسيكي','Classic')],['sans',t('عصري','Modern')]]),
      choice('language','لغة الدعوة للضيف','Guest invitation language',[['ar','العربية'],['en','English']]),order);
  }
  function publishing() {
    fields.append(choice('privacy','خصوصية الرابط','Link privacy',[
      ['unlisted',t('رابط غير مفهرس','Unlisted link')],['pin',t('رابط برمز دخول','PIN-protected link')],['public',t('رابط عام','Public link')]
    ],{target:settings,after:draw}));
    if(settings.privacy==='pin')fields.append(field('pin',pinStored?'رمز جديد (اختياري)':'رمز الدخول (4–12 رقمًا)',pinStored?'New PIN (optional)':'Access PIN (4–12 digits)','password',{target:settings,attrs:{inputmode:'numeric',autocomplete:'new-password',pattern:'[0-9]{4,12}'}}));
    fields.append(field('rsvpEnabled','السماح بتأكيد الحضور','Accept guest responses','checkbox',{target:settings,after:draw}));
    if(settings.rsvpEnabled)fields.append(field('maxGuests','الحد الأقصى لكل رد','Maximum guests per response','number',{target:settings,attrs:{min:1,max:30}}));
    fields.append(field('rsvpUrl','رابط تأكيد حضور إضافي (اختياري)','Additional RSVP link (optional)','url'),
      info(user?t('بعد النشر يصبح رابط الدعوة متاحًا للضيوف.','Publishing makes the invitation link available to guests.'):
      t('تُحفظ المسودة على هذا الجهاز. سجّل الدخول عند النشر للحصول على رابط الضيوف.','This draft stays on your device. Sign in to publish a guest link.')));
  }
  function validate() {
    if(!data.title.trim())return [0,'title',t('اكتب عنوانًا للدعوة.','Enter an invitation title.')];
    if(!data.startAt || !utcCandidates(wall,data.timeZone).includes(data.startAt))return [1,'wall',t('حدّد موعد البداية بالمنطقة الزمنية المطلوبة.','Choose a valid start date and time.')];
    if(!validMap(data.mapsUrl))return [1,'mapsUrl',t('أدخل رابطًا صالحًا لخرائط Google عبر HTTPS.','Enter a valid HTTPS Google Maps link.')];
    if(data.rsvpUrl){try{const u=new URL(data.rsvpUrl);if(u.protocol!=='https:'||u.username||u.password)throw Error()}catch{return [3,'rsvpUrl',t('أدخل رابط HTTPS صالحًا.','Enter a valid HTTPS URL.')]}}
    if(settings.privacy==='pin' && !((pinStored&&!settings.pin)||/^\d{4,12}$/.test(settings.pin || '')))return [3,'pin',t('أدخل رمزًا من 4 إلى 12 رقمًا.','Enter a 4–12 digit PIN.')];
    if(settings.rsvpEnabled && (!Number.isInteger(settings.maxGuests)||settings.maxGuests<1||settings.maxGuests>30))return [3,'maxGuests',t('اختر عددًا بين 1 و30.','Choose 1 to 30 guests.')];
  }
  async function submit(publish) {
    if(busy)return;
    if(publish){
      const bad=validate();
      if(bad){step=bad[0];setView('form');draw();const input=form.elements.namedItem(bad[1]);input?.focus();input?.setCustomValidity(bad[2]);input?.reportValidity();announce(bad[2],true);return}
    }
    busy=true;form.inert=true;clearTimeout(saveTimer);
    try{
      if(publish && !user){
        await queue;await saveLocal();
        const next=new URL(location.href);next.searchParams.set('resume','publish');
        location.assign('/auth?next='+encodeURIComponent(next.pathname+next.search));return;
      }
      await save();
      if(publish){
        const result=await api('/invitations/'+encodeURIComponent(id)+'/publish','POST',{});
        blocked=true;
        location.assign('/dashboard/invitations/'+encodeURIComponent(result.invitation.id));
      }
    }catch(error){announce(t('تعذّر إكمال العملية. ','Could not complete this action. ')+error.message,true)}
    finally{busy=false;form.inert=false}
  }
  function draw() {
    steps.replaceChildren();fields.replaceChildren();actions.replaceChildren();formTitle.textContent=names[step];
    names.forEach((name,i)=>{
      const b=button(String(i+1)+' · '+name,()=>{step=i;draw()});if(i===step)b.setAttribute('aria-current','step');steps.append(b);
    });
    [wording,timing,design,publishing][step]();
    if(conflict){
      actions.append(button(t('افتح أحدث نسخة محفوظة','Open latest saved version'),()=>location.reload()),
        button(t('احفظ التعديلات كنسخة جديدة','Save edits as a new copy'),async()=>{
          if(busy)return;busy=true;form.inert=true;
          try{
            const copySettings={...settings};
            if(copySettings.privacy==='pin' && !/^\d{4,12}$/.test(copySettings.pin || '')){
              step=3;draw();form.inert=false;form.elements.namedItem('pin')?.focus();
              announce(t('أدخل رمز دخول للنسخة الخاصة الجديدة.','Enter an access PIN for your new private copy.'),true);return;
            }
            const res=await api('/invitations','POST',{templateId:template.id,data,settings:copySettings});
            location.replace('/create/'+encodeURIComponent(template.id)+'?id='+encodeURIComponent(res.invitation.id));
          }catch(error){announce(error.message,true)}finally{busy=false;form.inert=false}
        },'ed-primary'));
      return;
    }
    if(!isPublished)actions.append(button(t('حفظ المسودة','Save draft'),()=>submit(false)));
    if(step<3)actions.append(button(t('التالي','Continue'),()=>{step++;draw();formTitle.scrollIntoView({block:'nearest'})},'ed-primary'));
    else actions.append(button(isPublished?t('نشر التغييرات','Publish changes'):t('نشر الدعوة','Publish invitation'),()=>submit(true),'ed-primary'));
  }
  const leave=()=>{
    clearTimeout(previewTimer);clearTimeout(saveTimer);cleanup();
    if(!user && revision && !blocked)saveLocal().catch(()=>{});
  };
  window.addEventListener('pagehide',leave,{once:true});
  draw();refresh(false);announce(record?t('تم تحميل الدعوة','Invitation loaded'):pending?t('استُعيدت المسودة','Draft restored'):t('مسودة جديدة','New draft'));
  return leave;
}

