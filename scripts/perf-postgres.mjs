import {readFileSync} from 'node:fs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {trialDatabase,memoryStorage} from '../tests/trial/helpers.mjs';
import {postgresDatabase,postgresSQL} from '../server/trial/postgres.mjs';
import {portableAPI as currentAPI} from '../server/api-portable.mjs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const phase=process.argv[2]||'before',out='test-results/performance';await mkdir(out,{recursive:true});
let portableAPI=currentAPI;if(phase!=='after'){let source=readFileSync(new URL('../benchmarks/baseline/api-portable.mjs',import.meta.url),'utf8');for(const file of ['account-recovery.mjs','validation.mjs'])source=source.replace("'./"+file+"'",JSON.stringify(new URL('../server/'+file,import.meta.url).href));portableAPI=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).portableAPI;}
const {pg}=await trialDatabase({performanceMigration:phase!=='before'});
try{

 await pg.exec("INSERT INTO users SELECT 'perf-owner-'||n,'owner'||n||'@example.test','synthetic-only','creator' FROM generate_series(1,4)n;INSERT INTO sessions VALUES('"+createHash('sha256').update('perf-synthetic-session').digest('hex')+"','perf-owner-1',9999999999999);");
 await pg.exec("INSERT INTO invitations SELECT 'perf-'||u||'-'||n,'perf-owner-'||u,'perf-slug-'||u||'-'||n,(SELECT id FROM templates LIMIT 1),'published',jsonb_build_object('title','Synthetic invitation '||n,'message',repeat('x',4000))::text,'{\"privacy\":\"unlisted\",\"rsvpEnabled\":true,\"maxGuests\":5}','','2030-01-01T00:00:00.000Z' FROM generate_series(1,4)u CROSS JOIN generate_series(1,150)n;");
 await pg.exec("INSERT INTO responses SELECT i.id||'-r-'||n,i.id,'Synthetic guest',1,1,'','2030-01-01T00:00:00.000Z' FROM invitations i CROSS JOIN generate_series(1,20)n;ANALYZE;");
 let statements=0,queries=[];const client={async query(sql,args){statements++;if(/^(SELECT i\.id,i\.slug|WITH page)/i.test(sql))queries.push({sql,args});return pg.query(sql,args);}};
 const db=postgresDatabase(client,{headers:{cookie:'invite_session=perf-synthetic-session'}},{storage:memoryStorage()});
 const auth={user:async()=>({id:'perf-owner-1'}),hasGrant:()=>false};const api=portableAPI(db,auth);
 const samples=[];for(let n=0;n<4;n++){statements=0;const start=performance.now();const result=await api.route({method:'GET',url:'/api/invitations',headers:{},socket:{remoteAddress:'local'}},{},'/api/invitations',{});samples.push({wallMs:performance.now()-start,sqlCommands:statements,rows:result.invitations.length,jsonBytes:Buffer.byteLength(JSON.stringify(result))});}
 const captured=queries.at(-1);if(!captured)throw Error('List SELECT not captured');
 await pg.query('BEGIN');await pg.query('SET LOCAL ROLE waraq_app');await pg.query('SET LOCAL search_path=waraq_private,pg_catalog');await pg.query("SELECT set_config('waraq.session_hash',$1,true)",[createHash('sha256').update('perf-synthetic-session').digest('hex')]);
 const explain=(await pg.query('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) '+captured.sql,captured.args)).rows[0]['QUERY PLAN'];await pg.query('ROLLBACK');
 const report={phase,engine:(await pg.query('SELECT version()')).rows[0].version,fixture:{users:4,invitations:600,ownerInvitations:150,responses:12000,messageCharacters:4000},samples,sql:captured,explain,limitations:'Local PGlite PostgreSQL/WASM; no network, Supabase pooler, production server or production data. Auth lookup excluded to isolate list query. First run retained as warm-up.'};
 await writeFile(out+'/postgres-'+phase+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify({phase,samples,executionMs:explain[0]['Execution Time']}));
}finally{await pg.close();}
