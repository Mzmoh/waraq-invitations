import { mkdir, writeFile } from 'node:fs/promises';
import { templates, scene } from '../public/templates/index.js';

const root=new URL('../',import.meta.url);
await mkdir(new URL('public/templates/covers/',root),{recursive:true});
const sections=new Map();
for(const template of templates){
  await writeFile(new URL('public'+template.thumbnail,root),scene(template,{staticCover:true}));
  if(!sections.has(template.category))sections.set(template.category,[]);
  sections.get(template.category).push('| '+[template.titleAr,template.titleEn,template.version,template.style,template.sceneComposition,template.animationSignature].join(' | ')+' |');
}
const catalogue=['# دليل قوالب الدعوات','',...Array.from(sections.entries()).flatMap(([category,rows])=>['## '+category,'','| القالب | الاسم الإنجليزي | الإصدار | الأسلوب | تكوين المشهد | حركة الطبقات |','|---|---|---|---|---|---|',...rows,''])];
await mkdir(new URL('docs/',root),{recursive:true});
await writeFile(new URL('docs/TEMPLATE_CATALOG.md',root),catalogue.join('\n'));
console.log('Generated '+templates.length+' SVG covers and '+sections.size+' catalog sections.');

