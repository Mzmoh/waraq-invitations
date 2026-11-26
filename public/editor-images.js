const allowed=new Set(['image/jpeg','image/png','image/webp','image/avif']);
export async function preparePhoto(file,t){
 if(!allowed.has(file.type)||file.size>12*1024*1024)throw Error(t('اختر صورة أصغر من 12 ميغابايت.','Choose a JPG, PNG, WebP or AVIF under 12 MB.'));
 const url=URL.createObjectURL(file);
 try{
  const image=new Image();image.src=url;await image.decode();
  if(image.naturalWidth*image.naturalHeight>48000000)throw Error(t('الصورة كبيرة جدًا.','Choose an image smaller than 48 megapixels.'));
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  const encode=async(side,budget)=>{let src;
   do{const ratio=Math.min(1,side/Math.max(image.naturalWidth,image.naturalHeight));canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const blob=type=>new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('Photo encoding failed')),type,.82));
    const[jpg,webp]=await Promise.all([blob('image/jpeg'),blob('image/webp')]);const chosen=webp.type==='image/webp'&&webp.size<jpg.size?webp:jpg;src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(chosen);});side*=.78;
   }while(src.length>budget&&side>96);return {src,width:canvas.width};
  };
  const main=await encode(1400,320000),variants=[];
  for(const side of [480]){if(side>=Math.max(image.naturalWidth,image.naturalHeight))continue;const v=await encode(side,80000);if(v.width<main.width&&!variants.some(x=>x.width===v.width))variants.push(v);}
  return {...main,variants,alt:'',x:50,y:50,zoom:1};
 }finally{URL.revokeObjectURL(url);}
}
