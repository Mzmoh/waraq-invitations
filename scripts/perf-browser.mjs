import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {cpus,platform,release} from 'node:os';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readFileSync} from 'node:fs';
const appRoot=process.env.PERF_APP_ROOT||process.cwd();const {createApp}=await import(pathToFileURL(resolve(appRoot,'server/index.mjs')).href);
const phase=process.argv[2]||'before',out='test-results/performance';await mkdir(out,{recursive:true});
if(phase==='before'&&execFileSync('git',['hash-object',resolve(appRoot,'public/main.js')],{encoding:'utf8'}).trim()!==readFileSync(new URL('../benchmarks/baseline/main.sha',import.meta.url),'utf8').trim())throw Error('Before measurement requires the baseline b10f352 application checkout; refusing a mislabeled result.');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const {server}=await createApp({database:':memory:'});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'chrome',args:['--enable-unsafe-swiftshader']});
const runs=[];const profile={latency:150*3.75,downloadThroughput:1.6e6/8*.9,uploadThroughput:750000/8*.9,connectionType:'cellular4g',offline:false};
try{
 for(const path of ['/','/occasions'])for(let repeat=0;repeat<3;repeat++){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,locale:'ar-IQ'});const page=await context.newPage(),cdp=await context.newCDPSession(page);const errors=[],network=[];
  page.on('pageerror',e=>errors.push(e.message));await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Network.emulateNetworkConditions',profile);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  cdp.on('Network.loadingFinished',e=>network.push({requestId:e.requestId,encodedBytes:e.encodedDataLength}));
  await page.addInitScript(()=>{
   window.perfAudit={lcp:null,lcpElement:null,shifts:[],events:[],longTasks:[],frames:[]};const data=window.perfAudit;
   new PerformanceObserver(list=>{for(const e of list.getEntries()){data.lcp=e.startTime;data.lcpElement=e.element?.outerHTML.slice(0,240)||null;}}).observe({type:'largest-contentful-paint',buffered:true});
   new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)data.shifts.push({time:e.startTime,value:e.value,sources:e.sources?.map(s=>({node:s.node?.outerHTML?.slice(0,180),previous:s.previousRect,current:s.currentRect}))});}).observe({type:'layout-shift',buffered:true});
   new PerformanceObserver(list=>{for(const e of list.getEntries())if(e.interactionId)data.events.push({id:e.interactionId,type:e.name,duration:e.duration,inputDelay:e.processingStart-e.startTime,processing:e.processingEnd-e.processingStart});}).observe({type:'event',buffered:true,durationThreshold:16});
   new PerformanceObserver(list=>{data.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})));}).observe({type:'longtask',buffered:true});
   let last;function frame(t){if(last)data.frames.push({time:t,delta:t-last});last=t;if(t<20000)requestAnimationFrame(frame);}requestAnimationFrame(frame);
  });
  try{
   await page.goto(base+path,{waitUntil:'load',timeout:60000});await page.waitForFunction(()=>document.querySelector('#app')?.getAttribute('aria-busy')==='false',{timeout:60000});
   await page.waitForTimeout(4500);
   if(path==='/'){await page.locator('.glass-config summary').click();await page.locator('[data-glass-pause]').click();await page.locator('[data-glass-pause]').click();}
   else{const input=page.locator('[name=query]');await input.click();await input.pressSequentially('gold',{delay:80});await input.press('Control+A');await input.press('Backspace');await page.locator('[name=category]').selectOption('wedding');await page.locator('[name=category]').selectOption('');}
   await page.waitForTimeout(600);
   const measured=await page.evaluate(()=>{
    const d=window.perfAudit,n=performance.getEntriesByType('navigation')[0],resources=performance.getEntriesByType('resource').map(r=>({name:new URL(r.name).pathname,type:r.initiatorType,transferBytes:r.transferSize,encodedBytes:r.encodedBodySize,decodedBytes:r.decodedBodySize,duration:r.duration}));
    let cls=0,sum=0,start=0,last=0;for(const shift of d.shifts){if(shift.time-last>1000||shift.time-start>5000){start=shift.time;sum=0;}sum+=shift.value;cls=Math.max(cls,sum);last=shift.time;}
    const times=Object.values(d.events.reduce((a,e)=>(a[e.id]=Math.max(a[e.id]||0,e.duration),a),{})).sort((a,b)=>b-a);
    return {...d,cls,labInpMs:times.length?times[Math.floor(times.length/50)]:null,interactionsObserved:times.length,ttfbMs:n.responseStart-n.requestStart,navigationTtfbMs:n.responseStart,resources,transferBytes:n.transferSize+resources.reduce((n,r)=>n+r.transferBytes,0),ua:navigator.userAgent,cores:navigator.hardwareConcurrency,memoryGiB:navigator.deviceMemory,renderer:document.querySelector('.glass-stage')?.dataset.renderer||null};
   });
   runs.push({path,repeat,...measured,network,errors});console.log(JSON.stringify({phase,path,repeat,lcp:measured.lcp,cls:measured.cls,labInp:measured.labInpMs,ttfb:measured.ttfbMs,bytes:measured.transferBytes}));
   if(repeat===0)await page.screenshot({path:out+'/'+phase+(path==='/'?'-home':'-gallery')+'.png'});
  }catch(error){runs.push({path,repeat,failed:error.message,errors});console.log('MEASUREMENT_FAILED',path,error.message);}
  await context.close();await writeFile(out+'/browser-'+phase+'.json',JSON.stringify({phase,profile,cpuSlowdown:4,viewport:{width:390,height:844},cache:'cold; fresh context and cache disabled',chrome:browser.version(),host:{platform:platform(),release:release(),cpu:cpus()[0]?.model},runs,limitations:'Local loopback Node/SQLite, CDP Slow 4G preset and 4x CPU; software WebGL. INP is a controlled lab interaction sample, not CrUX or field p75. Frame gaps are rAF observations, not guaranteed compositor FPS.'},null,2));
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
