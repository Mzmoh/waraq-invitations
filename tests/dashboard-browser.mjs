import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {createApp} from '../server/index.mjs';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const suffix=randomUUID();
const adminEmail='owner-'+suffix+'@example.test';
const password='qa-'+suffix;
process.env.ADMIN_EMAIL=adminEmail;
process.env.ADMIN_PASSWORD=password;
const {server}=await createApp({database:':memory:'});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const baseURL='http://127.0.0.1:'+server.address().port;
let browser;
try {
  browser=await chromium.launch({channel:process.env.QA_BROWSER || 'chrome'});
  const creator=await browser.newContext({baseURL,viewport:{width:360,height:800}});
  await creator.addInitScript(()=>localStorage.setItem('waraq-language','en'));
  const page=await creator.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.setDefaultTimeout(8500);
  await page.goto('/dashboard');
  await page.locator('.db-page a[href^="/auth"]').click();
  await page.getByRole('button',{name:'Create an account',exact:true}).click();
  await page.getByLabel('Email address').fill('creator-'+suffix+'@example.test');
  await page.getByLabel('Password',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  await page.getByRole('heading',{name:'Create your first invitation'}).waitFor();

  // Seed an owner record through the same authenticated endpoints as the editor.
  const fresh=await creator.request.post('/api/invitations',{data:{
    templateId:'blush-floral-envelope',data:{title:'Dinner',startAt:'2031-10-01T16:00:17Z',timeZone:'Asia/Baghdad'},
    settings:{privacy:'pin',pin:'1457',rsvpEnabled:true,maxGuests:5}}});
  assert.ok(fresh.ok(),await fresh.text());
  const {invitation}=await fresh.json();
  const publicPath='/api/public/'+invitation.slug;
  await page.reload();
  await page.getByRole('button',{name:/Published/}).click();
  await page.getByText('No invitations with this status.').waitFor();
  await page.getByRole('button',{name:/Draft/}).click();
  await page.getByRole('link',{name:'Details and replies'}).click();
  await page.getByRole('button',{name:'Publish invitation'}).click();
  await page.getByText('PIN protected').waitFor();
  await page.getByRole('button',{name:'Show QR code'}).click();
  assert.equal(await page.locator('.db-qr svg path').count(),1);
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'Download share card'}).click();
  assert.equal((await download).suggestedFilename(),'invitation-card.png');

  const guest=await browser.newContext({baseURL});
  assert.equal((await guest.request.get(publicPath)).status(),401);
  assert.ok((await guest.request.post(publicPath+'/unlock',{data:{pin:'1457'}})).ok());
  assert.ok((await guest.request.post(publicPath+'/rsvp',{data:{name:'Guest',attending:true,count:3,comment:'Thank you'}})).ok());
  await page.reload();
  await page.getByText('Guest',{exact:true}).waitFor();
  assert.equal(await page.locator('.db-metrics strong').allTextContents().then(v=>v.join(',')),'1,3,0');
  for(const width of [360,390,430,768,1440]){
    await page.setViewportSize({width,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow at '+width+' '+JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(x=>x.getBoundingClientRect().right>innerWidth+1).map(x=>[x.tagName,x.className,Math.round(x.getBoundingClientRect().right)]).slice(0,15))));
  }
  page.on('dialog',d=>d.accept());
  await page.getByRole('button',{name:'Archive and disable link'}).click();
  await page.getByText('Inactive',{exact:true}).waitFor();
  assert.equal((await guest.request.get(publicPath)).status(),404);
  await page.getByRole('button',{name:'Publish invitation'}).click();
  await page.getByRole('link',{name:'Open guest link'}).waitFor();
  assert.equal((await guest.request.get(publicPath)).status(),200);
  await page.goto('/admin');
  await page.getByRole('heading',{name:'This page requires administrator access'}).waitFor();
  const admin=await browser.newContext({baseURL});
  const adminLogin=await admin.request.post('/api/auth/login',{data:{email:adminEmail,password}});
  assert.ok(adminLogin.ok());
  await admin.addInitScript(()=>localStorage.setItem('waraq-language','en'));
  const adminPage=await admin.newPage();
  await adminPage.goto('/admin');
  const wedding=adminPage.locator('.db-admin-row').filter({has:adminPage.getByRole('heading',{name:'Wedding',exact:true})});
  await wedding.getByRole('button',{name:'Hide',exact:true}).click();
  await wedding.getByRole('button',{name:'Show',exact:true}).waitFor();
  assert.equal((await guest.request.get(publicPath)).status(),404);
  await wedding.getByRole('button',{name:'Show',exact:true}).click();
  await wedding.getByRole('button',{name:'Hide',exact:true}).waitFor();
  assert.equal((await guest.request.get(publicPath)).status(),200);
  assert.deepEqual(errors,[]);
  console.log('PASS dashboard integration: signup and redirect, empty and filtered lists, publish, PIN, RSVP counts, QR, PNG, five widths, archive/re-publish, admin denial and visibility.');
} finally {
  if(browser) await browser.close();
  await new Promise(resolve=>server.close(resolve));
}

