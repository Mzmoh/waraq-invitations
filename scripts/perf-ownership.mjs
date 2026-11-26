import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';
import {trialDatabase,memoryStorage} from '../tests/trial/helpers.mjs';
import {postgresDatabase} from '../server/trial/postgres.mjs';
import {portableAPI as currentAPI} from '../server/api-portable.mjs';
let source=readFileSync(new URL('../benchmarks/baseline/api-portable.mjs',import.meta.url),'utf8');for(const file of ['account-recovery.mjs','validation.mjs'])source=source.replace("'./"+file+"'",JSON.stringify(new URL('../server/'+file,import.meta.url).href));const baselineAPI=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).portableAPI;
const {pg}=await trialDatabase();
try{
 await pg.query("INSERT INTO users VALUES('bench-owner','bench@example.test','synthetic','creator')");await pg.query('INSERT INTO sessions VALUES($1,$2,$3)',[createHash('sha256').update('bench-session').digest('hex'),'bench-owner',Date.now()+600000]);
 const images=[];for(let i=0;i<4;i++){const id=randomUUID();await pg.query('INSERT INTO assets VALUES($1,$2,$3,$4)',[id,'bench-owner','image/png',JSON.stringify({key:'bench-owner/'+id,size:10,sha256:'synthetic'})]);images.push({src:'/api/assets/'+id});}
 const template=(await pg.query('SELECT id FROM templates LIMIT 1')).rows[0].id;
 await pg.query('INSERT INTO invitations(id,owner,slug,templateid,data,settings,updatedat) VALUES($1,$2,$3,$4,$5,$6,$7)',['bench-invite','bench-owner','bench-slug',template,JSON.stringify({images}),'{}',new Date().toISOString()]);
 const samples=[];
 for(const [phase,make]of [['before',baselineAPI],['after',currentAPI]])for(let repeat=0;repeat<3;repeat++){
  const statements=[],client={query:(sql,args)=>{statements.push(sql);return pg.query(sql,args);}},req={method:'PATCH',headers:{cookie:'invite_session=bench-session'},socket:{remoteAddress:'local'}};
  const db=postgresDatabase(client,req,{storage:memoryStorage()}),api=make(db,{user:async()=>({id:'bench-owner'}),limit:async()=>{}}),version=(await pg.query('SELECT updatedat FROM invitations WHERE id=$1',['bench-invite'])).rows[0].updatedat;
  const start=performance.now();await api.route(req,{},'/api/invitations/bench-invite',{data:{images},expectedUpdatedAt:version});samples.push({phase,repeat,wallMs:performance.now()-start,sqlCommands:statements.length,ownershipSelects:statements.filter(s=>/^SELECT id(?:,mime)? FROM assets WHERE/i.test(s)).length});
 }
 await mkdir('test-results/performance',{recursive:true});await writeFile('test-results/performance/ownership.json',JSON.stringify({fixture:'4 existing owned images, same actual PostgreSQL engine/policies; auth identity stubbed, RLS session real; before API loaded from b10f352',samples},null,2));console.log(samples);
}finally{await pg.close();}
