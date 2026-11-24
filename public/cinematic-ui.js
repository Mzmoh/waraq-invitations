import {glassDefaults} from './glass-motion.js';
const lang=()=>document.documentElement.lang==='en',t=(ar,en)=>lang()?en:ar;
export function glassMarkup(){
 // Content is assigned as textContent below, never interpolated from settings.
 return `<div class="glass-stage" data-aspect="16:9" data-renderer="light" role="img" aria-label="${t('مشهد زجاجي وأشكال مستوحاة من أختام الدعوات','Glass composition inspired by invitation seals')}">
 <div class="glass-fallback" aria-hidden="true"><svg viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice"><circle cx="260" cy="185" r="116" fill="none" stroke="var(--glass-violet)" stroke-width="48"/><path d="M260 430 650 290" stroke="var(--glass-coral)" stroke-width="38"/><circle cx="725" cy="360" r="84" fill="var(--glass-coral)"/><circle cx="725" cy="360" r="62" fill="none" stroke="var(--glass-amber)" stroke-width="18"/></svg><div class="fallback-pane"></div></div>
 <canvas aria-hidden="true"></canvas><div class="glass-copy"><span class="glass-seal" aria-hidden="true">W</span><p>WARAQ — INVITATION ATELIER</p><h2 data-glass-title></h2><small data-glass-subtitle></small></div></div>`;
}
export function glassControls(){return `<div class="glass-controls"><button type="button" data-glass-replay>${t('إعادة المشهد','Replay scene')}</button><button type="button" data-glass-pause aria-pressed="false">${t('إيقاف الحركة','Pause motion')}</button><button type="button" data-glass-light aria-pressed="false">${t('عرض خفيف','Lightweight view')}</button></div>
 <details class="glass-config"><summary>${t('خصّص هذا المشهد','Personalize this scene')}</summary><form>
 <label>${t('العنوان','Title')}<input name="title" maxlength="100" value="${t('للحظات التي تبقى','For moments that stay')}"></label><label>${t('عبارة قصيرة','Short message')}<input name="subtitle" maxlength="180" value="${t('دعوتك، بداية الحكاية.','Your invitation. The beginning of a story.')}"></label>
 <label>${t('مدة المشهد بالثواني','Duration in seconds')}<input name="duration" type="number" min="2" max="30" step="1" value="6"></label><label>${t('قوة الحركة','Motion strength')}<input name="motion" type="range" min="0" max="1" step=".1" value="1"></label>
 <label>${t('مقاس العرض','Composition format')}<select name="aspect"><option value="16:9">16:9 — ${t('أفقي','Landscape')}</option><option value="9:16">9:16 — ${t('عمودي','Portrait')}</option></select></label>
 <fieldset class="glass-colors"><legend>${t('ألوان المشهد','Scene palette')}</legend>${Object.entries(glassDefaults.palette).map(([k,v],i)=>`<label>${[t('عميق','Deep'),t('مرجاني','Coral'),t('بنفسجي','Violet'),t('كهرماني','Amber'),t('عاجي','Ivory')][i]}<input name="${k}" type="color" value="${v}"></label>`).join('')}</fieldset>
 <p class="glass-hint">${t('تبقى النصوص واضحة في نهاية المشهد. يحترم العرض إعداد تقليل الحركة في جهازك.','The scene settles for reading. Your device’s reduced motion setting is respected.')}</p></form></details>`;}
export async function connectGlass(root){
 const host=root.querySelector('.glass-stage');if(!host)return;
 const form=root.querySelector('.glass-config form'),pause=root.querySelector('[data-glass-pause]'),light=root.querySelector('[data-glass-light]');
 const text=()=>{host.querySelector('[data-glass-title]').textContent=form?.elements.title.value||t('للحظات التي تبقى','For moments that stay');host.querySelector('[data-glass-subtitle]').textContent=form?.elements.subtitle.value||t('دعوتك، بداية الحكاية.','Your invitation. The beginning of a story.');};text();
 const {mountGlassScene}=await import('./glass-scene.js');let controller=await mountGlassScene(host);let lightweight=false,paused=false,timer;
 const read=()=>({duration:Number(form.elements.duration.value),motion:Number(form.elements.motion.value),aspect:form.elements.aspect.value,palette:Object.fromEntries(Object.keys(glassDefaults.palette).map(k=>[k,form.elements[k].value]))});
 form?.addEventListener('submit',e=>e.preventDefault());
 form?.addEventListener('input',e=>{text();if(['title','subtitle'].includes(e.target.name))return;clearTimeout(timer);timer=setTimeout(async()=>{await controller.update(read());if(paused)controller.pause();},180);});
 root.querySelector('[data-glass-replay]')?.addEventListener('click',()=>{controller.replay();paused=false;pause.setAttribute('aria-pressed','false');pause.textContent=t('إيقاف الحركة','Pause motion');});
 pause?.addEventListener('click',()=>{paused=!paused;controller[paused?'pause':'play']();pause.setAttribute('aria-pressed',String(paused));pause.textContent=paused?t('متابعة الحركة','Resume motion'):t('إيقاف الحركة','Pause motion');});
 light?.addEventListener('click',async()=>{lightweight=!lightweight;const time=controller.time;controller.dispose();controller=await mountGlassScene(host,{...read(),mode:lightweight?'light':'auto'});controller.seek(time);if(!paused)controller.play();light.setAttribute('aria-pressed',String(lightweight));});
 addEventListener('pagehide',event=>{clearTimeout(timer);if(event.persisted)controller.pause();else controller.dispose();});
 addEventListener('pageshow',event=>{if(event.persisted&&!paused)controller.play();});
 // Local developer/capture API: deterministic seek, not a global animation loop.
 host.glassController={seek:time=>controller.seek(time),inspect:()=>controller.inspect(),get options(){return controller.options;},get time(){return controller.time;}};
}
