import {createHash} from 'node:crypto';
const names={userid:'userId',templateid:'templateId',updatedat:'updatedAt',createdat:'createdAt',pinhash:'pinHash',responsecount:'responseCount',linkactive:'linkActive',verifiedat:'verifiedAt'};
export function normalizeRow(row){return row&&Object.fromEntries(Object.entries(row).map(([k,v])=>[names[k]||k,['responsecount','hits'].includes(k)?Number(v):v]))}
export function postgresSQL(sql){
 if(sql==='SELECT r.id,i.slug,r.reason,r.status,r.createdAt FROM reports r JOIN invitations i ON i.id=r.invitation ORDER BY r.createdAt DESC')return 'SELECT * FROM waraq_private.admin_reports()';
 let s=sql.replace(/INSERT OR IGNORE INTO/gi,'INSERT INTO');
 if(/INSERT OR IGNORE INTO/i.test(sql))s+=' ON CONFLICT DO NOTHING';
 s=s.replace(/json_object\('title',json_extract\(i\.data,'\$\.title'\)\)/g,"jsonb_build_object('title',i.data::jsonb->>'title')::text");
 s=s.replace('SET hits=hits+1','SET hits=limits.hits+1');
 if(/^INSERT INTO assets VALUES/i.test(s))s=s.replace('INSERT INTO assets VALUES','INSERT INTO assets(id,owner,mime,bytes) VALUES');
 let quoted=false,index=0,result='';
 for(let i=0;i<s.length;i++){const c=s[i];if(c==="'"){result+=c;if(quoted&&s[i+1]==="'"){result+=s[++i];continue;}quoted=!quoted;}else result+=c==='?'&&!quoted?'$'+(++index):c;}
 return result;
}
function context(req){
 const cookies=Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim()).filter(x=>x.includes('=')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
 return {session:createHash('sha256').update(cookies.invite_session||'').digest('hex'),pins:Object.fromEntries(Object.entries(cookies).filter(([k])=>/^invite_pin_[\w-]+$/.test(k)))};
}
export function postgresDatabase(client,req,{storage}={}){
 const who=context(req);let grant={};
 async function transaction(statements){
  await client.query('BEGIN');
  try{
   await client.query('SET LOCAL ROLE waraq_app');
   await client.query('SET LOCAL search_path=waraq_private,pg_catalog');
   await client.query("SELECT set_config('waraq.session_hash',$1,true),set_config('waraq.pin_grants',$2,true),set_config('waraq.unlocked_slug',$3,true),set_config('waraq.unlocked_hash',$4,true)",[who.session,JSON.stringify(who.pins),grant.slug||'',grant.pinHash||'']);
   for(const [sql,...args] of statements)if(/^INSERT INTO responses SELECT/i.test(sql))await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[args.at(-1)]);
   const result=[];for(const [sql,...args] of statements)result.push(await client.query(postgresSQL(sql),args));
   await client.query('COMMIT');return result;
  }catch(e){await client.query('ROLLBACK');throw e}
 }
 async function calls(statements){
  const uploaded=[];
  try{
   const prepared=[];
   for(let offset=0;offset<statements.length;offset+=4){
    const results=await Promise.allSettled(statements.slice(offset,offset+4).map(async statement=>{const [sql,...args]=statement;
     if(/^INSERT INTO assets VALUES/i.test(sql)&&args[3] instanceof Uint8Array){if(!storage)throw Error('Private storage unavailable');const[id,owner,mime,bytes]=args,meta=await storage.put({id,owner,mime,bytes});uploaded.push(meta.key);args[3]=JSON.stringify(meta);}return [sql,...args];}));
    const failure=results.find(r=>r.status==='rejected');if(failure)throw failure.reason;prepared.push(...results.map(r=>r.value));
   }
   return await transaction(prepared);
  }catch(e){if(uploaded.length)await storage.remove(uploaded).catch(()=>console.warn('Trial storage orphan cleanup pending'));throw e}
 }
 const one=async(sql,...args)=>normalizeRow((await calls([[sql,...args]]))[0].rows?.[0]);
 const all=async(sql,...args)=>((await calls([[sql,...args]]))[0].rows||[]).map(normalizeRow);
 const run=async(sql,...args)=>{const r=(await calls([[sql,...args]]))[0];return {changes:Number(r.rowCount??r.affectedRows??0)}};
 return {one,all,run,adminReportSQL:({cursor,limit})=>['SELECT * FROM waraq_private.admin_report_page(?,?,?)',cursor?.[0]??null,cursor?.[1]??null,limit+1],authSecret:async token=>{const results=await transaction([["INSERT OR IGNORE INTO secrets(name,value) VALUES ('hmac',?)",token],["SELECT value FROM secrets WHERE name='hmac'"]]);return results[1].rows[0].value;},readMany:async statements=>(await transaction(statements)).map(r=>(r.rows||[]).map(normalizeRow)),batch:async statements=>(await calls(statements)).map(r=>({changes:Number(r.rowCount??r.affectedRows??0)})),
  async published(slug){
   const row=await one("SELECT i.id,i.slug,i.templateId,i.pinHash,i.data,i.settings FROM invitations i JOIN templates t ON t.id=i.templateId JOIN categories c ON c.id=t.category WHERE slug=? AND status='published' AND t.published=1 AND c.published=1",slug);
   return row||await one('SELECT * FROM waraq_private.guest_metadata(?)',slug);
  },
  grantPin:row=>{grant={slug:row.slug,pinHash:row.pinHash}},
  persistAudio:true,
  assetBytes:asset=>storage.get({...JSON.parse(asset.bytes),id:asset.id,owner:asset.owner}),
  async flushStorage(){if(!storage)return;const rows=await all('SELECT key FROM storage_gc LIMIT 20');if(rows.length){await storage.remove(rows.map(r=>r.key));await run('DELETE FROM storage_gc WHERE key IN ('+rows.map(()=>'?').join(',')+')',...rows.map(r=>r.key));}}
 };
}
let pool;
export async function trialPool(env=process.env){
 if(!env.DATABASE_URL)throw Error('DATABASE_URL is required');
 if(!pool){const {Pool}=await import('pg');const url=new URL(env.DATABASE_URL);
  if(!['postgres:','postgresql:'].includes(url.protocol))throw Error('Invalid PostgreSQL URL');
  url.searchParams.delete('sslmode');url.searchParams.delete('sslcert');url.searchParams.delete('sslkey');url.searchParams.delete('sslrootcert');
  pool=new Pool({connectionString:url.href,max:1,idleTimeoutMillis:10000,connectionTimeoutMillis:5000,ssl:{rejectUnauthorized:true},allowExitOnIdle:true});
 }return pool;
}
