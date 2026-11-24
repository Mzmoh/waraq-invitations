import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {portableAPI} from '../api-portable.mjs';
import {createAuth} from '../auth.mjs';
import {HttpError,fail,plain} from '../validation.mjs';
import {normalizeIP} from '../production-config.mjs';
import {resendConfiguration} from '../mail-resend.mjs';
import {postgresDatabase} from './postgres.mjs';

export const BODY_LIMIT=3*1024*1024;
export const CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'";
const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function trialConfiguration(env){
 const origin=new URL(env.PUBLIC_ORIGIN||'');
 if(env.WARAQ_TRIAL_ONLY!=='true'||env.COOKIE_SECURE!=='true'||origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw Error('Trial requires WARAQ_TRIAL_ONLY=true, COOKIE_SECURE=true and canonical HTTPS PUBLIC_ORIGIN');
 return origin.origin;
}
async function bodyOf(request){
 if(request.headers.get('content-type')?.split(';')[0]!=='application/json')fail(415,'JSON_REQUIRED','JSON required.');
 if(Number(request.headers.get('content-length'))>BODY_LIMIT)fail(413,'BODY_TOO_LARGE','Trial upload limit is 3 MiB.');
 const chunks=[];let size=0;const reader=request.body?.getReader();
 if(reader)try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>BODY_LIMIT){await reader.cancel();fail(413,'BODY_TOO_LARGE','Trial upload limit is 3 MiB.');}chunks.push(value);}}finally{reader.releaseLock();}
 let data;try{data=JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{fail(400,'INVALID_JSON','Invalid JSON.');}
 if(!plain(data))fail(400,'INVALID_JSON','Expected JSON object.');return data;
}
export function createTrialHandler({pool,storage,env=process.env,mail,htmlLoader=()=>readFile(new URL('../../public/index.html',import.meta.url),'utf8')}={}){
 const origin=trialConfiguration(env);
 mail??=env.RESEND_API_KEY?resendConfiguration(env):{};
 return async request=>{
  const headers=new Headers({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'SAMEORIGIN','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':CSP,'X-Request-ID':randomUUID(),'X-Robots-Tag':'noindex, nofollow'});
  let client;let status=200;let output;let ended=false;
  const res={statusCode:200,getHeader:name=>name.toLowerCase()==='set-cookie'?headers.getSetCookie():headers.get(name),setHeader(name,value){headers.delete(name);for(const v of [].concat(value))headers.append(name,String(v));},end(value){output=value;ended=true;},get writableEnded(){return ended;}};
  try{
   const url=new URL(request.url);let path;
   try{path=decodeURIComponent(url.pathname==='/api/index'?(url.searchParams.get('waraq_path')||url.pathname):url.pathname);}catch{fail(400,'BAD_PATH','Invalid path.');}
   if(!path.startsWith('/')||path.includes('\\')||path.includes('\0')||path.split('/').includes('..'))fail(400,'BAD_PATH','Invalid path.');
   const req={method:request.method==='HEAD'?'GET':request.method,headers:Object.fromEntries(request.headers),socket:{remoteAddress:'unknown'},clientAddress:env.VERCEL==='1'?(normalizeIP(request.headers.get('x-vercel-forwarded-for'))||'unknown'):'unknown'};
   let body={};
   if(path.startsWith('/api/')&&!['GET','HEAD'].includes(request.method)){
    if(request.headers.get('sec-fetch-site')==='cross-site'||(request.headers.has('origin')&&request.headers.get('origin')!==origin))fail(403,'BAD_ORIGIN','Invalid origin.');
    body=await bodyOf(request);
   }
   if(!path.startsWith('/api/')&&!['GET','HEAD'].includes(request.method))fail(405,'METHOD_NOT_ALLOWED','Method not allowed.');
   if(path==='/robots.txt'){headers.set('Content-Type','text/plain');output='User-agent: *\nDisallow: /\n';}
   else if(path==='/sitemap.xml'){headers.set('Content-Type','application/xml');output='<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>';}
   else if(path.startsWith('/api/')||/^\/i\/[\w-]+$/.test(path)){
    client=await pool.connect();const db=postgresDatabase(client,req,{storage});const auth=await createAuth(db,{secure:true});const api=portableAPI(db,auth,mail);
    if(path.startsWith('/api/')){const result=await api.route(req,res,path.replace(/\/$/,''),body);if(!ended){headers.set('Content-Type','application/json; charset=utf-8');output=JSON.stringify(result);}}
    else{
     const row=await db.published(path.slice(3));if(!row)status=404;
     const data=row&&JSON.parse(row.settings).privacy==='public'?JSON.parse(row.data):{};
     const title=data.title||'WARAQ Invitation';let html=await htmlLoader();
     html=html.replace(/<title>[\s\S]*?<\/title>/i,'<title>'+escape(title)+'</title>').replace('</head>','<meta property="og:title" content="'+escape(title)+'"><meta property="og:description" content="'+escape(data.message?.slice(0,160)||'Private event invitation')+'"><meta property="og:url" content="'+escape(origin+path)+'"></head>');
     headers.set('Content-Type','text/html; charset=utf-8');output=html;
    }
    // Durable queue survives a failed Storage delete. Never lose a saved edit.
    await db.flushStorage().catch(()=>console.warn('Trial private storage cleanup pending'));
   }else {status=404;headers.set('Content-Type','application/json');output=JSON.stringify({error:{code:'NOT_FOUND',message:'Not found.'}});}
  }catch(error){
   status=error instanceof HttpError?error.status:503;headers.set('Content-Type','application/json');
   output=JSON.stringify({error:{code:error instanceof HttpError?error.code:'TRIAL_UNAVAILABLE',message:error instanceof HttpError?error.message:'Trial service unavailable.'}});
   if(!(error instanceof HttpError))console.warn('Trial request failed',headers.get('X-Request-ID'),error.code||'dependency');
  }finally{client?.release();}
  return new Response(request.method==='HEAD'?null:output,{status,headers});
 };
}
