import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {trialDatabase,memoryStorage} from './helpers.mjs';
import {createTrialHandler} from '../../server/trial/handler.mjs';
import {templates} from '../../public/templates/index.js';
import {postgresDatabase} from '../../server/trial/postgres.mjs';

const origin='https://waraq.example';
const env={PUBLIC_ORIGIN:origin,COOKIE_SECURE:'true',WARAQ_TRIAL_ONLY:'true',WARAQ_RENTALS:'true'};
async function nativeFixture(){
 const url=new URL(process.env.WARAQ_RENTAL_TEST_DATABASE_URL);
 if(!['127.0.0.1','localhost'].includes(url.hostname)||url.pathname!=='/waraq_rental_test')
  throw new Error('Use an empty disposable local database named waraq_rental_test.');
 const {Pool}=await import('pg');
 const pool=new Pool({connectionString:url.href,max:8});
 const client=await pool.connect();
 try{
  const existing=await client.query("SELECT to_regnamespace('waraq_private') AS schema");
  if(existing.rows[0].schema)throw new Error('The test database must be empty.');
  for(const name of ['0001_trial','0004_performance','0005_responsive_media','0006_report_pagination'])
   await client.query(await readFile(new URL('../../supabase/migrations/'+name+'.sql',import.meta.url),'utf8'));
  await client.query('SET search_path=waraq_private,pg_catalog');
  for(const c of new Set(templates.map(t=>t.category)))await client.query('INSERT INTO categories VALUES($1,1)',[c]);
  for(const t of templates)await client.query('INSERT INTO templates VALUES($1,$2,1)',[t.id,t.category]);
  return {pool,pg:{query:(...args)=>client.query(...args),exec:sql=>client.query(sql),async close(){client.release();await pool.end();}}};
 }catch(error){client.release();await pool.end();throw error;}
}
const tiny='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';

