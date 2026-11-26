import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {createApp} from '../server/index.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const {server}=await createApp({database:':memory:'});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'chrome',args:['--enable-unsafe-swiftshader']});const evidence='test-results/cinematic';await mkdir(evidence,{recursive:true});
const results=[],errors=[];
async function check(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS',name);}catch(e){results.push({name,passed:false,error:e.message});console.error('FAIL',name,e.message);}}
const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));let stage;
async function ready(p){await p.waitForFunction(()=>document.querySelector('.glass-stage')?.glassController);return p.locator('.glass-stage');}
async function fit(p){assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'horizontal overflow');}
try{
 await check('actual WebGL physical glass material and exact rounded slab bounds',async()=>{
  await page.goto(base);stage=await ready(page);await stage.evaluate(h=>h.glassController.seek(3));
  const actual=await stage.evaluate(h=>h.glassController.inspect());assert.equal(actual.renderer,'webgl');assert.equal(actual.engine,'180');assert.equal(actual.material,'MeshPhysicalMaterial');assert.equal(actual.transmission,1);assert.equal(actual.ior,1.46);assert.equal(actual.thickness,.65);assert.equal(actual.roughness,.16);assert.equal(actual.clearcoat,1);
  [4.9,3.6,.24].forEach((n,i)=>assert.ok(Math.abs(actual.bounds[i]-n)<.00001));assert.ok(actual.calls>0);
  await page.screenshot({path:evidence+'/home-desktop.png',fullPage:true});
 });
 await check('standalone default, palette/text editing and 9:16 composition',async()=>{
  await page.goto(base+'/motion.html');stage=await ready(page);await stage.evaluate(h=>h.glassController.seek(4.5));
  const defaults=await stage.evaluate(h=>h.glassController.options);assert.equal(defaults.duration,6);assert.equal(defaults.fps,30);assert.equal(defaults.aspect,'16:9');
  await page.locator('.glass-config summary').click();const title='محمد ونور — بداية حكاية جميلة';await page.locator('[name=title]').fill(title);assert.equal(await page.locator('[data-glass-title]').textContent(),title);
  await page.locator('[name=aspect]').selectOption('9:16');await page.waitForFunction(()=>document.querySelector('.glass-stage').dataset.aspect==='9:16');await ready(page);
  await stage.evaluate(h=>h.glassController.seek(4.5));const rect=await stage.boundingBox();assert.ok(Math.abs(rect.width/rect.height-9/16)<.01);
  await page.locator('[name=coral]').evaluate(el=>{el.value='#dd5566';el.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForFunction(()=>document.querySelector('.glass-stage').glassController.options.palette.coral==='#dd5566');
  await page.locator('[name=duration]').fill('8');await page.waitForFunction(()=>document.querySelector('.glass-stage').glassController.options.duration===8);
  await stage.evaluate(h=>h.glassController.seek(6));await stage.screenshot({path:evidence+'/portrait-glass.png'});
  await page.locator('[name=title]').fill('<img src=x onerror=alert(1)>');assert.equal(await page.locator('[data-glass-title] img').count(),0);
 });
 await check('reading hold is visually stable and explicit light mode keeps text',async()=>{
  await stage.evaluate(h=>h.glassController.seek(6));const renders=await stage.evaluate(h=>h.glassController.inspect().renders);const a=await stage.screenshot();await stage.evaluate(h=>h.glassController.seek(8));const b=await stage.screenshot();assert.deepEqual(a,b);assert.equal(await stage.evaluate(h=>h.glassController.inspect().renders),renders,'identical reading-hold poses must not render again');
  await page.locator('[data-glass-light]').click();await page.waitForFunction(()=>document.querySelector('.glass-stage').dataset.renderer==='light');assert.equal(await page.locator('[data-glass-light]').getAttribute('aria-pressed'),'true');assert.ok(await page.locator('[data-glass-title]').isVisible());
 });
 await check('reduced motion never downloads Three and supports narrow Arabic layouts',async()=>{
  const context=await browser.newContext({reducedMotion:'reduce',viewport:{width:390,height:844}});const p=await context.newPage();const loads=[];p.on('request',r=>{if(r.url().includes('/vendor/three/'))loads.push(r.url());});
  await p.goto(base);await ready(p);assert.equal(await p.locator('.glass-stage').getAttribute('data-renderer'),'reduced');
  for(const width of [320,390,768,1440]){await p.setViewportSize({width,height:900});await fit(p);}
  await p.setViewportSize({width:390,height:844});await p.screenshot({path:evidence+'/home-mobile.png',fullPage:true});assert.equal(loads.length,0);
  await p.goto(base+'/motion.html');await ready(p);await p.locator('.glass-config summary').click();await p.locator('[name=aspect]').selectOption('9:16');await p.waitForFunction(()=>document.querySelector('.glass-stage').dataset.aspect==='9:16');await fit(p);assert.equal(loads.length,0);await p.locator('.glass-stage').screenshot({path:evidence+'/portrait-reduced.png'});await context.close();
 });
 await check('no WebGL and Save-Data degrade before loading Three',async()=>{
  for(const mode of ['no-webgl','save-data']){
   const c=await browser.newContext();await c.addInitScript(mode=>{if(mode==='save-data')Object.defineProperty(navigator,'connection',{value:{saveData:true}});else{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind.startsWith('webgl')?null:original.call(this,kind,...args);};}},mode);
   const p=await c.newPage(),loads=[];p.on('request',r=>{if(r.url().includes('/vendor/three/'))loads.push(r.url());});await p.goto(base);await ready(p);assert.equal(await p.locator('.glass-stage').getAttribute('data-renderer'),'light');assert.equal(loads.length,0);await c.close();
  }
 });
 await check('English LTR and invitation templates retain their own identity',async()=>{
  const c=await browser.newContext();await c.addInitScript(()=>localStorage.setItem('waraq-language','en'));const p=await c.newPage();await p.goto(base);await ready(p);assert.equal(await p.locator('html').getAttribute('dir'),'ltr');await fit(p);await p.screenshot({path:evidence+'/home-english.png'});
  const loads=[];p.on('request',r=>{if(r.url().includes('/vendor/three/'))loads.push(r.url());});await p.goto(base+'/templates/golden-crescent');await p.locator('.inv-card').waitFor();assert.equal(await p.locator('.glass-stage').count(),0);assert.equal(loads.length,0);await c.close();
 });
 await check('no uncaught cinematic exceptions',async()=>assert.deepEqual(errors,[]));
}finally{
 await writeFile(evidence+'/results.json',JSON.stringify({results,errors,limits:'Desktop Chrome/software WebGL and local disposable SQLite. No actual phone, hosted Vercel or production performance measurement.'},null,2));await browser.close();await new Promise(r=>server.close(r));
}
if(results.some(r=>!r.passed))process.exitCode=1;
