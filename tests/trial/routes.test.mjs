import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {trialDatabase,memoryStorage} from './helpers.mjs';
import {createTrialHandler,BODY_LIMIT} from '../../server/trial/handler.mjs';
import {postgresDatabase} from '../../server/trial/postgres.mjs';
import {templates} from '../../public/templates/index.js';

test('PostgreSQL trial routes and RLS',async t=>{
 const {pg,pool}=await trialDatabase();t.after(()=>pg.close());const storage=memoryStorage();
 const env={PUBLIC_ORIGIN:'https://waraq.example',COOKIE_SECURE:'true',WARAQ_TRIAL_ONLY:'true',VERCEL:'1'};
 const deliveries=[];const handle=createTrialHandler({pool,storage,env,mail:{origin:env.PUBLIC_ORIGIN,deliver:async value=>{deliveries.push(value);}},htmlLoader:async()=>'<html><head><title>WARAQ</title></head><body></body></html>'});
 async function req(path,{method='GET',data,cookie='',headers={}}={}){
  const response=await handle(new Request(env.PUBLIC_ORIGIN+path,{method,headers:{'x-vercel-forwarded-for':'203.0.113.9',cookie,...(data?{'Content-Type':'application/json'}:{}),...headers},body:data?JSON.stringify(data):undefined}));
  const text=await response.text();return {status:response.status,headers:response.headers,cookie:response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; '),body:text&&response.headers.get('content-type')?.includes('json')?JSON.parse(text):text};
 }
 const register=email=>req('/api/auth/register',{method:'POST',data:{email,password:'trial-password-123'}});
 const a=await register('owner@trial.test'),b=await register('other@trial.test');assert.equal(a.status,200,JSON.stringify(a.body));assert.equal(b.status,200);
 let invitation;let pinCookie;const tiny='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
 const sound='data:audio/wav;base64,'+Buffer.from('RIFF0000WAVE0123456789').toString('base64');
 await t.test('health, me, catalogue, auth and secure cookies',async()=>{
  assert.equal((await req('/api/health')).status,200);assert.equal((await req('/api/me')).body.user,null);
  assert.equal((await req('/api/me',{cookie:a.cookie})).body.user.id,a.body.user.id);
  assert.equal((await req('/api/catalog')).status,200);assert.match(a.headers.get('set-cookie'),/HttpOnly.*SameSite=Lax.*Secure/);
  assert.equal((await req('/api/auth/login',{method:'POST',data:{email:'owner@trial.test',password:'wrong-password'}})).status,401);
  assert.equal((await req('/api/auth/login',{method:'POST',data:{email:'owner@trial.test',password:'trial-password-123'}})).status,200);
 });
 await t.test('create, reopen and privately store image and audio',async()=>{
  const r=await req('/api/invitations',{method:'POST',cookie:a.cookie,data:{templateId:templates[0].id,data:{title:'سري طويل لا يظهر للغرباء',startAt:'2030-01-02T12:00:00.000Z',images:[{src:tiny}],audio:{track:'upload',src:sound,volume:.4,loop:true,rightsConfirmed:true}},settings:{privacy:'pin',pin:'1234',rsvpEnabled:true,maxGuests:3}}});
  assert.equal(r.status,200,JSON.stringify(r.body));invitation=r.body.invitation;assert.equal(storage.objects.size,2);assert.match(invitation.data.audio.src,/^\/api\/assets\//);
  const reopened=await req('/api/invitations/'+invitation.id,{cookie:a.cookie});assert.equal(reopened.body.invitation.data.audio.src,invitation.data.audio.src);
  assert.equal((await req(invitation.data.audio.src,{cookie:a.cookie})).status,200);assert.equal((await req(invitation.data.audio.src,{cookie:b.cookie})).status,404);
  assert.equal((await req('/api/invitations',{cookie:a.cookie})).body.invitations.length,1);
 });
 await t.test('ownership at API and PostgreSQL policy level',async()=>{
  assert.equal((await req('/api/invitations/'+invitation.id,{cookie:b.cookie})).status,404);
  assert.equal((await req('/api/invitations/'+invitation.id,{method:'DELETE',cookie:b.cookie,data:{confirm:invitation.id}})).status,404);
  const client=await pool.connect();try{
   const db=postgresDatabase(client,{headers:{cookie:b.cookie}},{storage});
   assert.equal(await db.one('SELECT * FROM invitations WHERE id=?',invitation.id),undefined);
   assert.equal((await db.run('UPDATE invitations SET owner=? WHERE id=?',b.body.user.id,invitation.id)).changes,0);
   await assert.rejects(()=>db.run('INSERT INTO invitations(id,owner,slug,templateId,data,settings,updatedAt) VALUES(?,?,?,?,?,?,?)','forged',a.body.user.id,'forged',templates[0].id,'{}','{}',new Date().toISOString()),/row-level security/);
  }finally{client.release();}
 });
 await t.test('publish, PIN unlock, cookie grant and metadata privacy',async()=>{
  const r=await req('/api/invitations/'+invitation.id+'/publish',{method:'POST',cookie:a.cookie,data:{}});assert.equal(r.status,200,JSON.stringify(r.body));invitation=r.body.invitation;
  assert.equal((await req('/api/public/'+invitation.slug)).status,401);
  assert.equal((await req('/api/public/'+invitation.slug+'/unlock',{method:'POST',data:{pin:'0000'}})).status,401);
  const unlock=await req('/api/public/'+invitation.slug+'/unlock',{method:'POST',data:{pin:'1234'}});assert.equal(unlock.status,200,JSON.stringify(unlock.body));assert.equal(unlock.body.invitation.data.title,invitation.data.title);pinCookie=unlock.cookie;
  assert.equal((await req('/api/public/'+invitation.slug,{cookie:pinCookie})).status,200);
  assert.equal((await req(invitation.data.images[0].src,{cookie:pinCookie})).status,200);
  assert.equal((await req('/api/public/'+invitation.slug)).status,401,'grants must not leak between requests');
  const html=await req('/i/'+invitation.slug);assert.equal(html.status,200);assert.ok(!html.body.includes(invitation.data.title));assert.match(html.headers.get('x-robots-tag'),/noindex/);
 });
 await t.test('RSVP receipts, CSV, reports and admin controls',async()=>{
  const path='/api/public/'+invitation.slug+'/rsvp',data={name:'ضيف',attending:true,count:2,submissionId:'trial-submission-0001'};
  for(let i=0;i<2;i++){const r=await req(path,{method:'POST',cookie:pinCookie,data});assert.equal(r.status,200,JSON.stringify(r.body));}
  const replies=await req('/api/invitations/'+invitation.id+'/responses',{cookie:a.cookie});assert.equal(replies.body.responses.length,1);
  assert.equal((await req('/api/invitations/'+invitation.id+'/responses.csv',{cookie:a.cookie})).status,200);
  assert.equal((await req('/api/public/'+invitation.slug+'/report',{method:'POST',cookie:pinCookie,data:{reason:'trial report'}})).status,200);
  assert.equal((await req('/api/admin',{cookie:a.cookie})).status,403);
  await pg.query("UPDATE waraq_private.users SET role='admin' WHERE id=$1",[a.body.user.id]);
  assert.equal((await req('/api/admin',{cookie:a.cookie})).status,200);
 });
 await t.test('mail reset and verification preserve original scrypt auth',async()=>{
  assert.equal((await req('/api/auth/request-verification',{method:'POST',cookie:b.cookie,data:{}})).status,200);
  let token=new URL(deliveries.at(-1).url).hash.slice(7);
  assert.equal((await req('/api/auth/verify',{method:'POST',data:{token}})).status,200);
  assert.equal((await req('/api/auth/forgot',{method:'POST',data:{email:'other@trial.test'}})).status,200);
  token=new URL(deliveries.at(-1).url).hash.slice(7);
  assert.equal((await req('/api/auth/reset',{method:'POST',data:{token,password:'changed-password-123'}})).status,200);
  assert.equal((await req('/api/me',{cookie:b.cookie})).body.user,null);
  assert.equal((await req('/api/auth/login',{method:'POST',data:{email:'other@trial.test',password:'changed-password-123'}})).status,200);
 });
 await t.test('admin visibility toggles and report resolution are audited',async()=>{
  const catalogue=await req('/api/admin',{cookie:a.cookie});const report=catalogue.body.reports[0];
  assert.equal((await req('/api/admin/reports/'+report.id,{method:'PATCH',cookie:a.cookie,data:{status:'resolved'}})).status,200);
  for(const [type,id] of [['templates',invitation.templateId],['categories',templates[0].category]]){
   assert.equal((await req('/api/admin/'+type+'/'+id,{method:'PATCH',cookie:a.cookie,data:{published:false}})).status,200);
   assert.equal((await req('/api/public/'+invitation.slug,{cookie:pinCookie})).status,404);
   assert.equal((await req('/api/admin/'+type+'/'+id,{method:'PATCH',cookie:a.cookie,data:{published:true}})).status,200);
  }
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM audit')).rows[0].n,5);
 });
 await t.test('all 80 stable templates create, publish and serve through trial API',async()=>{
  for(const [index,template] of templates.entries()){
   const headers={'x-vercel-forwarded-for':'203.0.113.'+(index+10)};
   const saved=await req('/api/invitations',{method:'POST',cookie:a.cookie,headers,data:{templateId:template.id,data:{title:template.id,startAt:'2030-01-02T12:00:00.000Z'},settings:{privacy:'public'}}});
   assert.equal(saved.status,200,template.id+': '+JSON.stringify(saved.body));const item=saved.body.invitation;
   assert.equal((await req('/api/invitations/'+item.id+'/publish',{method:'POST',cookie:a.cookie,headers,data:{}})).status,200,template.id);
   const guest=await req('/api/public/'+item.slug);assert.equal(guest.status,200,template.id);assert.equal(guest.body.invitation.templateId,template.id);
   assert.equal((await req('/api/public/'+item.slug+'/unlock',{method:'POST',data:{}})).status,200);
   assert.ok((await req('/i/'+item.slug)).body.includes(template.id));
   assert.equal((await req('/api/invitations/'+item.id,{method:'DELETE',cookie:a.cookie,data:{confirm:item.id}})).status,200);
  }
 });
 await t.test('standalone upload, failed attachment and cleanup leave no private orphan',async()=>{
  const upload=await req('/api/assets',{method:'POST',cookie:a.cookie,data:{dataUrl:tiny}});assert.equal(upload.status,200);
  assert.equal((await req(upload.body.url)).status,404);assert.equal((await req(upload.body.url,{cookie:a.cookie})).status,200);
  assert.equal((await req('/api/assets',{method:'POST',cookie:a.cookie,data:{dataUrl:'data:image/svg+xml;base64,PHN2Zz4='}})).status,400);
  assert.equal((await req('/api/assets',{method:'DELETE',cookie:a.cookie,data:{confirm:'unused'}})).status,200);
  assert.equal((await req(upload.body.url,{cookie:a.cookie})).status,404);
 });
 await t.test('edit CAS, PIN rotation, copy, archive, republish and delete',async()=>{
  const path='/api/invitations/'+invitation.id;
  const edit=await req(path,{method:'PATCH',cookie:a.cookie,data:{expectedUpdatedAt:invitation.updatedAt,settings:{pin:'5678'}}});assert.equal(edit.status,200,JSON.stringify(edit.body));
  assert.equal((await req(path,{method:'PATCH',cookie:a.cookie,data:{expectedUpdatedAt:invitation.updatedAt,data:invitation.data}})).status,409);
  assert.equal((await req('/api/public/'+invitation.slug,{cookie:pinCookie})).status,401);
  const copy=await req(path+'/copy',{method:'POST',cookie:a.cookie,data:{pin:'4321'}});assert.equal(copy.status,200,JSON.stringify(copy.body));
  assert.equal((await req(path+'/archive',{method:'POST',cookie:a.cookie,data:{}})).status,200);
  assert.equal((await req('/api/public/'+invitation.slug)).status,404);
  assert.equal((await req(path+'/publish',{method:'POST',cookie:a.cookie,data:{}})).status,200);
  for(const id of [invitation.id,copy.body.invitation.id])assert.equal((await req('/api/invitations/'+id,{method:'DELETE',cookie:a.cookie,data:{confirm:id}})).status,200);
  assert.equal(storage.objects.size,0);assert.equal((await req('/api/assets',{method:'DELETE',cookie:a.cookie,data:{confirm:'unused'}})).status,200);
 });
 await t.test('CSRF, invalid payload, HEAD, unknown route and persistent limits',async()=>{
  assert.equal((await req('/api/auth/login',{method:'POST',data:{},headers:{origin:'https://evil.example'}})).status,403);
  assert.equal((await req('/api/no-such-route')).status,404);assert.equal((await req('/api/health',{method:'HEAD'})).body,'');
  assert.equal((await req('/api/auth/login',{method:'POST',data:{x:'x'.repeat(BODY_LIMIT)}})).status,413);
  for(let i=0;i<40;i++)await req('/api/auth/login',{method:'POST',data:{email:'nobody@trial.test',password:'invalid-password'}});
  assert.equal((await req('/api/auth/login',{method:'POST',data:{email:'nobody@trial.test',password:'invalid-password'}})).status,429);
  const tables=(await pg.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='waraq_private' AND rowsecurity")).rows[0].n;assert.equal(tables,17);
  const session=a.cookie.split('=')[1];assert.equal(typeof createHash('sha256').update(session).digest('hex'),'string');
 });
 await t.test('logout revokes the existing custom session',async()=>{
  assert.equal((await req('/api/auth/logout',{method:'POST',cookie:a.cookie,data:{}})).status,200);
  assert.equal((await req('/api/me',{cookie:a.cookie})).body.user,null);
 });
});
