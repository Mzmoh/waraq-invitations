import {glassMarkup,glassControls,connectGlass} from './cinematic-ui.js';
export function renderCinematicHome(app,{gallery,t,icon,occasionTiles,cards}){
 const featured=['royal-navy-wax-seal','golden-crescent','ivory-lace','graduation-cap-toss'].map(id=>gallery.find(x=>x.id===id)).filter(Boolean);
 const demo=gallery.find(x=>x.id==='royal-navy-wax-seal')||gallery[0];
 app.innerHTML=`<div class="wrap landing">
 <section class="cinematic-hero" aria-labelledby="hero-title"><div class="cinematic-copy">
 <p class="cinematic-eyebrow">${t('وَرَق · استوديو الدعوات','WARAQ · INVITATION ATELIER')}</p>
 <h1 id="hero-title">${t('بعض اللحظات<br>تستحق <em>بداية أجمل.</em>','Some moments<br>deserve a <em>beautiful beginning.</em>')}</h1>
 <p>${t('دعوة تحمل إحساسك، قبل تفاصيل مناسبتك. اختر تصميمك، أضف حكايتك، ودع اللحظة تصل إلى من تحب.','An invitation that feels like you. Choose a design, add your story, and let the moment find the people you love.')}</p>
 <div class="hero-actions"><a class="studio-button" href="/occasions">${t('صمّم دعوتك','Create your invitation')}${icon('m9 5 7 7-7 7',16)}</a>${demo?`<a class="studio-button secondary" href="/templates/${demo.id}">${t('افتح دعوة','Open an invitation')}</a>`:''}</div>
 <div class="cinematic-fineprint"><span>${icon('m5 12 4 4 10-10',15)}${t('ثماني مناسبات، ثمانون تصميمًا','8 occasions. 80 designs.')}</span><span>${icon('M12 3v18 M3 12h18',15)}${t('حكايتك بكل تفاصيلها','Made personal, down to the detail')}</span></div>
 </div><div class="cinematic-visual">${glassMarkup()}<div class="visual-caption"><a href="/motion.html">01 / ${t('افتح استوديو الحركة','OPEN MOTION ATELIER')}</a><span data-glass-status>${t('عرض هادئ وخفيف','Quiet, lightweight view')}</span></div>${glassControls()}</div></section>
 <div class="cinematic-divider"><span>${t('لكل مناسبة إحساسها. ولكل إحساس وَرَق.','A different feeling for every occasion.')}</span></div>
 <section class="studio-section"><div class="section-heading"><h2>${t('ما حكايتك القادمة؟','What are we celebrating?')}</h2><a href="/occasions">${t('كل المناسبات','All occasions')}</a></div>${occasionTiles()}</section>
 ${featured.length?`<section class="studio-section"><div class="section-heading"><h2>${t('اختيارات من الاستوديو','Selected by the studio')}</h2><a href="/occasions">${t('اكتشف التصاميم','Explore the collection')}</a></div><div class="template-grid">${cards(featured)}</div></section>`:''}
 <section class="studio-section studio-steps"><p class="cinematic-eyebrow">${t('من أول فكرة، إلى أول ضيف','FROM FIRST THOUGHT TO FIRST GUEST')}</p><h2>${t('ثلاث خطوات. وأثر يبقى.','Three steps. A lasting impression.')}</h2>
 <ol><li><strong>${t('اختر إحساس الدعوة','Find your feeling')}</strong><p>${t('شاهد القالب متحركًا قبل اختياره.','Open a moving preview before you choose.')}</p></li><li><strong>${t('اجعلها تشبهك','Make it yours')}</strong><p>${t('الأسماء، الصور، الموعد، والتفاصيل الصغيرة.','Names, photos, the date, and the little details.')}</p></li><li><strong>${t('أرسل بداية الحكاية','Share the beginning')}</strong><p>${t('شارك رابط الدعوة وتابع ردود ضيوفك.','Share your invitation link and follow your guest replies.')}</p></li></ol><a class="studio-button" href="/occasions">${t('ابدأ حكايتك','Begin your story')}</a></section>
 </div>`;
 connectGlass(app.querySelector('.cinematic-visual')).catch(()=>{app.querySelector('.glass-stage').dataset.renderer='light';});
}
