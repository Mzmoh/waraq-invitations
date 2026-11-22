const zones = new Map();
function dateParts(instant, zone) {
  if (!zones.has(zone)) {
    zones.set(zone, new Intl.DateTimeFormat('en-GB-u-nu-latn', {
      timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    }));
  }
  const parts = Object.fromEntries(zones.get(zone).formatToParts(instant).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

export function localDateTime(iso, zone) {
  return iso ? dateParts(new Date(iso), zone) : '';
}

// Resolve both sides of a daylight-saving transition; ambiguous wall times
// are offered as two distinct instants. Spring-forward gaps yield no instant.
export function utcCandidates(wall, zone) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(wall)) return [];
  const local = wall.length === 16 ? wall + ':00' : wall;
  const nominal = Date.parse(local + 'Z');
  if (!Number.isFinite(nominal)) return [];
  const offsets = new Set([-86400000, 0, 86400000].map(delta => {
    const sample = nominal + delta;
    return Date.parse(dateParts(sample, zone) + 'Z') - sample;
  }));
  return [...offsets].map(offset => nominal - offset)
    .filter(candidate => dateParts(candidate, zone) === local)
    .sort((a,b) => a-b).map(candidate => new Date(candidate).toISOString());
}

export const specialFields = {
  general: [],
  wedding: [['bride','اسم العروس','Bride'],['groom','اسم العريس','Groom'],['receptionTime','وقت الاستقبال','Reception time','time']],
  ramadan: [['gatheringType','نوع المناسبة','Occasion type','ramadan']],
  fitr: [['gatheringType','نوع المناسبة','Occasion type','eid']],
  adha: [['gatheringType','نوع المناسبة','Occasion type','eid']],
  hajj: [['pilgrim','اسم الحاج أو الحجاج','Pilgrim names'],['gatheringType','نوع المناسبة','Occasion type','hajj']],
  baby: [['babyName','اسم المولود','Baby’s name'],['parents','أسماء الوالدين','Parents’ names'],['birthDate','تاريخ الميلاد','Date of birth','date']],
  graduation: [['graduate','اسم الخريج','Graduate'],['institution','الجامعة أو المدرسة','University or school'],['department','القسم أو التخصص','Department or major'],['cohort','دفعة التخرج','Graduating class']]
};

export function validMap(value) {
  if (!value) return true;
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return false;
    return (['maps.app.goo.gl','maps.google.com'].includes(u.hostname) && u.pathname.length > 1)
      || (u.hostname === 'goo.gl' && /^\/maps\/.+/.test(u.pathname))
      || (/^(www\.)?google\.([a-z]{2,3})(\.[a-z]{2})?$/.test(u.hostname) && /^\/maps(\/|$)/.test(u.pathname));
  } catch { return false; }
}

export const sectionLabels = {
  countdown:['العد التنازلي','Countdown'],venue:['المكان','Venue'],
  schedule:['البرنامج','Schedule'],gallery:['الصور','Photos'],rsvp:['تأكيد الحضور','RSVP']
};

// IndexedDB avoids synchronous writes of large photographic data on each keypress.
let dbPromise;
function draftDB() {
  return dbPromise ||= new Promise((resolve,reject)=>{
    const op = indexedDB.open('invitation-editor-v1',1);
    op.onupgradeneeded = () => op.result.createObjectStore('drafts');
    op.onerror = () => reject(op.error);
    op.onsuccess = () => resolve(op.result);
  });
}
export async function localDraft(key, mode='get', value) {
  const db = await draftDB();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction('drafts', mode==='get'?'readonly':'readwrite');
    const store = tx.objectStore('drafts');
    const request = mode==='put' ? store.put(value,key) : mode==='delete' ? store.delete(key) : store.get(key);
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}
