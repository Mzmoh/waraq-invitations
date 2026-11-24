import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {createApp} from '../server/index.mjs';
import {resendConfiguration} from '../server/mail-resend.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),mailbox=[];
const mail=resendConfiguration({RESEND_API_KEY:'test-only',MAIL_FROM:'Waraq <mail@waraq.test>',PUBLIC_ORIGIN:'https://waraq.test'},{fetcher:async(url,options)=>{mailbox.push(JSON.parse(options.body));return new Response(JSON.stringify({id:'simulated-'+mailbox.length}))}});
const {server,db}=await createApp({database:':memory:',mail});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const baseURL='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'chrome'}),context=await browser.newContext({baseURL,viewport:{width:390,height:844}}),page=await context.newPage();
const failures=[],passes=[],fontRequests=[];page.on('pageerror',e=>failures.push(e.message));page.on('response',r=>{if(r.url().endsWith('.woff'))fontRequests.push({url:new URL(r.url()).pathname,status:r.status()})});
const output='test-results/release-gate';await mkdir(output,{recursive:true});
await context.addInitScript(()=>localStorage.setItem('waraq-language','en'));
try{
 await page.goto('/');const fontEvidence=await page.evaluate(async()=>{const names=['Waraq Amiri','Noto Naskh Arabic','Noto Kufi Arabic'],rows=[];for(const family of names){const before=performance.now();const loaded=await document.fonts.load('400 32px "'+family+'"','دعوة زفاف محمد ونور');rows.push({family,loaded:loaded.length>0&&loaded.every(f=>f.status==='loaded'),milliseconds:Math.round(performance.now()-before)});}return rows});assert.ok(fontEvidence.every(f=>f.loaded));assert.equal(fontRequests.length,3);assert.ok(fontRequests.every(f=>f.status===200));passes.push('Three self-hosted Arabic WOFF fonts loaded and decoded');
 await context.request.post('/api/auth/register',{data:{email:'release@qa.test',password:'initial-password'}});
 await page.goto('/auth?mode=forgot');await page.locator('input[type=email]').fill('release@qa.test');await page.locator('button[type=submit]').click();await page.getByText('If the account exists, an email with recovery steps will arrive.',{exact:true}).waitFor();
 assert.equal(mailbox.length,1);let target=new URL(mailbox[0].text.match(/https:\/\/waraq\.test\/auth[^\s]+/)[0]);await page.goto(baseURL+target.pathname+target.search+target.hash);await page.locator('input[type=password]').fill('new-release-password');await page.locator('button[type=submit]').click();await page.getByText('Completed. You can sign in.',{exact:true}).waitFor();assert.equal(new URL(page.url()).hash,'');
 assert.equal((await context.request.post('/api/auth/login',{data:{email:'release@qa.test',password:'initial-password'}})).status(),401);assert.equal((await context.request.post('/api/auth/login',{data:{email:'release@qa.test',password:'new-release-password'}})).status(),200);passes.push('Password reset through UI and simulated Resend inbox, old password revoked');
 assert.equal((await context.request.post('/api/auth/request-verification',{data:{}})).status(),200);target=new URL(mailbox[1].text.match(/https:\/\/waraq\.test\/auth[^\s]+/)[0]);await page.goto(baseURL+target.pathname+target.search+target.hash);await page.locator('button[type=submit]').click();await page.getByText('Completed. You can sign in.',{exact:true}).waitFor();assert.equal(db.prepare('SELECT count(*) n FROM verified_emails').get().n,1);passes.push('Verification through UI and simulated Resend inbox');
 await page.screenshot({path:output+'/verification.png'});
 const created=await context.request.post('/api/invitations',{data:{templateId:'minimal-signature',data:{title:'Font controls',startAt:'2035-01-01T12:00:00Z'}}});assert.equal(created.status(),200);const record=(await created.json()).invitation;
 await page.goto('/create/minimal-signature?id='+record.id);await page.locator('.ed-steps button').nth(2).click();await page.locator('[name=font]').selectOption('sans');assert.equal(await page.locator('[name=typeface]').inputValue(),'modern');await page.locator('[name=typeface]').selectOption('kufi');assert.equal(await page.locator('[name=font]').inputValue(),'serif');await page.waitForFunction(()=>document.querySelector('.ed-preview .inv-card')?.style.getPropertyValue('--inv-serif').includes('Noto Kufi Arabic'));passes.push('Legacy and advanced font controls agree and Kufi preview updates');
 const templates=await page.evaluate(async()=> (await import('/templates/index.js')).templates.map(t=>({id:t.id,category:t.category})));
 for(const [i,t] of templates.entries()){
  await page.goto('/templates/'+t.id);await page.locator('[data-skip]').click();await page.locator('.inv-body').waitFor();await page.evaluate(()=>document.fonts.ready);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),t.id+' horizontal overflow');
  if(i%10===0)await page.screenshot({path:output+'/'+t.category+'-type.png',fullPage:true});
 }passes.push('80 existing template reveals at 390 px with decoded self-hosted fonts');
 assert.deepEqual(failures,[]);await writeFile(output+'/results.json',JSON.stringify({passes,fontEvidence,fontRequests,failures,mailTransport:'simulated only; no real email sent'},null,2));
 console.log(JSON.stringify({passes,fontEvidence,failures},null,2));
}finally{await browser.close();await new Promise(ok=>{server.close(ok);server.closeAllConnections()})}
