import general from './categories/general.js';
import ramadan from './categories/ramadan.js';
import fitr from './categories/fitr.js';
import hajj from './categories/hajj.js';
import adha from './categories/adha.js';
import wedding from './categories/wedding.js';
import baby from './categories/baby.js';
import graduation from './categories/graduation.js';
import { paletteFor } from './palettes.js';
export { scene } from './render.js';

const categories = {general, ramadan, fitr, hajj, adha, wedding, baby, graduation};
const common = ['title','occasion','hosts','message','startAt','timeZone','showHijri','place','address','mapsUrl','phone','images','schedule','showCountdown','startedMessage','rsvpEnabled','rsvpUrl','sections','accent','font','language'];
const categoryFields = {
 general:['customFields'],ramadan:['gatheringType'],fitr:['gatheringType'],hajj:['pilgrim','gatheringType'],
 adha:['gatheringType'],wedding:['bride','groom','receptionTime'],baby:['babyName','parents','birthDate'],
 graduation:['graduate','institution','department','cohort']
};
export const templates = Object.entries(categories).flatMap(([category,entries])=>entries.map(entry=>{
 const id=entry.titleEn.toLowerCase().replaceAll('&','and').replace(/[^a-z0-9]+/g,'-').replace(/-$/,'');
 const modern=entry.style==='عصري';
 return Object.freeze({...entry,id,category,version:1,thumbnail:'/templates/covers/'+id+'.svg',preview:'/templates/'+id,
   supportedFields:[...common,...categoryFields[category]],sceneComposition:entry.description,
   animationSignature:entry.layout+' / '+entry.layers.map(([name,,,,,action])=>name+':'+action).join(' → '),
   colorTokens:paletteFor(entry.palette),typography:modern?'Tahoma, Arial, sans-serif':'Georgia, "Times New Roman", serif'});
}));

