import assert from 'node:assert/strict';import {chromium,firefox,webkit} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';import {createRequire} from 'node:module';import {createApp} from '../server/index.mjs';
const dir='test-results/cinematic-final';await mkdir(dir,{recursive:true});const results=[],errors=[],a11y=[];
const {server}=await createApp({database:':memory:'});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
let AxeBuilder;try{({AxeBuilder}=createRequire(import.meta.url)(process.env.AXE_PLAYWRIGHT_MODULE||'../.local/qa-tools/node_modules/@axe-core/playwright'));}catch{}
async function check(name,run){try{await run();results.push({name,status:'PASS'});console.log('PASS',name);}catch(e){results.push({name,status:'FAIL',error:e.message});console.error('FAIL',name,e.message);}}
function track(p){p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});}
try{
 for(const [name,type]of [['chrome',chromium],['firefox',firefox],['webkit',webkit]]){
  let browser;try{browser=await type.launch(name==='chrome'?{channel:'chrome',args:['--enable-unsafe-swiftshader']}:{})}catch(e){results.push({name:name+' availability',status:'BLOCKED',error:e.message});continue;}
  try{
   for(const width of [1440,390])await check(name+' RTL home/editor/catalog/dashboard '+width,async()=>{
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),p=await context.newPage();track(p);
    await context.request.post(base+'/api/auth/register',{data:{email:`${name}-${width}@example.test`,password:'quality-gate-password-123'}});
    const created=await context.request.post(base+'/api/invitations',{data:{templateId:'royal-navy-wax-seal',data:{title:'مراجعة الجودة — دعوة مستقلة',startAt:'2035-10-01T18:00:00Z'},settings:{privacy:'pin',pin:'5842',rsvpEnabled:true}}});assert.equal(created.status(),200);const invitation=(await created.json()).invitation;
    for(const [label,path,selector]of [['home','/','#hero-title'],['catalog','/occasions/wedding','.template-tile'],['editor','/create/royal-navy-wax-seal?id='+invitation.id,'.ed-studio'],['dashboard','/dashboard','.db-page']]){
     await p.goto(base+path);await p.locator(selector).first().waitFor();await p.evaluate(()=>document.fonts.ready);assert.equal(await p.locator('html').getAttribute('dir'),'rtl');assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow '+path);
     await p.screenshot({path:`${dir}/${name}-${label}-${width}.png`,fullPage:true});
     if(name==='chrome'&&AxeBuilder){const audit=await new AxeBuilder({page:p}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();a11y.push({route:label,width,violations:audit.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});assert.deepEqual(audit.violations.map(v=>v.id),[],'axe findings on '+label);}
    }
    await context.close();
   });
   await check(name+' native route fallback and Back/Forward',async()=>{
    const c=await browser.newContext({viewport:{width:390,height:844}}),p=await c.newPage();track(p);await p.goto(base+'/occasions/wedding');const card=p.locator('.template-tile').nth(4);await card.scrollIntoViewIfNeeded();const before=await p.evaluate(()=>scrollY);await card.locator('a').click();await p.locator('.inv-card').waitFor();await p.waitForTimeout(500);await p.goBack();await p.locator('.template-tile').first().waitFor();await p.waitForTimeout(350);assert.ok(Math.abs(await p.evaluate(()=>scrollY)-before)<100);await p.goForward();await p.locator('.inv-card').waitFor();await c.close();
   });
   if(name==='chrome'){
    await check('real WebGL context loss, paused resize, reduced motion and recovery',async()=>{
     const c=await browser.newContext(),p=await c.newPage();track(p);await p.goto(base);await p.waitForFunction(()=>document.querySelector('.glass-stage')?.dataset.renderer==='webgl');
     const renderer=await p.locator('.glass-stage').evaluate(h=>h.glassController.inspect());assert.equal(renderer.material,'MeshPhysicalMaterial');await p.locator('[data-glass-pause]').click();await p.setViewportSize({width:1024,height:900});assert.equal(await p.locator('[data-glass-pause]').getAttribute('aria-pressed'),'true');
     await p.locator('.glass-stage canvas').evaluate(c=>c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());await p.waitForFunction(()=>document.querySelector('.glass-stage').dataset.renderer==='light');assert.ok(await p.locator('[data-glass-title]').isVisible());await p.locator('.hero-actions a').first().click();await p.locator('.occasion-tile').first().waitFor();await c.close();
     const reduced=await browser.newContext({reducedMotion:'reduce'}),q=await reduced.newPage();track(q);const loads=[];q.on('request',r=>{if(r.url().includes('/vendor/three/'))loads.push(r.url());});await q.goto(base);await q.waitForFunction(()=>document.querySelector('.glass-stage')?.glassController);assert.equal(await q.locator('.glass-stage').getAttribute('data-renderer'),'reduced');assert.equal(loads.length,0);await reduced.close();
     const unsupported=await browser.newContext();await unsupported.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind.startsWith('webgl')?null:original.call(this,kind,...args);};});const f=await unsupported.newPage();track(f);await f.goto(base);await f.waitForFunction(()=>document.querySelector('.glass-stage')?.glassController);assert.equal(await f.locator('.glass-stage').getAttribute('data-renderer'),'light');assert.ok(await f.locator('#hero-title').isVisible());await unsupported.close();
    });
   }
  }finally{await browser.close();}
 }
 await check('studio CSS fallback and context loss keep all controls usable',async()=>{
  const child=spawn(process.execPath,['scripts/design-studio.mjs'],{env:{...process.env,STUDIO_PORT:'0'},stdio:['ignore','pipe','pipe']});let browser;
  try{
   const origin=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('studio timeout')),10000);child.stdout.on('data',d=>{const match=d.toString().match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timeout);resolve(match[0]);}});child.on('error',reject);});
   browser=await chromium.launch({channel:'chrome',args:['--enable-unsafe-swiftshader']});
   for(const mode of ['unsupported','lost']){
    const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:dir+'/fallback-video',size:{width:1440,height:1000}}});
    if(mode==='unsupported')await context.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind.startsWith('webgl')?null:original.call(this,kind,...args);};});
    const p=await context.newPage();track(p);await p.goto(origin+'/dev/design-studio');await p.waitForFunction(()=>document.querySelector('.optical-proof canvas')?.proof);
    if(mode==='lost')await p.locator('.optical-proof canvas').evaluate(c=>c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    await p.waitForFunction(()=>document.querySelector('.optical-proof canvas').dataset.renderer==='fallback');await p.locator('#preset').selectOption('crystal');await p.getByRole('button',{name:'إيقاف شبكة المقارنة',exact:true}).click();await p.getByRole('button',{name:'تشغيل شبكة المقارنة',exact:true}).click();await p.locator('.optical-fallback').waitFor();
    const download=p.waitForEvent('download');await p.locator('#export').click();await(await download).saveAs(dir+'/fallback-'+mode+'.json');await p.screenshot({path:dir+'/studio-'+mode+'.png'});const video=p.video();await context.close();await video.saveAs(dir+'/fallback-'+mode+'.webm');
   }
  }finally{await browser?.close();child.kill();}
 });
 await check('no uncaught browser or console errors across engines',async()=>assert.deepEqual(errors,[]));
}finally{await new Promise(r=>server.close(r));await writeFile(dir+'/cross-browser.json',JSON.stringify({results,errors,a11y},null,2));}
if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
