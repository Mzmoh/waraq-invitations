// Synthetic fixtures ONLY. This script intentionally has no production override.
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {validateData} from '../server/validation.mjs';
import {privateStorage} from '../server/trial/storage.mjs';
import {trialPool} from '../server/trial/postgres.mjs';
const order=['categories','templates','users','secrets','sessions','assets','managed_assets','invitations','responses','reports','limits','audit','response_receipts','account_tokens','verified_emails'];
const hash=v=>createHash('sha256').update(v).digest('hex');
export function planDemoMigration(file){
 const db=new DatabaseSync(file,{readOnly:true});
 try{
  if(!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='waraq_trial_fixture'").get()||db.prepare('SELECT marker FROM waraq_trial_fixture').get()?.marker!=='WARAQ_SYNTHETIC_ONLY_V1')throw Error('Only generated synthetic fixtures may migrate. Production source refused.');
  if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok'||db.prepare('PRAGMA foreign_key_check').all().length)throw Error('SQLite integrity check failed');
  const tables=Object.fromEntries(order.map(t=>[t,db.prepare('SELECT * FROM '+t).all().map(row=>({...row}))]));const objects=[];
  for(const a of tables.assets){const bytes=new Uint8Array(a.bytes);objects.push({id:a.id,owner:a.owner,mime:a.mime,bytes});a.bytes=JSON.stringify({key:a.owner+'/'+a.id,size:bytes.length,sha256:hash(bytes)});}
  for(const invitation of tables.invitations){
   const data=JSON.parse(invitation.data);validateData(data,invitation.status==='published');
   if(data.audio?.track==='upload'&&data.audio.src.startsWith('data:')){
    const [,kind,encoded]=/^data:audio\/(mpeg|wav|ogg);base64,(.+)$/.exec(data.audio.src);const bytes=Buffer.from(encoded,'base64');
    const hex=hash(invitation.id+'|audio').slice(0,32);const id=[hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
    const object={id,owner:invitation.owner,mime:'audio/'+kind,bytes};objects.push(object);
    tables.assets.push({id,owner:object.owner,mime:object.mime,bytes:JSON.stringify({key:object.owner+'/'+id,size:bytes.length,sha256:hash(bytes)})});tables.managed_assets.push({asset:id});data.audio.src='/api/assets/'+id;invitation.data=JSON.stringify(data);
   }
  }
  const counts=Object.fromEntries(order.map(t=>[t,tables[t].length]));
  const digest=hash(JSON.stringify(tables));return {tables,objects,summary:{mode:'SYNTHETIC_ONLY',counts,objects:objects.length,digest}};
 }finally{db.close();}
}
export function assertTrialTarget(env){
 const url=new URL(env.SUPABASE_URL||'');const ref=env.WARAQ_TRIAL_PROJECT_REF;
 if(env.WARAQ_TRIAL_ONLY!=='true'||!ref||!/^https:$/.test(url.protocol)||url.hostname!==ref+'.supabase.co'||url.pathname!=='/'||url.username||url.password)throw Error('Explicit synthetic trial project reference required');
 const db=new URL(env.DATABASE_URL||'');
 if(!(db.username==='postgres.'+ref||db.hostname==='db.'+ref+'.supabase.co'))throw Error('Database project does not match trial storage project');
}
export async function applyDemoMigration(plan,{client,storage}){
 const uploaded=[];await client.query('BEGIN');
 try{
  await client.query('SET LOCAL search_path=waraq_private,pg_catalog');
  await client.query('LOCK TABLE users,invitations,assets IN EXCLUSIVE MODE');
  for(const table of order.filter(t=>!['categories','templates'].includes(t)))if(Number((await client.query('SELECT count(*) AS n FROM '+table)).rows[0].n))throw Error('Target must be empty (catalogue seed is allowed).');
  for(const object of plan.objects){const meta=await storage.put(object);uploaded.push(meta.key);if(hash(await storage.get({...meta,id:object.id,owner:object.owner}))!==hash(object.bytes))throw Error('Uploaded media verification failed');}
  for(const table of order)for(const row of plan.tables[table]){
   const columns=Object.keys(row).map(c=>c.toLowerCase());
   await client.query('INSERT INTO '+table+'('+columns.join(',')+') VALUES('+columns.map((_,i)=>'$'+(i+1)).join(',')+')'+(['categories','templates'].includes(table)?' ON CONFLICT(id) DO NOTHING':''),Object.values(row));
  }
  for(const table of order){const actual=Number((await client.query('SELECT count(*) AS n FROM '+table)).rows[0].n);if(actual!==plan.tables[table].length)throw Error('Migration count mismatch: '+table);}
  await client.query('COMMIT');return plan.summary;
 }catch(e){await client.query('ROLLBACK');if(uploaded.length)await storage.remove(uploaded).catch(()=>console.warn('Synthetic migration cleanup failed; inspect private trial bucket.'));throw e;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [file,mode]=process.argv.slice(2);if(!file||mode&&!['--apply-demo'].includes(mode))throw Error('Usage: node scripts/trial-migration.mjs var/trial-demo.sqlite [--apply-demo]');
 const plan=planDemoMigration(file);
 if(mode==='--apply-demo'){
  assertTrialTarget(process.env);const pool=await trialPool();const client=await pool.connect();
  try{await applyDemoMigration(plan,{client,storage:privateStorage(process.env)});}finally{client.release();await pool.end();}
 }
 console.log(JSON.stringify({...plan.summary,applied:mode==='--apply-demo'},null,2));
}
