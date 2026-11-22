// Run against a disposable local instance. This test creates a user and publishes an invitation.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

let base = process.env.QA_BASE_URL, localServer;
if(!base){
  const {createApp}=await import('../server/index.mjs');
  ({server:localServer}=await createApp({database:':memory:'}));
  await new Promise(resolve=>localServer.listen(0,'127.0.0.1',resolve));
  base='http://127.0.0.1:'+localServer.address().port;
  localServer.unref();
}
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname),'Use an isolated loopback database');
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({channel:process.env.QA_BROWSER || 'chrome'});
const evidence = process.env.QA_EVIDENCE_DIR;
if(evidence) await mkdir(evidence,{recursive:true});
const failures = [], passes = [], errors=[];
const host = await browser.newContext({baseURL:base, viewport:{width:1440,height:900}, locale:'ar-IQ'});
const page = await host.newPage();
page.setDefaultTimeout(7000);
function track(p){p.on('pageerror', error=>errors.push(p.url()+' '+error.message));}
track(page);
async function test(name, run){
  try {await run();passes.push(name);console.log('PASS',name);}
  catch(e){failures.push({name,error:e.message});console.error('FAIL',name,e.message);}
}
async function shot(p,file){if(evidence)await p.screenshot({path:path.join(evidence,file+'.png'),animations:'disabled'});}
async function open(p, route){await p.goto(route,{waitUntil:'domcontentloaded'});}
async function fit(p){const overflow=await p.evaluate(()=>({width:innerWidth,total:document.documentElement.scrollWidth,items:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&& (r.right>innerWidth+1||r.left< -1)}).slice(-12).map(e=>({tag:e.tagName,cls:e.className,w:e.getBoundingClientRect().width,left:e.getBoundingClientRect().left}))}));if(overflow.total>overflow.width+1){console.log(JSON.stringify(overflow));await shot(p,'overflow-failure');}assert.ok(overflow.total<=overflow.width+1,'Horizontal overflow at '+p.url());}
let templates=[], id, slug;
try{
  await test('Manifest, unique signatures and standalone cover responses',async()=>{
    await open(page,'/');
    templates=await page.evaluate(async()=>{const {templates}=await import('/templates/index.js');return templates;});
    assert.equal(templates.length,80);
    assert.equal(new Set(templates.map(t=>t.id)).size,80);
    assert.equal(new Set(templates.map(t=>JSON.stringify([t.sceneComposition,t.animationSignature]))).size,80);
    assert.equal(new Set(templates.map(t=>t.category)).size,8);
    for(const category of new Set(templates.map(t=>t.category)))assert.equal(templates.filter(t=>t.category===category).length,10);
    const covers=await Promise.all(templates.map(async t=>{const r=await page.request.get(t.thumbnail);assert.equal(r.status(),200);return r.text();}));
    assert.equal(new Set(covers).size,80);
  });
  await test('Home and occasion selection at five viewport widths',async()=>{
    for(const width of [360,390,430,768,1440]){
      await page.setViewportSize({width,height:850});await open(page,'/');
      await page.locator('a[href="/occasions"]').first().waitFor({state:'attached'});await fit(page);
      if(width===390||width===1440)await shot(page,'home-'+width);
      await open(page,'/occasions');
      await page.waitForFunction(()=>document.querySelectorAll('a[href^="/occasions/"]').length>=8);
      assert.equal(await page.locator('a[href^="/occasions/"]').evaluateAll(links=>new Set(links.map(a=>a.pathname)).size),8);await fit(page);
    }
  });
  for(const category of [...new Set(templates.map(t=>t.category))]){
    await test(category+' ten preview pages and ten interactive reveals',async()=>{
      await open(page,'/occasions/'+category);
      await page.waitForFunction(()=>document.querySelectorAll('a[href^="/templates/"]').length>=10);
      assert.equal(await page.locator('a[href^="/templates/"]').evaluateAll(links=>new Set(links.map(a=>a.pathname)).size),10);
      for(const t of templates.filter(t=>t.category===category)){
        await open(page,'/templates/'+t.id);
        const scene=page.locator('.inv-card').first();
        await scene.waitFor();assert.equal(await scene.locator('.inv-art svg').count()>0,true);
        await scene.locator('[data-open]').last().click();
        await scene.locator('.inv-body').waitFor();assert.ok(await scene.evaluate(a=>a.classList.contains('opened')));
      }
    });
  }
  await test('Specialized editor inputs and general custom fields',async()=>{
    for(const [cat,expected] of [['baby','babyName'],['graduation','graduate'],['hajj','pilgrim'],['ramadan','gatheringType'],['general','customFields']]){
      await open(page,'/create/'+templates.find(t=>t.category===cat).id);
      await page.locator('.ed-fields').waitFor();
      assert.equal(await page.locator('.ed-fields [name=bride]').count(),0);
      if(cat==='general'){await page.locator('.ed-fields .ed-group button').last().click();await page.locator('input[name=label]').fill('Custom field');}
      else await page.locator('.ed-fields [name='+expected+']').waitFor();
    }
  });
  await test('Editor, phone preview tabs and consent to motion at five widths',async()=>{
    await open(page,'/create/royal-navy-wax-seal');
    await page.locator('.ed-steps').waitFor();
    for(const width of [360,390,430,768,1440]){
      await page.setViewportSize({width,height:844});
      await fit(page);
      const preview=page.locator('.ed-mobiles [data-mode=preview]');
      if(await preview.isVisible()){
        await preview.click();await page.locator('.ed-screen').waitFor();
        await fit(page);await page.locator('.ed-mobiles [data-mode=form]').click();
      }
    }
  });
  await test('Time zones, DST ambiguity and past countdown',async()=>{
    const values=await page.evaluate(async()=>{
      const {utcCandidates}=await import('/editor-model.js'),{countdownParts}=await import('/invitation.js');
      return [utcCandidates('2035-10-21T18:34:37','Asia/Baghdad'),utcCandidates('2026-11-01T01:30:16','America/New_York'),utcCandidates('2026-03-08T02:30:16','America/New_York'),countdownParts('2020-01-01T00:00:00Z')];
    });
    assert.deepEqual(values,[['2035-10-21T15:34:37.000Z'],['2026-11-01T05:30:16.000Z','2026-11-01T06:30:16.000Z'],[],null]);
  });
  await test('Wedding creation, photo replacement/removal, live preview, signup and publish',async()=>{
    await open(page,'/occasions');await page.locator('a[href="/occasions/wedding"]').first().click();
    await page.locator('a[href="/templates/royal-navy-wax-seal"]').first().click();
    await page.locator('a[href="/create/royal-navy-wax-seal"]').first().click();
    await page.locator('input[name=title]').fill('Browser wedding QA');
    await page.locator('[name=groom]').fill('نور');await page.locator('[name=bride]').fill('ريم');
    await page.waitForFunction(()=>document.querySelector('.ed-preview')?.textContent.includes('ريم'));
    await page.locator('.ed-steps button').nth(1).click();
    await page.locator('[name=wall]').fill('2035-10-21T18:34:37');
    await page.locator('[name=place]').fill('Baghdad');
    await page.locator('[name=mapsUrl]').fill('https://www.google.com/maps/search/Baghdad');
    await page.locator('[name=showHijri]').check();
    await page.locator('.ed-steps button').nth(2).click();
    const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=48;c.height=32;const g=c.getContext('2d');g.fillStyle='#ee6845';g.fillRect(0,0,48,32);return c.toDataURL().split(',')[1];});
    const image={name:'portrait.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')};
    await page.locator('.ed-drop input').setInputFiles(image);await page.locator('.ed-photo img').waitFor();
    await page.locator('.ed-photo input[type=file]').setInputFiles(image);
    await page.locator('.ed-photo').getByRole('button',{name:/Remove photo|حذف الصورة/}).click();await page.locator('.ed-photo').waitFor({state:'detached'});
    await page.locator('.ed-drop input').setInputFiles(image);await page.locator('.ed-photo img').waitFor();
    await page.locator('[name=alt]').fill('QA portrait');await page.locator('[name=zoom]').press('End');
    await shot(page,'editor-desktop');
    await page.locator('.ed-steps button').nth(3).click();await page.locator('[name=rsvpEnabled]').check();
    await page.locator('.ed-actions .ed-primary').click();
    await page.waitForURL('**/auth?**');
    await page.locator('.db-auth-main > button').click();
    await page.locator('[name=email]').fill('qa-'+Date.now()+'@example.test');await page.locator('[name=password]').fill('Browser-self-test-2035');
    await page.locator('.db-form [type=submit]').click();
    await page.waitForURL('**/create/**');
    await page.locator('.ed-steps button').first().click();
    assert.equal(await page.locator('[name=title]').inputValue(),'Browser wedding QA');
    await page.locator('.ed-steps button').nth(3).click();await page.locator('.ed-actions .ed-primary').click();
    await page.waitForURL('**/dashboard/invitations/**');
    id=new URL(page.url()).pathname.split('/').pop();
    const record=(await (await host.request.get('/api/invitations/'+id)).json()).invitation;
    assert.equal(record.status,'published');assert.equal(record.data.startAt,'2035-10-21T15:34:37.000Z');
    assert.equal(record.data.images.length,1);slug=record.slug;
  });
  await test('Independent mobile guest, countdown, calendar, QR, attendance and decline',async()=>{
    assert.ok(slug,'Need published wedding from previous case');
    const guest=await browser.newContext({baseURL:base,viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
    try{
      const p=await guest.newPage();track(p);await open(p,'/i/'+slug);
      const seal=p.locator('.inv-seal-target,.inv-paper-envelope').first();
      await seal.waitFor();await shot(p,'guest-closed');await seal.click();
      await p.locator('.inv-body').waitFor();assert.ok(await p.locator('.inv-card').evaluate(el=>el.classList.contains('inv-paused')));
      for(const width of [360,390,430,768,1440]){await p.setViewportSize({width,height:844});await fit(p);}
      await p.setViewportSize({width:390,height:844});
      const seconds=p.locator('[data-counter] b').last();const prev=await seconds.innerText();
      await p.waitForFunction(x=>document.querySelector('[data-counter] span:last-child b').textContent!==x,prev);
      await p.locator('.inv-photos img').scrollIntoViewIfNeeded();
      await p.locator('.inv-photos img').evaluate(img=>img.decode());assert.ok(await p.locator('.inv-photos img').evaluate(img=>img.alt==='QA portrait'&&img.naturalWidth>0));
      await p.locator('[data-qr]').click();await p.locator('.inv-qr svg,.inv-qr canvas,.inv-qr img').first().waitFor();
      let file=p.waitForEvent('download');await p.locator('[data-calendar]').click();
      const download=await file;assert.match(download.suggestedFilename(),/\.ics$/);const bytes=await readFile(await download.path(),'utf8');assert.match(bytes,/DTSTART:20351021T153437Z/);
      assert.match(await p.locator('a[href*="google.com/maps"]').getAttribute('href'),/^https:/);
      for(const attending of ['yes','no']){
        if(attending==='no'){await p.evaluate(key=>sessionStorage.removeItem(key),'waraq-rsvp:'+slug);await p.reload();await p.locator('[data-skip]').click();}
        await p.locator('.inv-rsvp-form [name=name]').fill('QA '+attending);await p.locator('.inv-rsvp-form [name=attending]').selectOption(attending);
        const saved=p.waitForResponse(r=>r.url().endsWith('/rsvp')&&r.request().method()==='POST');
        await p.locator('.inv-rsvp-form button[type=submit]').click();assert.ok((await saved).ok());await fit(p);
      }
      const responses=await (await host.request.get('/api/invitations/'+id+'/responses')).json();assert.equal(responses.responses.length,2);
      const locked=await guest.request.get('/api/invitations/'+id+'/responses');assert.ok([401,403,404].includes(locked.status()));
      const archived=await host.request.post('/api/invitations/'+id+'/archive',{data:{}});assert.ok(archived.ok());
      assert.equal((await guest.request.get('/api/public/'+slug)).status(),404);
    }finally{await guest.close();}
  });
  await test('No uncaught browser exceptions',async()=>assert.deepEqual(errors,[]));
}finally{
  await browser.close();
  if(localServer) await new Promise(resolve=>localServer.close(resolve));
  if(evidence) await writeFile(path.join(evidence,'browser-results.json'),JSON.stringify({passes,failures,errors},null,2));
}
console.log(passes.length+' passed; '+failures.length+' failed');
if(failures.length)process.exitCode=1;
