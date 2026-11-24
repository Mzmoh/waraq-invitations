import {glassMarkup,glassControls,connectGlass} from './cinematic-ui.js';
if(localStorage.getItem('waraq-language')==='en'){
 document.documentElement.lang='en';document.documentElement.dir='ltr';document.title='WARAQ — Motion atelier';
 document.querySelector('.crumb').textContent='Back to WARAQ';document.querySelector('.motion-heading h1').textContent='Light, glass, and a story.';document.querySelector('.motion-heading>p:last-child').textContent='An original composition for moments that deserve to stay.';
}
const root=document.querySelector('#motion-composition');root.innerHTML=glassMarkup()+glassControls();
connectGlass(root).catch(()=>{root.querySelector('.glass-stage').dataset.renderer='light';});
