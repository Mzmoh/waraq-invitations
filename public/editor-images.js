const allowed = new Set(['image/jpeg','image/png','image/webp']);
export async function preparePhoto(file, t) {
  if (!allowed.has(file.type) || file.size > 12 * 1024 * 1024)
    throw Error(t('اختر صورة JPG أو PNG أو WebP بحجم أقصاه 12 ميغابايت.','Choose a JPG, PNG or WebP under 12 MB.'));
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (image.naturalWidth * image.naturalHeight > 48000000)
      throw Error(t('أبعاد الصورة كبيرة جدًا. اختر صورة أصغر من 48 ميغابكسل.','Choose an image smaller than 48 megapixels.'));
    const canvas = document.createElement('canvas');
    let maxSide = 1400;
    let src;
    do {
      const ratio = Math.min(1,maxSide/Math.max(image.naturalWidth,image.naturalHeight));
      canvas.width = Math.max(1,Math.round(image.naturalWidth*ratio));
      canvas.height = Math.max(1,Math.round(image.naturalHeight*ratio));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(image,0,0,canvas.width,canvas.height);
      src = canvas.toDataURL('image/jpeg',.82);
      maxSide *= .78;
    } while(src.length > 500000 && maxSide > 128);
    return {src, alt:'', x:50, y:50, zoom:1};
  } finally { URL.revokeObjectURL(url); }
}

