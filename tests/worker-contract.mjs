import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from '../dist/server/index.js';

const sql=new DatabaseSync(':memory:');
for(const file of ['0000_001.sql','0001_002.sql','0002_catalog.sql'])sql.exec(readFileSync('drizzle/'+file,'utf8'));
const bind=statement=>({
  bind:(...args)=>({
    first:async()=>sql.prepare(statement).get(...args)??null,
    all:async()=>({results:sql.prepare(statement).all(...args)}),
    run:async()=>({meta:sql.prepare(statement).run(...args)}),
    statement,args
  })
});
const DB={
  prepare:bind,
  batch:async statements=>{
    sql.exec('BEGIN IMMEDIATE');
    try {
      const results=statements.map(({statement,args})=>({meta:sql.prepare(statement).run(...args)}));
      sql.exec('COMMIT');
      return results;
    }catch(error){sql.exec('ROLLBACK');throw error}
  }
};
let cookie='';
async function request(path,method='GET',data,authenticated=true) {
  const headers={'cf-connecting-ip':'127.0.0.1'};
  if(data)headers['Content-Type']='application/json';
  if(authenticated && cookie)headers.Cookie=cookie;
  const response=await worker.fetch(new Request('https://qa.test'+path,{method,headers,body:data?JSON.stringify(data):undefined}),{DB});
  return response;
}
const home=await request('/');
assert.equal(home.status,200);
assert.match(await home.text(),/main.js/);
const auth=await request('/api/auth/register','POST',{email:'worker@qa.test',password:'test-worker-password'});
assert.equal(auth.status,200);
cookie=auth.headers.getSetCookie().map(item=>item.split(';')[0]).join('; ');
assert.match(auth.headers.get('set-cookie'),/Secure/);
const draft=await request('/api/invitations','POST',{templateId:'royal-navy-wax-seal',data:{title:'Hosted contract',startAt:'2027-01-01T10:00:01Z',timeZone:'Asia/Baghdad'},settings:{privacy:'unlisted',rsvpEnabled:true,maxGuests:2}});
assert.equal(draft.status,200,await draft.clone().text());
const {invitation}=await draft.json();
assert.equal((await request('/api/invitations/'+invitation.id+'/publish','POST',{})).status,200);
assert.equal((await request('/api/public/'+invitation.slug,'GET',undefined,false)).status,200);
assert.equal((await request('/api/public/'+invitation.slug+'/rsvp','POST',{name:'Guest',attending:true,count:1},false)).status,200);
assert.equal((await request('/i/'+invitation.slug,'GET',undefined,false)).status,200);
assert.equal((await request('/api/invitations/'+invitation.id+'/responses','GET',undefined,false)).status,401);
assert.equal((await request('/templates/covers/royal-navy-wax-seal.svg')).status,200);
const blocked=await worker.fetch(new Request('https://qa.test/api/invitations',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://untrusted.test',Cookie:cookie},body:'{}'}),{DB});
assert.equal(blocked.status,403);
sql.close();
console.log('Worker contract passed: static assets, secure signup, draft, publish, anonymous guest, RSVP, ownership and CSRF.');

