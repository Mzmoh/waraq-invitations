// Progressive enhancement of the existing SVG/CSS invitation engine.
export const typefaces={
  classic:'"Waraq Amiri", Georgia, "Times New Roman", serif',modern:'Tahoma, Arial, sans-serif',
  arabic:'"Noto Naskh Arabic", "Traditional Arabic", serif',kufi:'"Noto Kufi Arabic", Tahoma, sans-serif',
  editorial:'Palatino, "Book Antiqua", Georgia, serif'
};
export const soundLibrary=[
  {id:'silent',ar:'بدون صوت',en:'No audio',src:''},
  {id:'celebration',ar:'نغمات الاحتفال — أصلية',en:'Celebration — original',src:'/audio/celebration.wav'},
  {id:'serenity',ar:'نغمات هادئة — أصلية',en:'Serenity — original',src:'/audio/serenity.wav'}
];
export function enhanceExperience(card,template,data,{preview=false}={}) {
  const en=card.lang==='en',text=(ar,enText)=>en?enText:ar;
  const appearance=data.appearance||{};
  card.style.setProperty('--inv-serif',typefaces[appearance.typeface]||typefaces[data.font==='sans'?'modern':'classic']);
  for(const [key,css] of [['titleSize','--title-size'],['bodySize','--body-size']])if(Number.isFinite(appearance[key]))card.style.setProperty(css,appearance[key]+'px');
  if(appearance.weight)card.style.setProperty('--title-weight',appearance.weight);
  if(appearance.lineHeight)card.style.setProperty('--body-leading',appearance.lineHeight);
  if(appearance.spacing)card.style.setProperty('--type-spacing',appearance.spacing+'em');
  if(['start','center','end'].includes(appearance.align))card.style.setProperty('--text-align',appearance.align);
  for(const [key,css] of [['titleColor','--title-color'],['textColor','--text-color']])if(/^#[a-f\d]{6}$/i.test(appearance[key]||''))card.style.setProperty(css,appearance[key]);
  const background=data.images?.find(image=>image.role==='background');
  if(background && /^(?:\/api\/assets\/[a-f\d-]{36}|data:image\/(?:jpeg|png|webp);base64,[a-z\d+/=]+)$/i.test(background.src)) {
    const img=document.createElement('img');img.src=background.src;img.alt='';img.className='inv-user-background';card.querySelector('.inv-stage').prepend(img);
  }
  const abort=new AbortController(),signal=abort.signal;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const stage=card.querySelector('.inv-stage');
  const duration=650+template.layers.length*65;
  card.style.setProperty('--scene-duration',duration+'ms');
  card.dataset.scene=card.classList.contains('opened')?'details':'opening';
  let frame,point,particleFrame;
  const muted=()=>motion.matches||card.classList.contains('inv-paused');
  stage.addEventListener('pointermove',event=>{
    if(muted()||event.pointerType==='touch')return;
    point={x:event.clientX,y:event.clientY};if(frame)return;
    frame=requestAnimationFrame(()=>{frame=0;const r=stage.getBoundingClientRect();stage.style.setProperty('--tilt-x',((point.x-r.left)/r.width-.5)*8+'px');stage.style.setProperty('--tilt-y',((point.y-r.top)/r.height-.5)*8+'px');});
  },{signal,passive:true});
  stage.addEventListener('pointerleave',()=>{stage.style.setProperty('--tilt-x','0px');stage.style.setProperty('--tilt-y','0px');},{signal});
  const replay=document.createElement('button');replay.type='button';replay.className='inv-btn';replay.textContent=text('إعادة عرض المقدمة','Replay introduction');
  replay.addEventListener('click',()=>{
    card.classList.remove('opened','inv-skip');card.dataset.scene='opening';card.querySelector('.inv-body').hidden=true;
    card.querySelectorAll('[data-open]').forEach(b=>b.hidden=false);card.querySelectorAll('.inv-appear').forEach(e=>e.classList.remove('inv-appear'));
    stage.scrollIntoView({block:'start',behavior:muted()?'instant':'smooth'});card.querySelector('[data-open]')?.focus({preventScroll:true});
  },{signal});
  card.querySelector('.inv-actions')?.prepend(replay);
  const opened=()=>{
    card.dataset.scene='reveal';
    if(muted()||!['graduation','fitr','adha'].includes(template.category))return;
    card.querySelector('.inv-confetti')?.remove();cancelAnimationFrame(particleFrame);
    const canvas=document.createElement('canvas');canvas.className='inv-confetti';canvas.setAttribute('aria-hidden','true');canvas.width=360;canvas.height=500;stage.append(canvas);
    const context=canvas.getContext('2d');let start;
    const draw=timestamp=>{
      start??=timestamp;const elapsed=(timestamp-start)/1000;
      if(elapsed>1.6||muted()||!canvas.isConnected){canvas.remove();return;}
      context.clearRect(0,0,360,500);context.globalAlpha=Math.max(0,1-elapsed/1.6);
      for(let i=0;i<32;i++) {context.save();context.translate((i*83%360)+(i%2?1:-1)*elapsed*16,(i*47%180)+elapsed*180);context.rotate(i+elapsed*2);context.fillStyle=[template.colorTokens.accent,'#f5dfb5','#ffffff'][i%3];context.fillRect(-3,-5,6,10);context.restore();}
      particleFrame=requestAnimationFrame(draw);
    };particleFrame=requestAnimationFrame(draw);
  };
  card.querySelectorAll('[data-open],[data-skip]').forEach(b=>b.addEventListener('click',opened,{signal}));
  let sceneObserver;
  if('IntersectionObserver' in window){sceneObserver=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting)card.dataset.scene=e.target.dataset.scene||'details';},{threshold:.35});
    card.querySelectorAll('.inv-block').forEach(el=>{el.dataset.scene=el.classList.contains('inv-countdown')?'countdown':el.classList.contains('inv-rsvp')?'interaction':'details';sceneObserver.observe(el);});}
  let audio;
  const sound=data.audio;
  const builtin=soundLibrary.find(s=>s.id===sound?.track);
  const src=builtin?.src||(/^data:audio\/(mpeg|wav|ogg);base64,[a-z\d+/=]+$/i.test(sound?.src||'')?sound.src:'');
  if(src){
    audio=new Audio(src);audio.preload='none';audio.loop=!!sound.loop;audio.volume=Math.min(1,Math.max(0,sound.volume??.5));
    const controls=document.createElement('div');controls.className='inv-audio';
    const toggle=document.createElement('button');toggle.type='button';toggle.className='inv-btn';toggle.textContent=text('تشغيل الصوت','Play audio');toggle.setAttribute('aria-pressed','false');
    const volume=document.createElement('input');volume.type='range';volume.min='0';volume.max='1';volume.step='.05';volume.value=audio.volume;volume.setAttribute('aria-label',text('مستوى الصوت','Audio volume'));
    const note=document.createElement('span');note.setAttribute('role','status');
    toggle.addEventListener('click',async()=>{try{if(audio.paused){await audio.play();toggle.textContent=text('إيقاف الصوت','Pause audio');toggle.setAttribute('aria-pressed','true');}else{audio.pause();toggle.textContent=text('تشغيل الصوت','Play audio');toggle.setAttribute('aria-pressed','false');}note.textContent='';}catch{note.textContent=text('تعذر تشغيل الملف الصوتي','The audio file could not be played');}},{signal});
    audio.addEventListener('ended',()=>{toggle.textContent=text('تشغيل الصوت','Play audio');toggle.setAttribute('aria-pressed','false');},{signal});
    volume.addEventListener('input',()=>audio.volume=Number(volume.value),{signal});controls.append(toggle,volume,note);card.querySelector('.inv-tools').append(controls);
    document.addEventListener('visibilitychange',()=>{if(document.hidden){audio.pause();toggle.textContent=text('تشغيل الصوت','Play audio');toggle.setAttribute('aria-pressed','false');}},{signal});
  }
  const changed=()=>{if(motion.matches){stage.style.setProperty('--tilt-x','0px');stage.style.setProperty('--tilt-y','0px');card.classList.add('inv-paused');}};
  motion.addEventListener('change',changed,{signal});
  return ()=>{abort.abort();sceneObserver?.disconnect();cancelAnimationFrame(frame);cancelAnimationFrame(particleFrame);if(audio){audio.pause();audio.removeAttribute('src');audio.load();}};
}
