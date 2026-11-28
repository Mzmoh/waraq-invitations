// Progressive enhancements: native navigation, native scroll, real HTML text.
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
export function playBrandIntro({force=false}={}) {
 if(reduced.matches || location.pathname!=='/' && !force)return;
 let seen=false;try{seen=sessionStorage.getItem('waraq-intro-v1')==='seen';}catch{}
 if(seen&&!force)return;
 const brand=document.querySelector('#site-header .brand');if(!brand)return;
 try{sessionStorage.setItem('waraq-intro-v1','seen');}catch{}
 document.querySelector('.brand-intro')?.remove();
 const overlay=document.createElement('div');overlay.className='brand-intro';
 const logo=brand.cloneNode(true);logo.removeAttribute('href');logo.removeAttribute('aria-label');logo.setAttribute('aria-hidden','true');
 const caption=document.createElement('p');caption.textContent=document.documentElement.lang==='ar'?'بداية حكاية تبقى':'The beginning of a story';
 const skip=document.createElement('button');skip.type='button';skip.textContent=document.documentElement.lang==='ar'?'تخطي المقدمة':'Skip introduction';
 overlay.append(logo,caption,skip);document.body.append(overlay);
 const finish=()=>{clearTimeout(timeout);reduced.removeEventListener('change',finish);if(overlay.contains(document.activeElement))document.querySelector('#app')?.focus({preventScroll:true});overlay.remove();};
 skip.onclick=finish;reduced.addEventListener('change',finish,{once:true});
 const timeout=setTimeout(finish,1750); // Recovery even if animation is unavailable.
 if(typeof overlay.animate!=='function'){finish();return;}
 overlay.animate([{opacity:1},{opacity:1,offset:.74},{opacity:0}],{duration:1600,easing:'ease-out'}).finished.then(finish).catch(finish);
 logo.animate([{opacity:0,transform:'translateY(18px) scale(.9)',filter:'blur(8px)'},{opacity:1,transform:'none',filter:'blur(0px)',offset:.38},{opacity:1,transform:'none',offset:.72},{opacity:0,transform:'translateY(-50px) scale(.65)'}],{duration:1550,easing:'cubic-bezier(.22,1,.36,1)'});
}
export function enhanceHomeMotion(root){
 if(reduced.matches||!('IntersectionObserver' in window)||typeof Element.prototype.animate!=='function')return;
 const abort=new AbortController(),animations=new Set();
 const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){
  const el=entry.target;observer.unobserve(el);
  const a=el.animate([{opacity:.2,transform:'translateY(26px)'},{opacity:1,transform:'none'}],{duration:650,delay:Number(el.dataset.revealDelay||0),easing:'cubic-bezier(.22,1,.36,1)'});
  animations.add(a);a.finished.then(()=>animations.delete(a),()=>animations.delete(a));
 }},{threshold:.12});
 // Whole lines preserve Arabic shaping and screen-reader text.
 root.querySelectorAll('.cinematic-copy h1,.cinematic-copy>p,.hero-actions,.studio-section h2,.occasion-tile,.template-tile,.studio-steps li').forEach((el,i)=>{el.dataset.revealDelay=String(i%4*55);observer.observe(el);});
 function dispose(){observer.disconnect();animations.forEach(a=>a.cancel());abort.abort();}
 reduced.addEventListener('change',dispose,{signal:abort.signal});
 addEventListener('pagehide',dispose,{once:true,signal:abort.signal});
}
