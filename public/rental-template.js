export function withDesign(base,design) {
 if(!base||!design)return base;
 const {id,title_ar:titleAr,title_en:titleEn,background,accent}=design;
 return {...base,id,titleAr,titleEn,preview:'/templates/'+id,
  ...(base.colorTokens?{colorTokens:{...base.colorTokens,background,accent}}:{})};
}
export function renderSocial(container,links) {
 if(!links?.length)return;
 const nav=document.createElement('nav');
 nav.setAttribute('aria-label',document.documentElement.lang==='en'?'Social links':'روابط التواصل');
 nav.className='social-links';
 const names={instagram:'Instagram',tiktok:'TikTok',whatsapp:'WhatsApp'};
 for(const {platform,url} of links){
  if(!Object.hasOwn(names,platform))continue;
  const anchor=document.createElement('a');
  anchor.textContent=names[platform];anchor.href=url;anchor.rel='noopener noreferrer';anchor.target='_blank';
  nav.append(anchor);
 }
 container.append(nav);
}
