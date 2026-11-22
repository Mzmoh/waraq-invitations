import {Buffer} from 'node:buffer';
import {randomUUID} from 'node:crypto';
import {assets} from 'virtual:static';
import {templates} from '../public/templates/index.js';
import {portableAPI} from '../server/api-portable.mjs';
import {createAuth} from '../server/auth.mjs';
import {mailConfiguration} from '../server/account-recovery.mjs';
import {HttpError,fail,plain} from '../server/validation.mjs';
import {remoteDatabase} from './database.mjs';

const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const security={
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'strict-origin-when-cross-origin',
  'X-Frame-Options':'SAMEORIGIN',
  'Cache-Control':'no-store',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'"
};
const validRoute=/^\/(?:$|occasions(?:\/[\w-]+)?$|(?:templates|create)\/[\w-]+$|dashboard(?:\/invitations\/[\w-]+)?$|auth$|login$|admin$)/;
export default {
  async fetch(request,env) {
    const headers=new Headers(security);
    const requestId=randomUUID();headers.set('X-Request-ID',requestId);
    const url=new URL(request.url);
    if(/^\/(?:auth|login|register|dashboard|admin|create)(?:\/|$)/.test(url.pathname))headers.set('X-Robots-Tag','noindex, nofollow');
    let binary;
    const res={
      setHeader:(key,value)=>{
        headers.delete(key);
        for(const entry of Array.isArray(value)?value:[value])headers.append(key,String(entry));
      },
      getHeader:key=>key.toLowerCase()==='set-cookie'?headers.getSetCookie():headers.get(key),
      end:value=>{binary=value}
    };
    try {
      let path;
      try {path=decodeURIComponent(url.pathname)}catch{fail(400,'BAD_PATH','الرابط غير صالح.')}
      if(path.includes('\\')||path.includes('\0')||path.split('/').includes('..'))fail(400,'BAD_PATH','الرابط غير صالح.');
      const guest=path.match(/^\/i\/([\w-]+)$/);
      if(path.startsWith('/api/')||guest) {
        if(!env.DB)fail(503,'DATABASE_UNAVAILABLE','الخدمة قيد الإعداد.');
        const database=remoteDatabase(env.DB);
        const auth=await createAuth(database,{secure:true});
        if(env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
          const email=env.ADMIN_EMAIL.trim().toLowerCase();
          if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||env.ADMIN_PASSWORD.length<12||env.ADMIN_PASSWORD.length>128) {
            fail(503,'ADMIN_CONFIGURATION','إعداد المسؤول يحتاج مراجعة.');
          }
          const existing=await database.one('SELECT role FROM users WHERE email=?',email);
          if(existing && existing.role!=='admin')fail(503,'ADMIN_CONFIGURATION','بريد التهيئة مستخدم لحساب آخر.');
          if(!existing)await database.run("INSERT OR IGNORE INTO users(id,email,password,role) VALUES (?,?,?,'admin')",randomUUID(),email,await auth.hashPassword(env.ADMIN_PASSWORD));
        }
        const api=portableAPI(database,auth,mailConfiguration(env));
        const req={method:request.method,headers:Object.fromEntries(request.headers),socket:{remoteAddress:request.headers.get('cf-connecting-ip')||'unknown'}};
        if(path.startsWith('/api/')) {
          let body={};
          if(!['GET','HEAD'].includes(request.method)) {
            if(request.headers.get('sec-fetch-site')==='cross-site'||(request.headers.has('origin')&&request.headers.get('origin')!==url.origin))fail(403,'BAD_ORIGIN','مصدر الطلب غير مسموح.');
            if(request.headers.get('content-type')?.split(';')[0]!=='application/json')fail(415,'JSON_REQUIRED','أرسل بيانات JSON.');
            const reader=request.body?.getReader(),chunks=[];
            let size=0;
            if(reader)while(true) {
              const {value,done}=await reader.read();
              if(done)break;
              size+=value.byteLength;
              if(size>6000000){await reader.cancel();fail(413,'BODY_TOO_LARGE','البيانات أكبر من الحد المسموح.')}
              chunks.push(value);
            }
            try {body=JSON.parse(Buffer.concat(chunks).toString()||'{}')}catch{fail(400,'INVALID_JSON','البيانات غير صالحة.')}
            if(!plain(body))fail(400,'INVALID_JSON','البيانات غير صالحة.');
          }
          const result=await api.route(req,res,path.replace(/\/$/,''),body);
          if(binary!==undefined)return new Response(request.method==='HEAD'?null:binary,{headers});
          headers.set('Content-Type','application/json; charset=utf-8');
          return new Response(request.method==='HEAD'?null:JSON.stringify(result),{headers});
        }
        headers.set('X-Robots-Tag','noindex, nofollow');
        const row=await api.published(guest[1]);
        const data=row && JSON.parse(row.settings).privacy==='public'?JSON.parse(row.data):{};
        const title=data.title||'دعوة إلكترونية',description=data.message?.slice(0,160)||'افتح الدعوة الإلكترونية.';
        let html=Buffer.from(assets['/index.html'].body,'base64').toString();
        const cover=data.title?templates.find(template=>template.id===row.templateId)?.thumbnail:null;
        const meta='<meta property="og:type" content="website"><meta property="og:title" content="'+escape(title)+'"><meta property="og:description" content="'+escape(description)+'"><meta property="og:url" content="'+escape(url.href)+'">'+(cover?'<meta property="og:image" content="'+escape(url.origin+cover)+'">':'');
        html=html.replace(/<title>[\s\S]*?<\/title>/i,'<title>'+escape(title)+'</title>').replace('</head>',meta+'</head>');
        headers.set('Content-Type','text/html; charset=utf-8');
        return new Response(request.method==='HEAD'?null:html,{status:row?200:404,headers});
      }
      if(!['GET','HEAD'].includes(request.method))fail(405,'METHOD_NOT_ALLOWED','طريقة الطلب غير مسموحة.');
      if(path==='/robots.txt') {
        headers.set('Content-Type','text/plain');
        return new Response('User-agent: *\nDisallow: /i/\nDisallow: /api/\nDisallow: /dashboard\nDisallow: /admin\n',{headers});
      }
      if(path==='/sitemap.xml') {
        headers.set('Content-Type','application/xml');
        const pages=['/','/occasions',...new Set(templates.map(template=>'/occasions/'+template.category))];
        return new Response('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+pages.map(page=>'<url><loc>'+escape(url.origin+page)+'</loc></url>').join('')+'</urlset>',{headers});
      }
      const asset=assets[path]||(!path.includes('.')?assets['/index.html']:undefined);
      if(!asset)fail(404,'NOT_FOUND','الصفحة غير متوفرة.');
      headers.set('Content-Type',asset.type);
      headers.set('Cache-Control',path.includes('.')?'public, max-age=60':'no-store');
      return new Response(request.method==='HEAD'?null:Buffer.from(asset.body,'base64'),{status:assets[path]||validRoute.test(path)?200:404,headers});
    }catch(error) {
      const known=error instanceof HttpError;
      if(!known)console.error('Request failed',requestId,error.name||'Error');
      let status=known?error.status:500,code=known?error.code:'SERVER_ERROR',message=known?error.message:'تعذر إكمال الطلب.';
      for(const [needle,errorCode,description] of [
        ['ASSET_QUOTA','ASSET_QUOTA','مساحة الصور ممتلئة.'],
        ['INVITATION_LIMIT','INVITATION_LIMIT','وصلت إلى الحد المسموح للدعوات.'],
        ['FOREIGN_ASSET','FOREIGN_ASSET','الصورة غير مملوكة لك.']
      ])if(String(error.message).includes(needle)){status=400;code=errorCode;message=description}
      headers.set('Content-Type','application/json; charset=utf-8');
      if(status===429)headers.set('Retry-After','900');
      return new Response(JSON.stringify({code,error:message}),{status,headers});
    }
  }
};

