import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
const baseline=process.argv.includes('--baseline'),root=baseline?resolve('.local/baseline'):process.cwd();
const {createApp}=await import(pathToFileURL(resolve(root,'server/index.mjs')));
const {server}=await createApp({database:':memory:',publicDir:resolve(root,'public')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port,evidence='test-results/cinematic-kit',prefix=baseline?'before':'after';await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--enable-unsafe-swiftshader']}),results=[],errors=[],network=[],metrics=[];let studio;
async function check(name,fn){try{await fn();results.push({name,status:'PASS'});console.log('PASS',name);}catch(e){results.push({name,status:'FAIL',error:e.message});console.error('FAIL',name,e.message);}}
function track(p){p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('response',r=>{if(r.status()>=500)network.push({url:r.url(),status:r.status()});});}
try{
 // Same browser, viewport, network and CPU for both worktrees. Five warm API
 // samples and three cold page reloads; lab results, never field INP.
 const perf=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 const p=await perf.newPage();track(p);const cdp=await perf.newCDPSession(p);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1.6*1024*1024/8,uploadThroughput:.75*1024*1024/8});
 await perf.addInitScript(()=>{window.vitals={lcp:0,cls:0};new PerformanceObserver(list=>{for(const entry of list.getEntries())window.vitals.lcp=entry.startTime;}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(list=>{for(const entry of list.getEntries())if(!entry.hadRecentInput)window.vitals.cls+=entry.value;}).observe({type:'layout-shift',buffered:true});});
 for(let i=0;i<3;i++){await p.goto(base);await p.locator('.occasion-tile').first().waitFor();await p.waitForTimeout(3000);metrics.push(await p.evaluate(()=>({...window.vitals,bytes:performance.getEntriesByType('resource').reduce((n,r)=>n+r.transferSize,0),requests:performance.getEntriesByType('resource').length})));}
 await perf.close();const api=[];for(let i=0;i<6;i++){const start=performance.now(),r=await fetch(base+'/api/catalog');assert.equal(r.status,200);await r.arrayBuffer();if(i)api.push(performance.now()-start);}
 await writeFile(evidence+'/'+prefix+'-performance.json',JSON.stringify({environment:'Desktop Chrome, loopback SQLite, 390x844 DPR2, cold cache, 4x CPU, 150ms, 1.6/.75 Mbps; three page samples; five warm API samples. Software WebGL allowed.',pages:metrics,apiMs:api},null,2));
 if(baseline){console.log('PASS baseline captured');}
 else {
 const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:evidence+'/video-desktop',size:{width:1440,height:1000}}}),page=await context.newPage();track(page);
 await check('intro is skippable, session-scoped and uses the existing brand',async()=>{
  await page.goto(base);await page.locator('.brand-intro').waitFor();assert.equal(await page.locator('.brand-intro svg path').getAttribute('d'),await page.locator('#site-header .brand svg path').getAttribute('d'));await page.screenshot({path:evidence+'/intro.png'});await page.locator('.brand-intro').waitFor({state:'detached'});
  await page.reload();await page.locator('.glass-stage').waitFor();assert.equal(await page.locator('.brand-intro').count(),0);
  await page.evaluate(()=>sessionStorage.removeItem('waraq-intro-v1'));await page.reload();await page.locator('.brand-intro button').click();assert.equal(await page.locator('.brand-intro').count(),0);
 });
 await check('live 3D responds to pointer, scroll and pause',async()=>{
  await page.waitForFunction(()=>document.querySelector('.glass-stage')?.glassController);await page.waitForTimeout(7000);
  const controller=()=>page.locator('.glass-stage');const a=await controller().evaluate(h=>h.glassController.inspect().renders);await page.mouse.move(800,350);await page.waitForTimeout(400);assert.ok(await controller().evaluate(h=>h.glassController.inspect().renders)>a);
  await writeFile(evidence+'/scene-fps.json',JSON.stringify(await controller().evaluate(h=>h.glassController.inspect()),null,2));await page.screenshot({path:evidence+'/after-desktop.png',fullPage:true});for(let i=0;i<5;i++){await page.mouse.wheel(0,380);await page.waitForTimeout(240);}for(let i=0;i<5;i++){await page.mouse.wheel(0,-380);await page.waitForTimeout(180);}
  await page.locator('[data-glass-pause]').click();const r=await controller().evaluate(h=>h.glassController.inspect().renders);await page.waitForTimeout(200);assert.equal(await controller().evaluate(h=>h.glassController.inspect().renders),r);await page.locator('[data-glass-replay]').click();
 });
 await check('keyboard access, responsive RTL/LTR and reduced motion',async()=>{
  const quiet=await browser.newContext({reducedMotion:'reduce'}),q=await quiet.newPage();track(q);await q.goto(base);await q.locator('.occasion-tile').first().waitFor();assert.equal(await q.locator('.brand-intro').count(),0);await q.waitForFunction(()=>document.querySelector('.glass-stage')?.glassController);assert.equal(await q.locator('.glass-stage').getAttribute('data-renderer'),'reduced');
  for(const width of [360,390,430,768,1024,1440,1920,2560]){await q.setViewportSize({width,height:900});assert.ok(await q.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+width);}
  await q.setViewportSize({width:390,height:844});await q.screenshot({path:evidence+'/after-mobile.png',fullPage:true});await q.keyboard.press('Tab');assert.equal(await q.locator('.jump').evaluate(e=>e===document.activeElement),true);
  await q.evaluate(()=>localStorage.setItem('waraq-language','en'));await q.reload();await q.locator('#hero-title').waitFor();assert.equal(await q.locator('html').getAttribute('dir'),'ltr');assert.ok(await q.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await quiet.close();
 });
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,recordVideo:{dir:evidence+'/video-mobile',size:{width:390,height:844}}});await mobile.addInitScript(()=>addEventListener('pageswap',()=>sessionStorage.setItem('quality-named-cards',String([...document.querySelectorAll('.template-art')].filter(e=>e.style.viewTransitionName&&e.style.viewTransitionName!=='none').length))));await mobile.addInitScript(()=>addEventListener('pagereveal',e=>{window.transitionReveal={active:!!e.viewTransition,targetReady:false};e.viewTransition?.ready.then(()=>{window.transitionReveal.targetReady=!!document.querySelector('.preview-device');window.transitionReveal.shell=!!document.querySelector('[data-transition-shell]');},err=>window.transitionReveal.error=err.message);}));const m=await mobile.newPage();track(m);
 await check('mobile card/detail Back/Forward preserves route and scroll',async()=>{
  await m.goto(base+'/occasions/wedding');await m.locator('.template-tile').first().waitFor();const card=m.locator('.template-tile').nth(4);await card.scrollIntoViewIfNeeded();const before=await m.evaluate(()=>scrollY),href=await card.locator('a').getAttribute('href');await card.locator('a').tap();await m.locator('.inv-card').waitFor();assert.equal(new URL(m.url()).pathname,href);assert.equal(await m.evaluate(()=>sessionStorage.getItem('quality-named-cards')),'1','only the clicked card participates in shared transition');await m.waitForTimeout(500);console.log('TRANSITION',await m.evaluate(()=>window.transitionReveal));assert.equal(await m.evaluate(()=>window.transitionReveal?.targetReady),true,'destination exists when shared snapshot is taken');await m.waitForTimeout(600);await m.screenshot({path:evidence+'/mobile-detail.png'});await m.goBack();await m.locator('.template-tile').first().waitFor();await m.waitForTimeout(500);assert.ok(Math.abs(await m.evaluate(()=>scrollY)-before)<100,'native scroll restoration');await m.goForward();await m.locator('.inv-card').waitFor();
 });const mobileVideo=m.video(),desktopVideo=page.video();await mobile.close();await context.close();await mobileVideo.saveAs(evidence+'/mobile.webm');await desktopVideo.saveAs(evidence+'/desktop.webm');
 await check('studio is loopback-only and production application returns 404',async()=>{
  assert.equal((await fetch(base+'/dev/design-studio')).status,404);assert.equal((await fetch(base+'/dev/studio.js')).status,404);
  studio=spawn(process.execPath,['scripts/design-studio.mjs'],{env:{...process.env,STUDIO_PORT:'0'},stdio:['ignore','pipe','pipe']});
  const studioBase=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('studio start timeout')),10000);studio.stdout.on('data',data=>{const match=data.toString().match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timeout);resolve(match[0]);}});studio.on('error',reject);});
  const s=await browser.newContext({viewport:{width:1440,height:1100},recordVideo:{dir:evidence+'/video-optical',size:{width:1440,height:1100}}}),sp=await s.newPage();track(sp);await sp.goto(studioBase+'/dev/design-studio');await sp.waitForFunction(()=>document.querySelector('.optical-proof canvas')?.proof);const proof=sp.locator('.optical-proof canvas');assert.equal(await proof.evaluate(c=>c.proof.inspect().renderer),'webgl2');
  assert.equal((await s.request.post(studioBase+'/api/auth/register',{headers:{Origin:studioBase},data:{email:'studio@example.test',password:'studio-only-password-123'}})).status(),200,'same-origin application works through studio proxy');
  assert.equal((await s.request.post(studioBase+'/api/auth/register',{headers:{Origin:'https://rejected.example'},data:{email:'rejected@example.test',password:'studio-only-password-123'}})).status(),403,'CSRF protection remains active');
  await proof.evaluate(c=>c.proof.seek(2));await sp.screenshot({path:evidence+'/optical-comparison.png'});const one=await proof.screenshot();await proof.evaluate(c=>c.proof.update({ior:2,thickness:1.8}));const two=await proof.screenshot();assert.notDeepEqual(one,two,'IOR/thickness alter pixels');await proof.evaluate(c=>c.proof.update({ior:1.46,thickness:.65,refraction:0}));const zero=await proof.screenshot();assert.notDeepEqual(one,zero,'zero refraction removes displacement');
  await proof.evaluate(c=>c.proof.play());await sp.locator('#preset').selectOption('crystal');await sp.waitForTimeout(1000);const download=sp.waitForEvent('download');await sp.locator('#export').click();const d=await download;await d.saveAs(evidence+'/exported-material.json');
  await sp.locator('#import').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"schemaVersion":1,"optics":{"ior":"<script>"}}')});await sp.locator('#feedback').filter({hasText:'قيمة غير صالحة'}).waitFor();assert.equal(await proof.evaluate(c=>c.proof.inspect().options.ior),1.7);
  await sp.locator('#import').setInputFiles(evidence+'/exported-material.json');await sp.locator('#feedback').filter({hasText:'تم استيراد'}).waitFor();await sp.waitForTimeout(2000);await writeFile(evidence+'/fps.json',JSON.stringify(await proof.evaluate(c=>c.proof.inspect()),null,2));await sp.locator('#intro').click();await sp.waitForTimeout(1800);const opticalVideo=sp.video();await s.close();await opticalVideo.saveAs(evidence+'/optical.webm');
 });
 await check('no uncaught exceptions or HTTP 5xx',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(network,[]);});
 }
}finally{studio?.kill();await browser.close();await new Promise(r=>server.close(r));await writeFile(evidence+'/'+prefix+'-results.json',JSON.stringify({results,errors,network},null,2));}
if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
