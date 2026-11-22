import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {createApp} from '../server/index.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {server}=await createApp({database:':memory:'});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const baseURL='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'chrome'}),context=await browser.newContext({baseURL,viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage();
const errors=[],passes=[];page.on('pageerror',e=>errors.push(e.message));
await context.addInitScript(()=>localStorage.setItem('waraq-language','en'));
const evidence=process.env.QA_EVIDENCE_DIR||'test-results/finishing';await mkdir(evidence,{recursive:true});
async function check(name,fn){await fn();passes.push(name);console.log('PASS '+name)}
try{
 await check('Search all categories and FAQ are usable',async()=>{
   await page.goto('/');await page.getByText('Frequently asked questions',{exact:true}).waitFor();await page.goto('/occasions');
   await page.locator('[name=query]').fill('Wax Seal');assert.equal(await page.locator('#app .template-tile').count(),1);
 });
 await context.request.post('/api/auth/register',{data:{email:'finish@test.test',password:'test-finishing-password'}});
 let invitation;
 await check('Create persisted custom typography, rotation, main image, background and original audio',async()=>{
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=64;c.height=64;c.getContext('2d').fillRect(0,0,64,64);return c.toDataURL()});
  const response=await context.request.post('/api/invitations',{data:{templateId:'royal-navy-wax-seal',data:{title:'احتفال زفاف محمد ونور مع العائلة والأصدقاء والأحبة',groom:'محمد الزيني',bride:'نور',startAt:'2035-10-21T15:34:37Z',language:'ar',timeZone:'Asia/Baghdad',sections:['venue','countdown','gallery','rsvp'],place:'قاعة الورود',appearance:{typeface:'arabic',titleSize:40,bodySize:18,weight:600,lineHeight:1.8,align:'center',titleColor:'#531c36',textColor:'#302622'},audio:{track:'serenity',volume:.2,loop:true},images:[{src:png,rotation:90,primary:true},{src:png,role:'background'}]},settings:{privacy:'unlisted',rsvpEnabled:true,maxGuests:4}}});
  assert.equal(response.status(),200);invitation=(await response.json()).invitation;assert.equal(invitation.data.images[0].rotation,90);
  await page.goto('/create/'+invitation.templateId+'?id='+invitation.id);await page.locator('.ed-steps button').nth(2).click();
  assert.equal(await page.locator('[name=titleSize]').inputValue(),'40');assert.equal(await page.locator('[name=track]').inputValue(),'serenity');assert.equal(await page.locator('[name=rotation]').first().inputValue(),'90');
  await page.screenshot({path:evidence+'/custom-editor.png',fullPage:true});
 });
 await check('Undo and redo restore actual wording',async()=>{
  await page.locator('.ed-steps button').first().click();const original=await page.locator('[name=title]').inputValue();
  await page.locator('[name=title]').fill('Changed wording');await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal(await page.locator('[name=title]').inputValue(),original);
  await page.getByRole('button',{name:'Redo',exact:true}).click();assert.equal(await page.locator('[name=title]').inputValue(),'Changed wording');
  await page.getByRole('button',{name:'Undo',exact:true}).click();
 });
 await check('Published guest replay, explicit audio playback, volume and narrow layout',async()=>{
  assert.equal((await context.request.post('/api/invitations/'+invitation.id+'/publish',{data:{}})).status(),200);
  await page.goto('/i/'+invitation.slug);await page.locator('[data-open]').last().click();await page.locator('.inv-body').waitFor();
  await page.getByRole('button',{name:'تشغيل الصوت',exact:true}).click();await page.getByRole('button',{name:'إيقاف الصوت',exact:true}).waitFor();
  await page.locator('.inv-audio input').fill('0.35');await page.getByRole('button',{name:'إيقاف الصوت',exact:true}).click();
  for(const width of [360,390,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  await page.setViewportSize({width:390,height:900});await page.screenshot({path:evidence+'/custom-guest.png',fullPage:true});
  await page.getByRole('button',{name:'إعادة عرض المقدمة',exact:true}).click();assert.ok(await page.locator('.inv-body').isHidden());await page.locator('[data-skip]').click();await page.locator('.inv-body').waitFor();
 });
 await check('Owner copy, CSV export and confirmed deletion controls work',async()=>{
  await page.goto('/dashboard/invitations/'+invitation.id);await page.getByRole('button',{name:'Duplicate invitation',exact:true}).click();await page.waitForURL('**/create/**');
  const copied=new URL(page.url()).searchParams.get('id');assert.notEqual(copied,invitation.id);
  await page.goto('/dashboard/invitations/'+copied);page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Delete permanently',exact:true}).click();await page.waitForURL('**/dashboard');
  assert.equal((await context.request.get('/api/invitations/'+copied)).status(),404);
  assert.equal((await context.request.get('/api/invitations/'+invitation.id+'/responses.csv')).status(),200);
 });
 await check('Missing mail delivery produces a visible actionable recovery error',async()=>{
  await page.goto('/auth?mode=forgot');await page.locator('input[type=email]').fill('finish@test.test');await page.locator('button[type=submit]').click();await page.getByText('Email delivery is not configured. Contact the site administrator.',{exact:true}).waitFor();
 });
 await check('Celebratory scene respects a live reduced-motion change',async()=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('/templates/graduation-cap-toss');
  await page.locator('[data-open]').last().click();await page.locator('.inv-confetti').waitFor();
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('.inv-card').classList.contains('inv-paused'));
  await page.locator('.inv-confetti').waitFor({state:'detached'});
 });
 assert.deepEqual(errors,[]);console.log(passes.length+' finishing journeys passed; 0 uncaught errors');
}finally{await writeFile(evidence+'/results.json',JSON.stringify({passes,errors},null,2));await browser.close();await new Promise(ok=>{server.close(ok);server.closeAllConnections()})}