test('rental approval, authorization, media, expiry, catalog and migration',async t=>{
 const {pg,pool}=await (process.env.WARAQ_RENTAL_TEST_DATABASE_URL?nativeFixture():trialDatabase());t.after(()=>pg.close());
 const storage=memoryStorage();
 const handle=createTrialHandler({pool,storage,env});
 const legacy=createTrialHandler({pool,storage,env:{...env,WARAQ_RENTALS:'false'}});
 async function req(path,session='',data,method=data?'POST':'GET',handler=handle){
  const response=await handler(new Request(origin+path,{method,headers:{cookie:session,origin,'content-type':'application/json'},body:data?JSON.stringify(data):undefined}));
  const body=response.headers.get('content-type')?.includes('json')?await response.json():await response.arrayBuffer();
  return {status:response.status,body,cache:response.headers.get('cache-control'),cookie:response.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ')};
 }
 const ok=async(...args)=>{
  const result=await req(...args);
  assert.equal(result.status,200,JSON.stringify(result.body));
  return result.body;
 };
 const register=email=>req('/api/auth/register','',{email,password:'local-test-password'});
 const [owner,other,admin]=await Promise.all(['owner','other','admin'].map(name=>register(name+'@trial.test')));
 const who=owner.cookie, outsider=other.cookie, staff=admin.cookie;
 assert.ok(who&&outsider&&staff);
 await pg.query("UPDATE users SET role='admin' WHERE id=$1",[admin.body.user.id]);
 const draft={templateId:'minimal-signature',data:{title:'دعوة اختبار',startAt:'2030-03-10T10:00:00.000Z',timeZone:'America/Los_Angeles'},settings:{privacy:'public',rsvpEnabled:true,maxGuests:3}};
 const legacyInvite=(await ok('/api/invitations',who,draft,'POST',legacy)).invitation;
 await ok('/api/invitations/'+legacyInvite.id+'/publish',who,{},'POST',legacy);
 await pg.exec(await readFile(new URL('../../supabase/migrations/0007_rentals.sql',import.meta.url),'utf8'));
 await ok('/api/public/'+legacyInvite.slug);
 assert.equal((await ok('/api/catalog')).hiddenTemplates.length,0);

 const invite=(await ok('/api/invitations',who,{...draft,data:{...draft.data,images:[{src:tiny}],audio:{track:'upload',src:'data:audio/wav;base64,'+Buffer.from('RIFF0000WAVE0123456789').toString('base64'),volume:.5,loop:false,rightsConfirmed:true}},settings:{...draft.settings,privacy:'pin',pin:'1234'}})).invitation;
 const ownerPath='/api/invitations/'+invite.id;
 const asset=invite.data.images[0].src;
 const audio=invite.data.audio.src;
 assert.equal(invite.slug,null);
 const draftSlug=(await pg.query('SELECT slug FROM invitations WHERE id=$1',[invite.id])).rows[0].slug;
 const request={days:3,note:'التفعيل بعد التأكد من التسوية',expectedUpdatedAt:invite.updatedAt};
 assert.equal((await req('/i/'+draftSlug)).status,404);
 assert.equal((await req(asset)).status,404);
 assert.equal((await req(ownerPath+'/publish',who,{})).status,409);
 const direct=await pool.connect();
 try{
  const ownDB=postgresDatabase(direct,{headers:{cookie:who}},{rentals:true,storage});
  await assert.rejects(()=>ownDB.run("UPDATE invitations SET status='published' WHERE id=?",invite.id),{code:'P4201'});
  assert.equal(await ownDB.one("SELECT * FROM waraq_private.admin_rental_accounts('',30)"),undefined);
  await assert.rejects(()=>ownDB.one('SELECT waraq_private.decide_rental(?,?,?,?)',randomUUID(),'approved','fake','1234567890123456789012'),{code:'P4204'});
 }finally{direct.release();}
 for(const path of ['/api/admin','/api/admin/rental-overview','/api/admin/rentals','/api/admin/accounts','/api/admin/all-invitations','/api/admin/custom-templates']){
  assert.equal((await req(path)).status,401);
  assert.equal((await req(path,outsider)).status,403);
 }
 assert.equal((await req(ownerPath+'/rent',outsider,request)).status,404);
 for(const days of [0,366,2.5,'3'])assert.equal((await req(ownerPath+'/rent',who,{...request,days})).status,400);
 assert.equal((await req(ownerPath+'/rent',who,{...request,expectedUpdatedAt:'obsolete'})).status,409);
 const submissions=await Promise.all([ok(ownerPath+'/rent',who,request),ok(ownerPath+'/rent',who,request)]);
 const rentalId=submissions[0].id;assert.equal(submissions[1].id,rentalId);
 const reviewPath='/api/admin/rentals/'+rentalId;
 assert.equal((await ok('/api/admin/rentals',staff)).items[0].note,request.note);
 assert.equal((await ok(reviewPath,staff)).time_zone,'America/Los_Angeles');
 assert.equal((await ok(ownerPath,who)).invitation.rental.state,'pending');
 assert.equal((await req(ownerPath,who,{expectedUpdatedAt:invite.updatedAt,data:{...draft.data,title:'edited'}},'PATCH')).status,409);
 assert.equal((await req(ownerPath,who,{confirm:invite.id},'DELETE')).status,409);
 assert.equal((await req(reviewPath,outsider,{state:'approved',settlementConfirmed:true,settlementReference:'fake'})).status,403);
 for(const data of [{state:'approved'},{state:'approved',settlementReference:'ref-only'},{state:'approved',settlementConfirmed:true}]){
  assert.equal((await req(reviewPath,staff,data)).status,400);
 }
 assert.equal((await req('/api/public/'+draftSlug)).status,404);
 assert.equal(Number((await ok('/api/admin/rental-overview',staff)).pending),1);

 await pg.exec("SET TIME ZONE 'America/Los_Angeles'");
 const decision={state:'approved',settlementConfirmed:true,settlementReference:'MANUAL-001'};
 const decisions=await Promise.all([ok(reviewPath,staff,decision),ok(reviewPath,staff,decision)]);
 assert.deepEqual(decisions,[{state:'approved'},{state:'approved'}]);
 assert.equal((await req(reviewPath,staff,{state:'rejected'})).status,409);
 const rental=(await pg.query('SELECT extract(epoch FROM ends_at-decided_at)::int AS seconds FROM rental_requests WHERE id=$1',[rentalId])).rows[0];
 assert.equal(rental.seconds,3*86400);
 const dst=await pg.query("SELECT extract(epoch FROM ('2027-03-13T12:00 America/Los_Angeles'::timestamptz + 3 * interval '24 hours' - '2027-03-13T12:00 America/Los_Angeles'::timestamptz))::int AS seconds");
 assert.equal(dst.rows[0].seconds,3*86400);
 const active=(await ok(ownerPath,who)).invitation;
 assert.ok(active.slug&&active.slug!==draftSlug&&active.linkActive);
 assert.equal((await ok('/api/invitations',who)).invitations.find(i=>i.id===invite.id).linkActive,true);
 assert.equal((await req('/api/public/'+draftSlug)).status,404);
 const html=await req('/i/'+active.slug);
 assert.equal(html.status,200);assert.match(html.cache,/no-store/);
 const guest='/api/public/'+active.slug;
 assert.equal((await req(guest)).status,401);
 assert.equal((await req(asset)).status,404);
 const unlock=await req(guest+'/unlock','',{pin:'1234'});
 assert.equal(unlock.status,200);
 assert.ok(!Object.hasOwn(unlock.body.invitation,'rental'));
 assert.equal((await req(asset,unlock.cookie)).status,200);
 assert.equal((await req(audio,unlock.cookie)).status,200);
 const reply={name:'Guest',attending:true,count:1,submissionId:'rental-reply-0001'};
 await ok(guest+'/rsvp',unlock.cookie,reply);
 assert.equal((await req(ownerPath,who,{expectedUpdatedAt:active.updatedAt,data:draft.data},'PATCH')).status,409);

 await pg.query('UPDATE invitations SET rental_until=statement_timestamp() WHERE id=$1',[invite.id]);
 for(const path of [guest,'/i/'+active.slug,asset,audio]){
  assert.equal((await req(path,unlock.cookie)).status,404,path);
  assert.equal((await req(path,who)).status,path===asset||path===audio?200:404,path);
 }
 assert.equal((await req(guest+'/unlock','',{pin:'1234'})).status,404);
 assert.equal((await req(guest+'/rsvp',unlock.cookie,reply)).status,404);
 assert.equal((await req(guest+'/report',unlock.cookie,{reason:'report after expiry'})).status,404);
 assert.equal((await ok(ownerPath,who)).invitation.slug,null);
 assert.equal((await ok('/api/invitations',who)).invitations.find(i=>i.id===invite.id).linkActive,false);
 const renewal=await ok(ownerPath+'/rent',who,{...request,expectedUpdatedAt:active.updatedAt});
 await ok('/api/admin/rentals/'+renewal.id,staff,decision);
 const renewed=(await ok(ownerPath,who)).invitation;
 assert.notEqual(renewed.slug,active.slug);
 assert.equal((await req('/i/'+active.slug,unlock.cookie)).status,404);
 assert.equal((await req('/api/public/'+renewed.slug,unlock.cookie)).status,401);
 await ok(ownerPath+'/archive',who,{});
 assert.equal((await req('/i/'+renewed.slug)).status,404);
 const declined=await ok(ownerPath+'/rent',who,{...request,expectedUpdatedAt:(await ok(ownerPath,who)).invitation.updatedAt});
 const conflicting=await Promise.all([
  req('/api/admin/rentals/'+declined.id,staff,{state:'rejected'}),
  req('/api/admin/rentals/'+declined.id,staff,decision)
 ]);
 assert.deepEqual(conflicting.map(result=>result.status).sort(),[200,409]);
 const winner=conflicting.find(result=>result.status===200).body.state;
 assert.equal((await ok(ownerPath,who)).invitation.rental.state,winner);
 assert.equal((await ok('/api/admin/rentals?state=all&limit=1',staff)).pagination.hasMore,true);
 const accounts=(await ok('/api/admin/accounts',staff)).items;
 assert.equal(Number(accounts.find(a=>a.email==='owner@trial.test').invitation_count),2);
 assert.equal(Number(accounts.find(a=>a.email==='other@trial.test').invitation_count),0);
 assert.ok(accounts.every(a=>!Object.hasOwn(a,'password')));
 assert.equal((await ok('/api/admin/all-invitations?account='+owner.body.user.id,staff)).items.length,2);

 const custom={base:draft.templateId,titleAr:'ليل الورد',titleEn:'Rose Night',background:'#281a3c',accent:'#f0c994'};
 assert.equal((await req('/api/admin/custom-templates',outsider,custom)).status,403);
 const {id}=await ok('/api/admin/custom-templates',staff,custom);
 assert.equal((await ok('/api/catalog')).custom.length,0);
 assert.equal((await req('/api/invitations',who,{...draft,templateId:id})).status,400);
 await ok('/api/admin/templates/'+id,staff,{published:true},'PATCH');
 assert.equal((await ok('/api/catalog')).custom[0].title_ar,custom.titleAr);
 const variant=(await ok('/api/invitations',who,{...draft,templateId:id})).invitation;
 assert.equal(variant.custom.id,id);
 const variantRequest=await ok('/api/invitations/'+variant.id+'/rent',who,{days:1,expectedUpdatedAt:variant.updatedAt});
 await ok('/api/admin/rentals/'+variantRequest.id,staff,decision);
 const variantLive=(await ok('/api/invitations/'+variant.id,who)).invitation;
 assert.equal((await ok('/api/public/'+variantLive.slug)).invitation.custom.background,custom.background);
 await ok('/api/admin/templates/'+id,staff,{published:false},'PATCH');
 assert.equal((await ok('/api/invitations/'+variant.id,who)).invitation.custom.id,id);
 assert.equal((await req('/api/public/'+variantLive.slug)).status,404);

 const socialPath='/api/admin/social/instagram';
 assert.equal((await req(socialPath,outsider,{url:'https://instagram.com/waraq'},'PATCH')).status,403);
 for(const url of ['javascript:alert(1)','https://instagram.com.evil.test/waraq','https://instagram.com@evil.test/','https://instagram.com:444/waraq']){
  assert.equal((await req(socialPath,staff,{url},'PATCH')).status,400);
 }
 await ok(socialPath,staff,{url:'https://www.instagram.com/waraq'},'PATCH');
 assert.deepEqual((await ok('/api/catalog')).social,[{platform:'instagram',url:'https://www.instagram.com/waraq'}]);
 await ok(socialPath,staff,{url:''},'PATCH');
 assert.deepEqual((await ok('/api/catalog')).social,[]);
 const competing=(await ok('/api/invitations',who,draft)).invitation;
 const competingPath='/api/invitations/'+competing.id;
 const race=await Promise.all([
  req(competingPath+'/rent',who,{days:3,expectedUpdatedAt:competing.updatedAt}),
  req(competingPath,who,{expectedUpdatedAt:competing.updatedAt,data:{...draft.data,title:'Concurrent edit'}},'PATCH')
 ]);
 assert.deepEqual(race.map(result=>result.status).sort(),[200,409]);
 const final=(await ok(competingPath,who)).invitation;
 if(race[0].status===200){assert.equal(final.rental.state,'pending');assert.equal(final.data.title,draft.data.title);}
 else{assert.equal(final.rental,null);assert.equal(final.data.title,'Concurrent edit');}
 const notices=await pg.query("SELECT count(*)::int AS n FROM audit WHERE action='rental_approved'");
 assert.equal(notices.rows[0].n,winner==='approved'?4:3);
});
