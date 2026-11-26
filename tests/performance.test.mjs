import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server/index.mjs';
import {publicRepresentation} from '../server/static-performance.mjs';
import {optimisticChange} from '../public/async-ui.js';
test('stable keyset pages, private responsive media and cache isolation',async t=>{
 const {server,db}=await createApp({database:':memory:'});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port;
 async function request(path,{method='GET',data,cookie}={}){const r=await fetch(base+path,{method,headers:{...(cookie?{cookie}:{}),...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});return {status:r.status,headers:r.headers,json:r.headers.get('content-type')?.includes('json')?await r.json():null,cookie:r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')};}
 const a=await request('/api/auth/register',{method:'POST',data:{email:'performance@example.test',password:'demo-password-123'}}),b=await request('/api/auth/register',{method:'POST',data:{email:'other-performance@example.test',password:'demo-password-123'}});
 const owner=a.json.user.id,template=db.prepare('SELECT id FROM templates LIMIT 1').get().id;
 const insert=db.prepare('INSERT INTO invitations VALUES(?,?,?,?,?,?,?,?,?)');for(let i=0;i<71;i++)insert.run('perf-'+String(i).padStart(3,'0'),owner,'perf-slug-'+i,template,'published','{"title":"synthetic","startAt":"2030-01-01T00:00:00.000Z"}','{"privacy":"public","rsvpEnabled":true,"maxGuests":5}','','2030-01-01T00:00:00.000Z');
 const ids=[];let cursor='';do{const r=await request('/api/invitations?limit=10'+(cursor?'&cursor='+cursor:''),{cookie:a.cookie});assert.equal(r.status,200);assert.ok(r.json.invitations.length<=10);ids.push(...r.json.invitations.map(i=>i.id));cursor=r.json.pagination.nextCursor;assert.equal(r.json.totals.published,71);}while(cursor);
 assert.equal(ids.length,71);assert.equal(new Set(ids).size,71);assert.deepEqual(ids,[...ids].sort().reverse());
 assert.equal((await request('/api/invitations?limit=101',{cookie:a.cookie})).status,400);assert.equal((await request('/api/invitations?cursor=bad',{cookie:a.cookie})).status,400);
 const first=await request('/api/invitations?limit=1',{cookie:a.cookie});assert.equal((await request('/api/invitations?cursor='+first.json.pagination.nextCursor,{cookie:b.cookie})).json.invitations.length,0);
 const reply=db.prepare('INSERT INTO responses VALUES(?,?,?,?,?,?,?)');for(let i=0;i<71;i++)reply.run('reply-'+String(i).padStart(3,'0'),'perf-000','guest',1,1,'','2030-01-01T00:00:00.000Z');
 const replies=await request('/api/invitations/perf-000/responses',{cookie:a.cookie});assert.equal(replies.json.responses.length,50);assert.equal(replies.json.summary.total,71);assert.equal(replies.json.pagination.hasMore,true);
 const second=await request('/api/invitations/perf-000/responses?cursor='+replies.json.pagination.nextCursor,{cookie:a.cookie});assert.equal(second.json.responses.length,21);assert.equal(new Set([...replies.json.responses,...second.json.responses].map(r=>r.id)).size,71);
 const tiny='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
 const media=await request('/api/invitations',{method:'POST',cookie:a.cookie,data:{templateId:template,data:{title:'private responsive',images:[{src:tiny,width:1000,variants:[{src:tiny,width:480}]}]},settings:{privacy:'pin',pin:'1234'}}});assert.equal(media.status,200);
 const inv=media.json.invitation,url=inv.data.images[0].variants[0].src;assert.equal(db.prepare('SELECT count(*) AS n FROM invitation_assets WHERE invitation=?').get(inv.id).n,2);
 assert.equal((await request(url)).status,404);const privateResponse=await request(url,{cookie:a.cookie});assert.equal(privateResponse.status,200);assert.equal(privateResponse.headers.get('cdn-cache-control'),'no-store');assert.equal(privateResponse.headers.get('etag'),null);
 await request('/api/invitations/'+inv.id+'/publish',{method:'POST',cookie:a.cookie,data:{}}).then(r=>assert.equal(r.status,400)); // Missing startAt is still validated.
 const foreign=await request('/api/assets',{method:'POST',cookie:b.cookie,data:{dataUrl:tiny}});const attach=await request('/api/invitations',{method:'POST',cookie:a.cookie,data:{templateId:template,data:{images:[{src:tiny,width:1000,variants:[{src:foreign.json.url,width:480}]}]}}});assert.equal(attach.status,400);
 const staticResponse=await fetch(base+'/main.js');assert.equal(staticResponse.headers.get('content-encoding'),'gzip');const etag=staticResponse.headers.get('etag');assert.equal((await fetch(base+'/main.js',{headers:{'if-none-match':etag}})).status,304);
});
test('gzip negotiation and optimistic rollback keep safe semantics',async()=>{
 const bytes=Buffer.from('hello '.repeat(1000));assert.equal(publicRepresentation('/public/test.js',bytes,'gzip;q=0').encoding,null);assert.equal(publicRepresentation('/public/test.js',bytes,'br, gzip').encoding,'gzip');
 let state='open';await assert.rejects(()=>optimisticChange({apply:()=>state='resolved',commit:async()=>{throw Error('server rejected');},rollback:()=>state='open'}),/server rejected/);assert.equal(state,'open');
 await optimisticChange({apply:()=>state='resolved',commit:async()=>true,rollback:()=>state='open'});assert.equal(state,'resolved');
});
