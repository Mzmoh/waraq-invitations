// Shared raster encoder. Browser and Worker adapters own and release their surfaces.
export async function encodePhoto(image,makeCanvas,encode,toDataURL){
 if(!image.width||!image.height||image.width*image.height>48000000)throw Error('PHOTO_DIMENSIONS');
 const side=async(maximum,budget)=>{
  let size=maximum,result;
  do{
   const ratio=Math.min(1,size/Math.max(image.width,image.height));
   const canvas=makeCanvas(Math.max(1,Math.round(image.width*ratio)),Math.max(1,Math.round(image.height*ratio)));
   try{
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('PHOTO_CANVAS');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
    let blob=await encode(canvas,'image/webp');
    if(blob.type!=='image/webp')blob=await encode(canvas,'image/jpeg');
    if(!['image/webp','image/jpeg'].includes(blob.type))throw Error('PHOTO_FORMAT');
    result={src:await toDataURL(blob),width:canvas.width};
   }finally{canvas.width=1;canvas.height=1;}
   size*=.78;
  }while(result.src.length>budget&&size>96);
  if(result.src.length>budget)throw Error('PHOTO_BUDGET');
  return result;
 };
 const main=await side(1400,320000),variants=[];
 if(Math.max(image.width,image.height)>480){const small=await side(480,80000);if(small.width<main.width)variants.push(small);}
 return {...main,variants,alt:'',x:50,y:50,zoom:1};
}
