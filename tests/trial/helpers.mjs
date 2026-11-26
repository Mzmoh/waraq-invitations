import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {templates} from '../../public/templates/index.js';
export async function trialDatabase({performanceMigration=true}={}){
 const require=createRequire(import.meta.url);
 const pkg=process.env.PGLITE_MODULE||'@electric-sql/pglite';
 const {PGlite}=require(pkg);const {pgcrypto}=require(pkg+'/dist/contrib/pgcrypto.cjs');
 const pg=new PGlite({extensions:{pgcrypto}});
 await pg.exec(await readFile(new URL('../../supabase/migrations/0001_trial.sql',import.meta.url),'utf8'));
 if(performanceMigration)await pg.exec(await readFile(new URL('../../supabase/migrations/0004_performance.sql',import.meta.url),'utf8'));
 await pg.exec(await readFile(new URL('../../supabase/migrations/0005_responsive_media.sql',import.meta.url),'utf8'));
 await pg.exec(await readFile(new URL('../../supabase/migrations/0006_report_pagination.sql',import.meta.url),'utf8'));
 await pg.query('SET search_path=waraq_private,pg_catalog');
 for(const c of new Set(templates.map(t=>t.category)))await pg.query('INSERT INTO categories VALUES($1,1)',[c]);
 for(const t of templates)await pg.query('INSERT INTO templates VALUES($1,$2,1)',[t.id,t.category]);
 let tail=Promise.resolve();
 const pool={async connect(){let release;const done=new Promise(r=>release=r);const prior=tail;tail=prior.then(()=>done);await prior;return {query:(sql,args)=>pg.query(sql,args),release};}};
 return {pg,pool};
}
export function memoryStorage(){
 const objects=new Map();return {objects,
 async put({id,owner,bytes}){const key=owner+'/'+id;if(objects.has(key))throw Error('Duplicate object');objects.set(key,new Uint8Array(bytes));return {key,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};},
 async get(meta){const b=objects.get(meta.key);if(!b)throw Error('Missing object');return b;},
 async remove(keys){for(const k of keys)objects.delete(k);}
 };
}
