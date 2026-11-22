import QRCode from './vendor/qr/index.js';

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function icsText(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/\r\n?|\n/g, '\\n').replace(/[,;]/g, '\\$&');
}

function fold(line) {
  const encoder = new TextEncoder();
  let size = 0, result = '';
  for (const char of line) {
    const length = encoder.encode(char).length;
    if (size + length > 75) { result += '\r\n '; size = 1; }
    result += char;
    size += length;
  }
  return result;
}

export function calendarText(data, uid = 'invitation') {
  const stamp = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const rows = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Invitation Studio//Events//AR',
    'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', 'UID:' + icsText(uid) + '@invitation-studio',
    'DTSTAMP:' + stamp(new Date()), 'DTSTART:' + stamp(new Date(data.startAt)),
    'SUMMARY:' + icsText(data.title), 'DESCRIPTION:' + icsText(data.message),
    'LOCATION:' + icsText([data.place, data.address].filter(Boolean).join('، ')),
    'END:VEVENT', 'END:VCALENDAR'];
  return rows.map(fold).join('\r\n') + '\r\n';
}

export function downloadCalendar(data) {
  download(new Blob([calendarText(data, data.slug || location.pathname)], {type:'text/calendar;charset=utf-8'}), 'invitation.ics');
}

export async function shareInvitation(url, title) {
  if (navigator.share) {
    try { await navigator.share({url, title}); return 'shared'; }
    catch (error) { if (error.name === 'AbortError') return 'cancelled'; }
  }
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(url); return 'copied'; } catch {}
  }
  const field = document.createElement('textarea');
  field.value = url;
  field.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.append(field);
  field.select();
  const copied = document.execCommand('copy');
  field.remove();
  if (!copied) window.prompt(document.documentElement.lang === 'en' ? 'Copy invitation link' : 'انسخ رابط الدعوة', url);
  return copied ? 'copied' : 'manual';
}

export function qrMatrix(url) {
  const absolute = new URL(url);
  if (!['http:', 'https:'].includes(absolute.protocol)) throw new Error('Invalid invitation URL');
  const qr = new QRCode(-1, 0); // Error correction M
  qr.addData(absolute.href);
  qr.make();
  return qr.modules;
}

export function showQR(root, url) {
  const matrix = qrMatrix(url);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + (matrix.length + 8) + ' ' + (matrix.length + 8));
  svg.setAttribute('width','192');
  svg.setAttribute('height','192');
  svg.setAttribute('role','img');
  svg.setAttribute('aria-label', document.documentElement.lang === 'en' ? 'Invitation QR code' : 'رمز رابط الدعوة');
  svg.setAttribute('shape-rendering','crispEdges');
  const bg = document.createElementNS(ns,'rect');
  bg.setAttribute('width','100%'); bg.setAttribute('height','100%'); bg.setAttribute('fill','#fff');
  const path = document.createElementNS(ns, 'path');
  const commands = [];
  matrix.forEach((row,y) => row.forEach((on,x) => { if(on) commands.push('M'+(x+4)+' '+(y+4)+'h1v1h-1z'); }));
  path.setAttribute('d',commands.join('')); path.setAttribute('fill','#191818');
  svg.append(bg,path);
  root.replaceChildren(svg);
  return svg;
}

export async function downloadShareCard(data, url) {
  const canvas = document.createElement('canvas');
  canvas.width = 900; canvas.height = 1200;
  const c = canvas.getContext('2d');
  const en = data.language === 'en';
  const privateCard = data.privacy === 'pin' || data.settings?.privacy === 'pin';
  c.fillStyle = '#f8f2e8'; c.fillRect(0,0,900,1200);
  c.strokeStyle = '#9b7950'; c.lineWidth = 2;
  c.strokeRect(32,32,836,1136); c.strokeRect(44,44,812,1112);
  c.textAlign = 'center'; c.direction = en ? 'ltr' : 'rtl';
  function line(text,y,size,color,face='serif') {
    c.fillStyle=color;
    for(; size>19;size-=2) {
      c.font=size+'px '+face;
      if(c.measureText(text).width<=745) break;
    }
    c.fillText(text,450,y,745);
  }
  line(en?'YOU ARE INVITED':'دعوة خاصة',215,34,'#765b3b');
  line(privateCard ? (en?'Your invitation':'دعوتكم') : data.title || (en?'An invitation':'دعوة'),405,76,'#332820');
  if(!privateCard) {
    if(data.startAt && Number.isFinite(Date.parse(data.startAt))) {
      line(new Intl.DateTimeFormat(en?'en':'ar-IQ',{dateStyle:'full',timeZone:data.timeZone || 'Asia/Baghdad'}).format(new Date(data.startAt)),535,36,'#634f3e');
    }
    line(data.place || '',605,34,'#634f3e');
  }
  const matrix=qrMatrix(url), unit=Math.floor(275/(matrix.length+8)), width=unit*(matrix.length+8);
  const x=Math.floor((900-width)/2), y=725;
  c.fillStyle='#fff'; c.fillRect(x,y,width,width); c.fillStyle='#211c18';
  matrix.forEach((row,r)=>row.forEach((on,k)=>{if(on)c.fillRect(x+(k+4)*unit,y+(r+4)*unit,unit,unit);}));
  line(en?'Scan to open your invitation':'امسح الرمز لفتح الدعوة',1070,31,'#634f3e');
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob) throw new Error('Image export failed');
  download(blob,'invitation-card.png');
}
