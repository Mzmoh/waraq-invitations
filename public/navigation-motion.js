// Retain only public catalog artwork for the incoming shared-element shell.
// This lets native transitions work even while the real preview module loads.
document.addEventListener('click',event=>{
 const link=event.target.closest?.('.template-tile a');if(!link||event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 const path=new URL(link.href,location.href).pathname,image=link.querySelector('img'),title=link.querySelector('h3')?.textContent;
 if(!/^\/templates\/[a-z0-9-]+$/.test(path)||!image)return;
 const src=new URL(image.src);if(src.origin!==location.origin||!/^\/templates\/covers\/[a-z0-9-]+\.svg$/.test(src.pathname))return;
 try{sessionStorage.setItem('waraq-transition-art',JSON.stringify({path,src:src.pathname,title:title?.slice(0,150)||'',time:Date.now()}));}catch{}
},{capture:true});
function incomingArtwork(){
 if(document.querySelector('#template-preview'))return;
 let item;try{item=JSON.parse(sessionStorage.getItem('waraq-transition-art'));}catch{return;}
 if(!item||item.path!==location.pathname||!Number.isFinite(item.time)||Date.now()-item.time>15000||!/^\/templates\/[a-z0-9-]+$/.test(item.path)||!/^\/templates\/covers\/[a-z0-9-]+\.svg$/.test(item.src))return;
 try{sessionStorage.removeItem('waraq-transition-art');}catch{}
 const app=document.querySelector('#app');if(!app)return;
 const shell=document.createElement('div');shell.className='wrap studio-content studio-preview';shell.dataset.transitionShell='';
 const copy=document.createElement('div'),heading=document.createElement('h1');heading.textContent=String(item.title).slice(0,150);
 const crumb=document.createElement('span');crumb.className='crumb';crumb.textContent='\u00a0';
 const lead=document.createElement('p');lead.className='studio-lead';lead.textContent=document.documentElement.lang==='en'?'Try opening and scrolling through the invitation as a guest.':'جرّب الفتح والتمرير كما يراهما ضيوفك.';
 const create=document.createElement('a');create.className='studio-button';create.href='/create/'+location.pathname.split('/').pop();create.textContent=document.documentElement.lang==='en'?'Use this template':'استخدم هذا القالب';copy.append(crumb,heading,lead,create);
 const device=document.createElement('div');device.className='preview-device';device.style.viewTransitionName='template-'+location.pathname.split('/').pop();
 const image=document.createElement('img');image.src=item.src;image.alt='';image.width=360;image.height=640;image.style.cssText='width:100%;height:auto;aspect-ratio:9/16;object-fit:cover;border-radius:22px';device.append(image);shell.append(copy,device);app.replaceChildren(shell);
}
// Cross-document transitions may be skipped by the browser. A skipped effect
// must never reject navigation or create an unhandled promise rejection.
for(const event of ['pageswap','pagereveal'])addEventListener(event,e=>{
 const transition=e.viewTransition;if(!transition)return;
 if(event==='pagereveal')incomingArtwork();
 transition.ready.catch(()=>{});transition.finished.catch(()=>{});
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)transition.skipTransition();
});
