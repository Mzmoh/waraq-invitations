import {Buffer} from 'node:buffer';

export class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code }
}
export function fail(status, code, message) { throw new HttpError(status, code, message) }
export function invalid(message = 'تحقق من الحقول المدخلة.') { fail(400, 'INVALID_INPUT', message) }
export const plain = obj => !!obj && typeof obj === 'object' && !Array.isArray(obj)
export function str(input, max, min = 0) {
  if (typeof input !== 'string' || input.length > max || input.trim().length < min) invalid()
  return input.trim()
}
export function integer(value, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) invalid()
  return value
}
export function raster(dataUrl) {
  if (typeof dataUrl !== 'string' || dataUrl.length > 1_400_000) invalid('حجم الصورة يتجاوز الحد المسموح.')
  const match = /^data:image\/(webp|png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl)
  if (!match) invalid('صيغة الصورة غير مدعومة.')
  const bytes = Buffer.from(match[2], 'base64')
  let width, height
  if (match[1] === 'png' && bytes.length >= 33 && bytes.subarray(0,8).toString('hex') === '89504e470d0a1a0a' && bytes.toString('ascii',12,16) === 'IHDR') {
    let at=8,hasPixels=false,ended=false;
    while(at+12<=bytes.length){
      const size=bytes.readUInt32BE(at),type=bytes.toString('ascii',at+4,at+8);
      if(size>bytes.length-at-12)invalid('Truncated PNG.');
      if(at===8 && (type!=='IHDR'||size!==13))invalid('Invalid PNG header.');
      if(type==='IDAT'&&size>0)hasPixels=true;
      at+=size+12;
      if(type==='IEND'){if(size!==0||at!==bytes.length)invalid('Invalid PNG ending.');ended=true;break;}
    }
    if(!hasPixels||!ended)invalid('Incomplete PNG file.');
    width = bytes.readUInt32BE(16); height = bytes.readUInt32BE(20)
  } else if (match[1] === 'jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes.at(-2) === 255 && bytes.at(-1) === 217) {
    let i = 2
    while (i + 9 < bytes.length && bytes[i] === 255) {
      const kind = bytes[i+1], length = bytes.readUInt16BE(i+2)
      if (length < 2 || i + length + 2 > bytes.length) break
      if ([192,193,194].includes(kind)) { width = bytes.readUInt16BE(i+7); height = bytes.readUInt16BE(i+5); break }
      i += length + 2
    }
  } else if (match[1] === 'webp' && bytes.length >= 30 && bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP') {
    const block = bytes.toString('ascii',12,16)
    if (block === 'VP8X') {
      width = 1 + bytes.readUIntLE(24,3); height = 1 + bytes.readUIntLE(27,3)
    } else if (block === 'VP8 ') {
      width = bytes.readUInt16LE(26) & 16383; height = bytes.readUInt16LE(28) & 16383
    } else if (block === 'VP8L' && bytes[20] === 47) {
      const bits = bytes.readUInt32LE(21); width = 1 + (bits & 16383); height = 1 + ((bits >>> 14) & 16383)
    }
  }
  if (!(width > 0 && height > 0 && width * height <= 24e6)) invalid('تعذّرت قراءة صورة صالحة بهذا الحجم.')
  return {bytes, mime:'image/'+match[1]}
}
const shortText = ['title','hosts','place','address','startedMessage','bride','groom','receptionTime','babyName','parents','birthDate','graduate','institution','department','cohort','pilgrim','gatheringType','occasion','font','language','phone']
function link(v, maps=false) {
  if (v === '') return ''
  let u
  try { u = new URL(str(v,2000,1)) } catch { invalid('الرابط غير صالح.') }
  if (u.protocol !== 'https:' || u.username || u.password) invalid('أدخل رابط HTTPS صالحًا.')
  if (maps && !/^(maps\.app\.goo\.gl|goo\.gl|(?:www\.|maps\.)?google\.(?:com|iq|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2}))$/i.test(u.hostname)) invalid('أدخل رابط خرائط Google.')
  return u.href
}
export function validateData(input, publish = false) {
  if (!plain(input)) invalid()
  const data = {}
  for (const k of shortText) if (k in input) data[k] = str(input[k], k === 'address' ? 1200 : 320)
  if ('message' in input) data.message = str(input.message,5000)
  for (const k of ['showHijri','showCountdown']) if (k in input) {
    if (typeof input[k] !== 'boolean') invalid()
    data[k] = input[k]
  }
  if (input.startAt) {
    const utc = str(input.startAt,60)
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(utc) || !Number.isFinite(Date.parse(utc))) invalid('وقت البداية غير صالح.')
    data.startAt = new Date(utc).toISOString()
    if (data.startAt.slice(0,19)!==utc.slice(0,19)) invalid('Invalid calendar date.')
  }
  data.timeZone = str(input.timeZone || 'Asia/Baghdad',80,1)
  try { new Intl.DateTimeFormat('en',{timeZone:data.timeZone}) } catch { invalid('المنطقة الزمنية غير صالحة.') }
  if (publish && (!data.title || !data.startAt)) invalid('حدد عنوان الدعوة وتاريخ بدايتها قبل النشر.')
  for (const k of ['mapsUrl','rsvpUrl']) if (k in input) data[k] = link(input[k], k === 'mapsUrl')
  if (input.accent) {
    if (!/^#[a-f\d]{3}(?:[a-f\d]{3})?$/i.test(input.accent)) invalid()
    data.accent = input.accent
  }
  for (const [key,keys,limit] of [['schedule',['time','title'],50],['customFields',['label','value'],30]]) {
    if (!(key in input)) continue
    if (!Array.isArray(input[key]) || input[key].length > limit) invalid()
    data[key] = input[key].map(item => {
      if (!plain(item)) invalid()
      return Object.fromEntries(keys.map(k => [k,str(item[k]??'',1000)]))
    })
  }
  if ('sections' in input) {
    const allowed = ['countdown','venue','schedule','gallery','rsvp']
    if (!Array.isArray(input.sections) || input.sections.length > allowed.length || input.sections.some(s=>!allowed.includes(s))) invalid()
    data.sections = [...new Set(input.sections)]
  }
  if ('images' in input) {
    if (!Array.isArray(input.images) || input.images.length > 4) invalid()
    data.images = input.images.map(im => {
      if (!plain(im) || typeof im.src !== 'string') invalid()
      if (!/^\/api\/assets\/[a-f0-9-]{36}$/.test(im.src)) raster(im.src)
      const image = {src:im.src,alt:str(im.alt??'',320)}
      if(im.role!==undefined) {if(!['photo','background'].includes(im.role))invalid();image.role=im.role}
      if(im.primary!==undefined) {if(typeof im.primary!=='boolean')invalid();image.primary=im.primary}
      for (const [k,min,max,fallback] of [['x',0,100,50],['y',0,100,50],['zoom',1,5,1],['rotation',-180,180,0]]) {
        const v = im[k] ?? fallback
        if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) invalid()
        image[k] = v
      }
      return image
    })
  }
  if ('appearance' in input) {
    const a=input.appearance;if(!plain(a))invalid();data.appearance={};
    if(a.typeface!==undefined){if(!['classic','modern','arabic','kufi','editorial'].includes(a.typeface))invalid();data.appearance.typeface=a.typeface}
    if(a.align!==undefined){if(!['start','center','end'].includes(a.align))invalid();data.appearance.align=a.align}
    for(const [k,min,max] of [['titleSize',20,72],['bodySize',14,26],['weight',300,800],['lineHeight',1.2,2.5],['spacing',0,.15]])if(a[k]!==undefined){if(typeof a[k]!=='number'||!Number.isFinite(a[k])||a[k]<min||a[k]>max)invalid();data.appearance[k]=a[k]}
    for(const k of ['titleColor','textColor'])if(a[k]!==undefined){if(!/^#[a-f\d]{6}$/i.test(a[k]))invalid();data.appearance[k]=a[k]}
  }
  if('audio' in input) {
    const a=input.audio;if(!plain(a))invalid();
    if(!['silent','celebration','serenity','upload'].includes(a.track))invalid();
    if(typeof a.volume!=='number'||!Number.isFinite(a.volume)||a.volume<0||a.volume>1||typeof a.loop!=='boolean')invalid();
    data.audio={track:a.track,volume:a.volume,loop:a.loop};
    if(a.track==='upload') {
      if(a.rightsConfirmed!==true)invalid('Confirm audio usage rights.');
      const match=typeof a.src==='string' && /^data:audio\/(mpeg|wav|ogg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(a.src);
      if(!match||a.src.length>700000)invalid('Audio must be MP3, WAV or OGG up to 512 KB.');
      const b=Buffer.from(match[2],'base64');if(b.length>524288||b.length<12)invalid();
      if(!(match[1]==='wav'&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WAVE'||match[1]==='ogg'&&b.toString('ascii',0,4)==='OggS'||match[1]==='mpeg'&&(b.toString('ascii',0,3)==='ID3'||b[0]===255&&(b[1]&224)===224)))invalid('Unsupported audio header.');
      data.audio.src=a.src;data.audio.rightsConfirmed=true;
    }
  }
  return data
}
export function validateSettings(input) {
  if (!plain(input)) invalid()
  const {privacy='unlisted',rsvpEnabled=false,maxGuests=5} = input
  if (!['public','unlisted','pin'].includes(privacy) || typeof rsvpEnabled !== 'boolean') invalid()
  return {privacy,rsvpEnabled,maxGuests:integer(maxGuests,1,100)}
}

