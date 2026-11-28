import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createApp} from '../server/index.mjs';
const hosted=process.env.WARAQ_PREVIEW_URL;
if(hosted)assert.equal(hosted,'https://waraq-cinematic-pr5-preview-moh7store.vercel.app');
let server,base=hosted;
if(!base){({server}=await createApp({database:':memory:'}));await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;}
const browser=await chromium.launch({channel:'chrome'});
try{
 const c=await browser.newContext({viewport:{width:390,height:844}});
 await c.addInitScript(()=>{window.emptyPreviewStates=[];new MutationObserver(()=>{const d=document.querySelector('.preview-device');if(d&&!d.childElementCount)window.emptyPreviewStates.push(performance.now());}).observe(document,{childList:true,subtree:true});});
 const p=await c.newPage();let delayed=false;
 await p.route('**/invitation.js',async route=>{delayed=true;await new Promise(r=>setTimeout(r,900));await route.continue();});
 await p.goto(base+'/occasions/wedding');await p.locator('.template-tile').nth(4).locator('a').click();await p.locator('#preview-ready').waitFor();await p.waitForTimeout(400);
 assert.ok(delayed,'renderer request was delayed');assert.deepEqual(await p.evaluate(()=>window.emptyPreviewStates),[],'cover stays mounted until renderer is ready');
 await c.close();console.log('PASS cold renderer delayed 900ms: no empty preview device');
}finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
