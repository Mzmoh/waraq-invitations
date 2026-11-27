// Paired lab comparison. Run the two worktrees sequentially on the same machine.
import {chromium} from 'playwright';
import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
const baseline=process.argv.includes('--baseline'),root=resolve(baseline?'.local/quality-baseline':'.');
const {createApp}=await import(pathToFileURL(resolve(root,'server/index.mjs')));
const {server}=await createApp({database:':memory:',publicDir:resolve(root,'public')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'chrome',args:['--enable-unsafe-swiftshader']}),samples=[];
try{
 for(let i=0;i<5;i++){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
  await context.addInitScript(()=>{window.vitals={lcp:0,cls:0,gaps:[]};let last;new PerformanceObserver(l=>l.getEntries().forEach(e=>window.vitals.lcp=e.startTime)).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(l=>l.getEntries().forEach(e=>{if(!e.hadRecentInput)window.vitals.cls+=e.value;})).observe({type:'layout-shift',buffered:true});function frame(t){if(last)window.vitals.gaps.push(t-last);last=t;requestAnimationFrame(frame);}requestAnimationFrame(frame);});
  const page=await context.newPage(),cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1.6*1024*1024/8,uploadThroughput:.75*1024*1024/8});
  await page.goto(base);await page.locator('.occasion-tile').first().waitFor();await page.waitForTimeout(3000);
  samples.push(await page.evaluate(()=>{const gaps=window.vitals.gaps.sort((a,b)=>a-b);return {lcp:window.vitals.lcp,cls:window.vitals.cls,frameGapP95:gaps[Math.floor(gaps.length*.95)],frameGapMax:Math.max(...gaps),bytes:performance.getEntriesByType('resource').reduce((sum,r)=>sum+r.transferSize,0),scene:document.querySelector('.glass-stage')?.glassController?.inspect()};}));await context.close();
 }
 await mkdir('test-results/cinematic-final',{recursive:true});await writeFile('test-results/cinematic-final/'+(baseline?'before':'after')+'-performance.json',JSON.stringify({commit:baseline?'bac0f12':'working candidate',browser:browser.version(),conditions:'Chrome desktop; loopback SQLite; 390x844 DPR2; cache disabled; CPU 4x; 150ms latency; 1.6/.75Mbps; five fresh contexts, 3 seconds after catalog; software WebGL allowed; RAF gaps are not field INP',samples},null,2));console.log('Captured',baseline?'baseline':'candidate',samples.map(r=>({lcp:r.lcp,cls:r.cls})));
}finally{await browser.close();await new Promise(r=>server.close(r));}
