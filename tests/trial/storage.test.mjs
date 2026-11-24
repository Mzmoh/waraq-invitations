import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {privateStorage} from '../../server/trial/storage.mjs';
import {trialDatabase} from './helpers.mjs';
test('private Storage HTTP contract, integrity and fail closed',async()=>{
 const objects=new Map();let corrupt=false;const env={SUPABASE_URL:'https://trialref.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-server-only'};
 const storage=privateStorage(env,{fetcher:async(url,options)=>{
  assert.equal(options.headers.Authorization,'Bearer test-server-only');assert.equal(options.redirect,'error');assert.ok(!url.includes('test-server-only'));
  const key=new URL(url).pathname.split('/waraq-trial-private/')[1];
  if(options.method==='POST'){objects.set(key,new Uint8Array(options.body));return new Response('{}');}
  if(options.method==='DELETE'){for(const k of JSON.parse(options.body).prefixes)objects.delete(k);return new Response('{}');}
  return new Response(corrupt?new Uint8Array([0]):objects.get(key));
 }});
 const id='12345678-1234-1234-1234-123456789012',bytes=new Uint8Array([1,2,3]),owner='test-owner';const meta=await storage.put({id,owner,bytes,mime:'image/png'});
 assert.deepEqual(await storage.get({...meta,id,owner}),bytes);await assert.rejects(()=>storage.get({...meta,id,owner:'someone-else'}),/binding/);
 corrupt=true;await assert.rejects(()=>storage.get({...meta,id,owner}),/integrity/);await storage.remove([meta.key]);assert.equal(objects.size,0);
 await assert.rejects(()=>storage.put({id:'../bad',owner,bytes,mime:'image/png'}),/Invalid/);assert.throws(()=>privateStorage({...env,SUPABASE_URL:'http://trialref.supabase.co'}));
});
test('Supabase storage policy denies browser roles and private auth schema',async t=>{
 const {pg}=await trialDatabase();t.after(()=>pg.close());
 // Minimal Supabase-owned table stand-ins. Hosted Storage itself is not simulated.
 await pg.exec("CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);CREATE TABLE storage.objects(bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;GRANT USAGE ON SCHEMA storage TO anon,authenticated;GRANT ALL ON storage.objects TO anon,authenticated;CREATE POLICY preexisting_allow ON storage.objects USING(true) WITH CHECK(true);");
 await pg.exec(await readFile(new URL('../../supabase/migrations/0002_private_storage.sql',import.meta.url),'utf8'));
 assert.equal((await pg.query("SELECT public FROM storage.buckets WHERE id='waraq-trial-private'")).rows[0].public,false);
 await pg.exec("INSERT INTO storage.objects VALUES('waraq-trial-private','secret'),('other','open');");
 for(const role of ['anon','authenticated']){
  await pg.exec('SET ROLE '+role);assert.deepEqual((await pg.query('SELECT name FROM storage.objects')).rows,[{name:'open'}]);
  await assert.rejects(()=>pg.query("INSERT INTO storage.objects VALUES('waraq-trial-private','forged')"),/row-level security/);
  await assert.rejects(()=>pg.query('SELECT * FROM waraq_private.users'),/permission denied/);
  await pg.exec('RESET ROLE');
 }
});
