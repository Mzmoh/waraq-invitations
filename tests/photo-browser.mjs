import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {createApp} from '../server/index.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const {server}=await createApp({database:':memory:'});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome'}),baseURL='http://127.0.0.1:'+server.address().port,results=[];
async function run(name,setup,work){const c=await browser.newContext({baseURL}),p=await c.newPage(),workers=[],errors=[];p.on('worker',w=>workers.push(w.url()));p.on('pageerror',e=>errors.push(e.message));try{await setup?.(p,c);await p.goto('/robots.txt');await work(p,workers);assert.deepEqual(errors,[]);results.push({name,passed:true});console.log('PASS '+name);}finally{await c.close();}}
try{
 await run('real same-origin Worker encodes private-ready responsive images under CSP',null,async(p,workers)=>{
  const actual=await p.evaluate(async()=>{const{preparePhoto}=await import('/editor-images.js');const file=new File([await(await fetch('/media/wax-stationery.webp')).blob()],'fixture.webp',{type:'image/webp'}),photo=await preparePhoto(file,(_a,en)=>en);const decoded=await Promise.all([photo,...photo.variants].map(async item=>{const image=new Image();image.src=item.src;await image.decode();return{width:image.naturalWidth,height:image.naturalHeight,declared:item.width,mime:item.src.slice(0,22)}}));return{decoded,mainBudget:photo.src.length<=320000,variantBudget:photo.variants.every(v=>v.src.length<=80000),x:photo.x,zoom:photo.zoom};});
  assert.equal(workers.length,1);assert.ok(workers[0].endsWith('/photo-worker.js'));assert.deepEqual(actual.decoded.map(x=>x.width),[1400,480]);assert.ok(actual.decoded.every(x=>x.width===x.declared&&x.mime.startsWith('data:image/webp')));assert.ok(actual.mainBudget&&actual.variantBudget);assert.equal(actual.x,50);assert.equal(actual.zoom,1);
 });
 for(const mode of ['worker','no-worker','worker-load-failure'])await run('transparent PNG preserves orientation, white matte and editable defaults: '+mode,async p=>{
  if(mode==='no-worker')await p.addInitScript(()=>Object.defineProperty(window,'Worker',{value:undefined}));
  if(mode==='worker-load-failure')await p.route('**/photo-worker.js',route=>route.abort('failed'));
 },async p=>{
  const result=await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=96;c.height=64;const ctx=c.getContext('2d');ctx.fillStyle='#d02030';ctx.fillRect(48,0,48,64);const blob=await new Promise(r=>c.toBlob(r,'image/png'));const{preparePhoto}=await import('/editor-images.js'),photo=await preparePhoto(new File([blob],'transparent.png',{type:'image/png'}),(_a,en)=>en);const image=new Image();image.src=photo.src;await image.decode();ctx.clearRect(0,0,96,64);ctx.drawImage(image,0,0);return{size:[image.naturalWidth,image.naturalHeight],white:[...ctx.getImageData(10,30,1,1).data],red:[...ctx.getImageData(80,30,1,1).data],variants:photo.variants.length,defaults:[photo.x,photo.y,photo.zoom]};});
  assert.deepEqual(result.size,[96,64]);assert.ok(result.white.slice(0,3).every(v=>v>240));assert.equal(result.white[3],255);assert.ok(result.red[0]>180&&result.red[1]<65&&result.red[2]<80);assert.equal(result.variants,0);assert.deepEqual(result.defaults,[50,50,1]);
 });
 await run('JPEG fallback works when WebP encoding is unavailable',p=>p.addInitScript(()=>{Object.defineProperty(window,'Worker',{value:undefined});const original=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(callback,type,q){return original.call(this,callback,type==='image/webp'?'image/jpeg':type,q);};}),async p=>{
  assert.equal(await p.evaluate(async()=>{const{preparePhoto}=await import('/editor-images.js');const file=new File([await(await fetch('/media/wax-stationery.webp')).blob()],'fixture.webp',{type:'image/webp'});return(await preparePhoto(file,(_a,en)=>en)).src.startsWith('data:image/jpeg;');}),true);
 });
 await run('invalid files, limits and failed decode surface errors without stale object URLs',null,async(p,workers)=>{
  const result=await p.evaluate(async()=>{const{preparePhoto}=await import('/editor-images.js'),messages=[];let opened=0,closed=0;const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=(...args)=>{opened++;return create(...args)};URL.revokeObjectURL=(...args)=>{closed++;return revoke(...args)};for(const file of [new File(['x'],'bad.svg',{type:'image/svg+xml'}),new File([new Uint8Array(12*1024*1024+1)],'large.jpg',{type:'image/jpeg'}),new File(['invalid JPEG'],'bad.jpg',{type:'image/jpeg'})]){try{await preparePhoto(file,(_a,en)=>en);messages.push('unexpected success');}catch(e){messages.push(e.message);}}const{encodePhoto}=await import('/photo-encode.js');try{await encodePhoto({width:10000,height:10000});messages.push('unexpected dimensions');}catch(e){messages.push(e.message)}return{messages,opened,closed};});
  assert.equal(workers.length,1);assert.match(result.messages[0],/under 12 MB/);assert.match(result.messages[1],/under 12 MB/);assert.match(result.messages[2],/Unable to process/);assert.equal(result.messages[3],'PHOTO_DIMENSIONS');assert.equal(result.opened,result.closed);
 });
}finally{await mkdir('test-results/photo',{recursive:true});await writeFile('test-results/photo/results.json',JSON.stringify(results,null,2));await browser.close();await new Promise(r=>server.close(r));}
console.log(results.length+' photo browser groups passed');
