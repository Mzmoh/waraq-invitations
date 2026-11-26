import {encodePhoto} from './photo-encode.js';
const allowed=new Set(['image/jpeg','image/png','image/webp','image/avif']);
async function inWorker(file){
 if(typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined'||typeof createImageBitmap==='undefined')return null;
 return new Promise((resolve,reject)=>{
  let worker,timer;
  const finish=(value,error)=>{clearTimeout(timer);worker?.terminate();error?reject(error):resolve(value);};
  try{
   worker=new Worker(new URL('./photo-worker.js',import.meta.url),{type:'module'});
   timer=setTimeout(()=>finish(null,Error('PHOTO_TIMEOUT')),45000);
   worker.onmessage=({data})=>data.error==='PHOTO_DIMENSIONS'?finish(null,Error(data.error)):finish(data.photo||null);
   worker.onerror=event=>{event.preventDefault();finish(null);};
   worker.onmessageerror=()=>finish(null);
   worker.postMessage({file});
  }catch{finish(null);}
 });
}
export async function preparePhoto(file,t){
 if(!allowed.has(file.type)||file.size>12*1024*1024)throw Error(t('اختر صورة JPG أو PNG أو WebP أو AVIF أصغر من 12 ميغابايت.','Choose a JPG, PNG, WebP or AVIF under 12 MB.'));
 let url;
 try{
  const photo=await inWorker(file);if(photo)return photo;
  url=URL.createObjectURL(file);const image=new Image();image.src=url;await image.decode();
  return await encodePhoto(image,(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h}),
   (canvas,type)=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('PHOTO_ENCODING')),type,.82)),
   blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('PHOTO_ENCODING'));reader.readAsDataURL(blob);}));
 }catch(error){
  if(error.message==='PHOTO_DIMENSIONS')throw Error(t('اختر صورة أصغر من 48 ميغابكسل.','Choose an image smaller than 48 megapixels.'));
  if(error.message==='PHOTO_TIMEOUT')throw Error(t('استغرقت معالجة الصورة وقتًا طويلًا. جرّب صورة أصغر.','Photo processing timed out. Try a smaller image.'));
  throw Error(t('تعذرت معالجة الصورة. جرّب صورة أخرى.','Unable to process this image. Try another photo.'));
 }finally{if(url)URL.revokeObjectURL(url);}
}
