import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {createApp} from '../server/index.mjs';
const phase=process.argv[2]||'before';await mkdir('test-results/performance',{recursive:true});
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');const {server}=await createApp({database:':memory:'});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome'});
try{const context=await browser.newContext({bypassCSP:true});const page=await context.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/robots.txt');const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 const source=phase==='before'?readFileSync(new URL('../benchmarks/baseline/editor-images.js',import.meta.url),'utf8'):readFileSync('public/editor-images.js','utf8');const moduleURL='data:text/javascript;base64,'+Buffer.from(source).toString('base64');
 const samples=await page.evaluate(async moduleURL=>{const {preparePhoto}=await import(moduleURL),blob=await(await fetch('/media/wax-stationery.webp')).blob(),file=new File([blob],'fixture.webp',{type:'image/webp'});const longTasks=[];new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});const samples=[];for(let i=0;i<3;i++){const start=performance.now(),image=await preparePhoto(file,(_ar,en)=>en);const end=performance.now();await new Promise(r=>setTimeout(r,50));samples.push({encodeMs:end-start,longTasks:longTasks.filter(t=>t.start>=start&&t.start<=end),mime:image.src.slice(5,image.src.indexOf(';')),mainBytes:atob(image.src.split(',')[1]).length,variants:(image.variants||[]).map(v=>({width:v.width,bytes:atob(v.src.split(',')[1]).length})),jsonCharacters:JSON.stringify(image).length});}return samples;},moduleURL);
 await writeFile('test-results/performance/images-'+phase+'.json',JSON.stringify({phase,fixture:'Existing 1400×933 public wax-stationery.webp, 187102 bytes',cpu:4,chrome:browser.version(),samples},null,2));console.log(samples);
}finally{await browser.close();await new Promise(r=>server.close(r));}
