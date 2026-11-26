// Diagnostic trace, not a comparable benchmark: tracing adds instrumentation overhead.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {createApp} from '../server/index.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const {server}=await createApp({database:':memory:'});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',args:['--enable-unsafe-swiftshader']}),context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,locale:'ar-IQ'}),page=await context.newPage(),cdp=await context.newCDPSession(page);
try{
 await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Network.emulateNetworkConditions',{latency:562.5,downloadThroughput:180000,uploadThroughput:84375,connectionType:'cellular4g',offline:false});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await page.addInitScript(()=>{window.tracedInteractions=[];new PerformanceObserver(list=>{for(const e of list.getEntries())if(e.interactionId)window.tracedInteractions.push({type:e.name,target:e.target?.outerHTML.slice(0,240),start:e.startTime,duration:e.duration,inputDelay:e.processingStart-e.startTime,processing:e.processingEnd-e.processingStart});}).observe({type:'event',durationThreshold:16,buffered:true});});
 await cdp.send('Tracing.start',{categories:'toplevel,devtools.timeline,v8,blink.user_timing,disabled-by-default-devtools.timeline,cc,gpu',transferMode:'ReturnAsStream'});
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>document.querySelector('#app')?.getAttribute('aria-busy')==='false');await page.waitForTimeout(4500);
 for(const selector of ['.glass-config summary','[data-glass-pause]','[data-glass-pause]']){await page.locator(selector).click();}
 await page.waitForTimeout(600);const complete=new Promise(r=>cdp.once('Tracing.tracingComplete',r));await cdp.send('Tracing.end');const{stream}=await complete;let source='';
 try{for(;;){const part=await cdp.send('IO.read',{handle:stream});source+=part.base64Encoded?Buffer.from(part.data,'base64').toString('utf8'):part.data;if(part.eof)break;}}finally{await cdp.send('IO.close',{handle:stream});}
 const trace=JSON.parse(source),threads=new Map(trace.traceEvents.filter(e=>e.name==='thread_name').map(e=>[e.pid+':'+e.tid,e.args.name]));
 const long=trace.traceEvents.filter(e=>e.ph==='X'&&e.dur>=50000).map(e=>({thread:threads.get(e.pid+':'+e.tid),name:e.name,ms:e.dur/1000,ts:e.ts,args:e.args})).sort((a,b)=>b.ms-a.ms).slice(0,100);
 const summary={chrome:browser.version(),profile:'Slow 4G / 4x CPU / 390x844 / fresh process; tracing overhead, diagnostic only',interactions:await page.evaluate(()=>window.tracedInteractions),long};
 await mkdir('test-results/performance',{recursive:true});await writeFile('test-results/performance/glass-trace.json',source);await writeFile('test-results/performance/glass-trace-summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
}finally{await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections()});}
