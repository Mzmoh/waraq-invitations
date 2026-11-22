import {createRequire} from 'node:module';
import {readdir,mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome'}),page=await browser.newPage({viewport:{width:480,height:800}});
const folder='test-results/reference-review';await mkdir(folder,{recursive:true});const evidence=[];
try{
 for(const file of (await readdir('references/videos')).filter(x=>x.endsWith('.mp4'))){
  await page.goto(pathToFileURL(resolve('references/videos',file)).href);
  const video=page.locator('video');await video.waitFor();
  const duration=await video.evaluate(v=>new Promise(ok=>{if(v.readyState>=1)ok(v.duration);else v.onloadedmetadata=()=>ok(v.duration)}));
  for(const seconds of [.5,duration*.35,duration*.7]){
   await video.evaluate((v,t)=>new Promise(ok=>{v.pause();v.addEventListener('seeked',ok,{once:true});v.currentTime=t}),seconds);
   const path=folder+'/'+file.replace('.mp4','')+'-'+seconds.toFixed(1)+'.png';await video.screenshot({path});evidence.push({file,seconds,path});
  }console.log('Captured reference '+file);
 }
 await writeFile(folder+'/manifest.json',JSON.stringify(evidence,null,2));
}finally{await browser.close()}
