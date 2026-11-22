// Local visual evidence; Sharp is optional and used only to compose contact sheets.
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createApp} from '../server/index.mjs';
import {templates} from '../public/templates/index.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const sharp=process.env.SHARP_MODULE?require(process.env.SHARP_MODULE):null;
const {server}=await createApp({database:':memory:'});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const browser=await chromium.launch({channel:'chrome'}),context=await browser.newContext({baseURL:'http://127.0.0.1:'+server.address().port,viewport:{width:390,height:780},reducedMotion:'reduce'}),page=await context.newPage();
const folder='test-results/template-review';await mkdir(folder,{recursive:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));const rows=[];
try{
 for(const category of [...new Set(templates.map(t=>t.category))]){
  const images=[];
  for(const [i,t] of templates.filter(t=>t.category===category).entries()){
   await page.goto('/templates/'+t.id);const art=page.locator('.inv-art').first();await art.waitFor();
   const file=folder+'/'+t.id+'.png';await art.screenshot({path:file});
   const bytes=await readFile(file);rows.push({id:t.id,category,layout:t.layout,layers:t.layers.map(x=>x[0]).join(', '),motion:t.layers.map(x=>x.at(-1)).join(', '),palette:t.palette,typography:t.typography,sha256:createHash('sha256').update(bytes).digest('hex')});
   if(sharp)images.push({input:await sharp(bytes).resize(240,174,{fit:'cover'}).png().toBuffer(),left:(i%2)*240,top:Math.floor(i/2)*174});
  }
  if(sharp)await sharp({create:{width:480,height:870,channels:4,background:'#ffffff'}}).composite(images).png().toFile(folder+'/'+category+'-sheet.png');
  console.log('Captured '+category+': 10 opening compositions');
 }
 await writeFile(folder+'/manifest.json',JSON.stringify({rows,errors},null,2));
 await writeFile('docs/TEMPLATE_REVIEW_MATRIX.md','# Template review matrix\n\nGenerated from the 80 existing definitions and fresh Chrome screenshots. IDs unchanged. Distinct recipes and image hashes are structural evidence, not a claim of universal artistic quality. All use the existing guest details engine; typography currently uses device font fallbacks.\n\n| ID | Category | Layout | Palette | Motifs | Motion |\n|---|---|---|---|---|---|\n'+rows.map(r=>`| ${r.id} | ${r.category} | ${r.layout} | ${r.palette} | ${r.layers} | ${r.motion} |`).join('\n')+'\n');
 if(errors.length)throw Error(errors.join('\n'));
 console.log('80 visual captures; '+new Set(rows.map(r=>r.sha256)).size+' distinct screenshot hashes; no browser exceptions.');
}finally{await browser.close();await new Promise(ok=>{server.close(ok);server.closeAllConnections()})}
