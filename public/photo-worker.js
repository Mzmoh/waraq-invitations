import {encodePhoto} from './photo-encode.js';
self.onmessage=async({data:{file}})=>{
 let image;
 try{
  image=await createImageBitmap(file);
  const photo=await encodePhoto(image,(w,h)=>new OffscreenCanvas(w,h),(canvas,type)=>canvas.convertToBlob({type,quality:.82}),blob=>new FileReaderSync().readAsDataURL(blob));
  self.postMessage({photo});
 }catch(error){self.postMessage({error:error.message==='PHOTO_DIMENSIONS'?'PHOTO_DIMENSIONS':'PHOTO_ENCODING'});}
 finally{image?.close();}
};
