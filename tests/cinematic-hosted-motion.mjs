import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const base='https://waraq-cinematic-pr5-preview-moh7store.vercel.app',dir='test-results/cinematic-hosted';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--enable-unsafe-swiftshader']}),errors=[],results=[],scenes=[];
try{
 for(const [label,width,height]of [['desktop',1440,1000],['mobile',390,844]]){
  const c=await browser.newContext({viewport:{width,height},recordVideo:{dir:dir+'/motion-'+label,size:{width,height}}}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await p.goto(base);await p.locator('.brand-intro').waitFor();await p.waitForTimeout(800);await p.screenshot({path:dir+'/intro-'+label+'.png'});await p.locator('.brand-intro').waitFor({state:'detached'});
  await p.waitForFunction(()=>document.querySelector('.glass-stage')?.dataset.renderer==='webgl');
  const before=await p.locator('.glass-stage').evaluate(h=>({time:h.glassController.time,...h.glassController.inspect()}));await p.waitForTimeout(700);const after=await p.locator('.glass-stage').evaluate(h=>({time:h.glassController.time,...h.glassController.inspect()}));assert.ok(after.renders>before.renders);assert.ok(after.time>before.time);scenes.push({label,before,after});
  await p.screenshot({path:dir+'/webgl-'+label+'.png'});await p.mouse.wheel(0,650);await p.waitForTimeout(500);await p.mouse.wheel(0,600);await p.waitForTimeout(500);await p.screenshot({path:dir+'/scroll-'+label+'.png'});
  await p.goto(base+'/occasions/wedding');await p.locator('.template-tile').nth(4).scrollIntoViewIfNeeded();await p.waitForTimeout(500);await p.locator('.template-tile').nth(4).locator('a').click();await p.locator('.inv-card').waitFor();await p.waitForTimeout(600);await p.screenshot({path:dir+'/transition-'+label+'.png'});assert.equal(await p.locator('html').getAttribute('dir'),'rtl');assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const video=p.video();await c.close();await video.saveAs(dir+'/motion-'+label+'.webm');results.push('PASS '+label+': intro, progressing WebGL frames, scroll, selected-card transition and RTL');
 }
 const c=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);
 const templates=await p.evaluate(async()=>(await import('/templates/index.js')).templates.map(t=>({id:t.id,category:t.category})));assert.equal(templates.length,80);assert.equal(new Set(templates.map(t=>t.id)).size,80);
 const checked=[];
 for(const [i,t]of templates.entries()){
  await p.goto(base+'/templates/'+t.id);await p.locator('[data-skip]').click();await p.locator('.inv-body').waitFor();await p.evaluate(()=>document.fonts.ready);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),t.id+' overflow');checked.push(t.id);if(i%10===0)await p.screenshot({path:dir+'/template-'+t.category+'.png',fullPage:true});
 }
 results.push('PASS 80 unique hosted mobile template reveals, decoded fonts, no horizontal overflow');await c.close();assert.deepEqual(errors,[]);await writeFile(dir+'/motion-results.json',JSON.stringify({base,results,scenes,templates:checked,errors,note:'Actual hosted site on desktop Chrome with software WebGL; not physical mobile GPU acceptance.'},null,2));console.log(results.join('\n'));
}finally{await browser.close();}
