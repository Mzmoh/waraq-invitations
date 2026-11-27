// Only public cover metadata crosses the native full-document navigation.
const previewRoute=/^\/templates\/[a-z0-9-]+$/;
let transitionFinished=Promise.resolve();
const publicPage=/^\/(?:$|occasions(?:\/[a-z0-9-]+)?$|templates\/[a-z0-9-]+$)/;
function rememberScroll(){
 if(!publicPage.test(location.pathname))return;
 const point={x:scrollX,y:scrollY};
 try{const state=history.state&&typeof history.state==='object'?history.state:{};history.replaceState({...state,waraqScroll:point},'');}catch{}
 // Some WebKit traversals discard serialized state when a no-store document
 // reloads. Keep public scroll coordinates (never form or invitation data).
 try{sessionStorage.setItem('waraq-scroll:'+location.pathname+location.search,JSON.stringify(point));}catch{}
}
let restored=false;
async function restoreScroll(persisted=false){
 const traversal=persisted||performance.getEntriesByType('navigation')[0]?.type==='back_forward'||window.navigation?.activation?.navigationType==='traverse';
 let point=history.state?.waraqScroll;try{point??=JSON.parse(sessionStorage.getItem('waraq-scroll:'+location.pathname+location.search));}catch{}
 if(restored||!traversal||!publicPage.test(location.pathname)||!point||!Number.isFinite(point.y))return;
 restored=true;await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 // Restore after the asynchronously loaded catalog gives the document height.
 if(Math.abs(scrollY-point.y)>2)scrollTo({left:point.x||0,top:point.y,behavior:'instant'});
}
document.addEventListener('waraq:page-ready',()=>restoreScroll());
addEventListener('pagehide',rememberScroll);
addEventListener('pageshow',event=>{if(event.persisted){restored=false;restoreScroll(true);}});
document.addEventListener('click',event=>{
 if(event.target.closest?.('a[href]'))rememberScroll();
 const link=event.target.closest?.('.template-tile a');if(!link||event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 const url=new URL(link.href),image=link.querySelector('img');if(url.origin!==location.origin||!previewRoute.test(url.pathname)||!image)return;
 const src=new URL(image.src);if(src.origin!==location.origin||!/^\/templates\/covers\/[a-z0-9-]+\.svg$/.test(src.pathname))return;
 document.querySelectorAll('.template-art').forEach(art=>art.style.viewTransitionName='none');
 link.querySelector('.template-art').style.viewTransitionName='invitation-preview';
 try{sessionStorage.setItem('waraq-transition-art',JSON.stringify({path:url.pathname,src:src.pathname,title:link.querySelector('h3')?.textContent?.slice(0,150)||'',lang:document.documentElement.lang,time:Date.now()}));}catch{}
},{capture:true});
function incomingArtwork(){
 if(document.querySelector('#template-preview'))return;
 let item;try{item=JSON.parse(sessionStorage.getItem('waraq-transition-art'));sessionStorage.removeItem('waraq-transition-art');}catch{return;}
 if(!item||item.path!==location.pathname||!Number.isFinite(item.time)||Math.abs(Date.now()-item.time)>15000||!previewRoute.test(item.path)||!/^\/templates\/covers\/[a-z0-9-]+\.svg$/.test(item.src))return;
 const app=document.querySelector('#app');if(!app)return;const en=item.lang==='en';
 const shell=document.createElement('div');shell.className='wrap studio-content studio-preview';shell.dataset.transitionShell='';
 const copy=document.createElement('div'),crumb=document.createElement('span'),heading=document.createElement('h1'),lead=document.createElement('p'),create=document.createElement('a');
 crumb.className='crumb';crumb.textContent='\u00a0';heading.textContent=String(item.title).slice(0,150);lead.className='studio-lead';lead.textContent=en?'Try opening and scrolling through the invitation as a guest.':'جرّب الفتح والتمرير كما يراهما ضيوفك.';
 create.className='studio-button';create.href='/create/'+location.pathname.split('/').pop();create.textContent=en?'Use this template':'استخدم هذا القالب';copy.append(crumb,heading,lead,create);
 const device=document.createElement('div');device.className='preview-device';device.style.viewTransitionName='invitation-preview';
 const cover=document.createElement('img');cover.dataset.transitionCover='';cover.src=item.src;cover.alt='';cover.width=360;cover.height=640;cover.decoding='sync';cover.fetchPriority='high';device.append(cover);shell.append(copy,device);app.replaceChildren(shell);
}
document.addEventListener('waraq:preview-ready',async()=>{
 await transitionFinished;const cover=document.querySelector('[data-transition-cover]');if(!cover)return;
 if(matchMedia('(prefers-reduced-motion: reduce)').matches||!cover.animate){cover.remove();return;}
 cover.animate([{opacity:1},{opacity:0}],{duration:180,easing:'ease-out',fill:'forwards'}).finished.then(()=>cover.remove(),()=>cover.remove());
});
for(const name of ['pageswap','pagereveal'])addEventListener(name,event=>{
 if(name==='pageswap')rememberScroll();
 const transition=event.viewTransition;if(!transition)return;
 transition.ready.catch(()=>{});transitionFinished=transition.finished.catch(()=>{});
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){transition.skipTransition();return;}
 if(name==='pagereveal')incomingArtwork();
 const from=event.activation?.from?.url||window.navigation?.activation?.from?.url;
 const to=event.activation?.entry?.url||window.navigation?.activation?.entry?.url;
 if(previewRoute.test(location.pathname)||[from,to].some(url=>{try{return previewRoute.test(new URL(url).pathname);}catch{return false;}}))document.documentElement.dataset.templateTransition='true';
 const cleanup=()=>delete document.documentElement.dataset.templateTransition;transition.finished.then(cleanup,cleanup);
});
