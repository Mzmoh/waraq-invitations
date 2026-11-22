import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server/index.mjs';
import {templates} from '../public/templates/index.js';

test('HTTP ownership, privacy, assets, concurrency and administration',async t=>{
  const {server,db}=await createApp({database:':memory:'});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  async function request(path,{method='GET',data,cookie,origin}={}) {
    const response=await fetch(base+path,{method,headers:{
      ...(data?{'Content-Type':'application/json'}:{}),
      ...(cookie?{Cookie:cookie}:{}),...(origin?{Origin:origin}:{})
    },body:data?JSON.stringify(data):undefined});
    const text=await response.text();
    return {status:response.status,body:response.headers.get('content-type')?.includes('json')?JSON.parse(text):text,cookie:response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')};
  }
  const register=async email=>request('/api/auth/register',{method:'POST',data:{email,password:'safely-long-password'}});
  const owner=await register('owner@qa.test'),other=await register('other@qa.test');
  assert.equal(owner.status,200);assert.equal(other.status,200);
  let invitation;
  const tiny='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
  await t.test('drafts require authentication and save image references',async()=>{
    const data={templateId:templates[0].id,data:{title:'QA event',startAt:'2027-12-01T12:00:05.000Z',timeZone:'Asia/Baghdad',images:[{src:tiny}]}};
    assert.equal((await request('/api/invitations',{method:'POST',data})).status,401);
    const response=await request('/api/invitations',{method:'POST',cookie:owner.cookie,data});
    assert.equal(response.status,200);
    invitation=response.body.invitation;
    assert.match(invitation.data.images[0].src,/^\/api\/assets\//);
    assert.equal((await request('/api/public/'+invitation.slug)).status,404);
    assert.equal((await request(invitation.data.images[0].src)).status,404);
    assert.equal((await request(invitation.data.images[0].src,{cookie:owner.cookie})).status,200);
  });
  await t.test('cross-owner access, edit and responses are denied',async()=>{
    for(const suffix of ['', '/responses'])assert.equal((await request('/api/invitations/'+invitation.id+suffix,{cookie:other.cookie})).status,404);
    assert.equal((await request('/api/invitations/'+invitation.id,{method:'PATCH',cookie:other.cookie,data:{data:{title:'hijacked'}}})).status,404);
  });
  await t.test('publication allows anonymous reads and rate-limited RSVP',async()=>{
    const settings={privacy:'unlisted',rsvpEnabled:true,maxGuests:2};
    assert.equal((await request('/api/invitations/'+invitation.id,{method:'PATCH',cookie:owner.cookie,data:{settings}})).status,200);
    assert.equal((await request('/api/invitations/'+invitation.id+'/publish',{method:'POST',cookie:owner.cookie,data:{}})).status,200);
    const guest=await request('/api/public/'+invitation.slug);
    assert.equal(guest.status,200);assert.equal(guest.body.invitation.id,undefined);
    assert.equal((await request(invitation.data.images[0].src)).status,200);
    const rsvp={name:'Guest',attending:true,count:2};
    assert.equal((await request('/api/public/'+invitation.slug+'/rsvp',{method:'POST',data:{...rsvp,count:3}})).status,400);
    for(let i=0;i<8;i++)assert.equal((await request('/api/public/'+invitation.slug+'/rsvp',{method:'POST',data:rsvp})).status,200);
    assert.equal((await request('/api/public/'+invitation.slug+'/rsvp',{method:'POST',data:rsvp})).status,429);
    assert.equal((await request('/api/invitations/'+invitation.id+'/responses',{cookie:owner.cookie})).body.responses.length,8);
    assert.equal((await request('/api/public/'+invitation.slug+'/responses')).status,404);
  });
  await t.test('PIN protects metadata, API and image, and changes revoke old grants',async()=>{
    await request('/api/invitations/'+invitation.id,{method:'PATCH',cookie:owner.cookie,data:{settings:{privacy:'pin',pin:'1234'}}});
    assert.equal((await request('/api/public/'+invitation.slug)).status,401);
    assert.equal((await request(invitation.data.images[0].src)).status,404);
    const unlocked=await request('/api/public/'+invitation.slug+'/unlock',{method:'POST',data:{pin:'1234'}});
    assert.equal(unlocked.status,200);
    assert.equal((await request(invitation.data.images[0].src,{cookie:unlocked.cookie})).status,200);
    await request('/api/invitations/'+invitation.id,{method:'PATCH',cookie:owner.cookie,data:{settings:{pin:'4321'}}});
    assert.equal((await request('/api/public/'+invitation.slug,{cookie:unlocked.cookie})).status,401);
    assert.ok(!(await request('/i/'+invitation.slug)).body.includes('QA event'));
  });
  await t.test('concurrent edits allow one winning version',async()=>{
    const current=(await request('/api/invitations/'+invitation.id,{cookie:owner.cookie})).body.invitation;
    const responses=await Promise.all(['First edit','Second edit'].map(title=>request('/api/invitations/'+invitation.id,{method:'PATCH',cookie:owner.cookie,data:{expectedUpdatedAt:current.updatedAt,data:{...current.data,title}}})));
    assert.deepEqual(responses.map(response=>response.status).sort(),[200,409]);
  });
  await t.test('cross-site writes and invalid assets or URLs are rejected',async()=>{
    assert.equal((await request('/api/invitations',{method:'POST',cookie:owner.cookie,origin:'https://untrusted.test',data:{}})).status,403);
    assert.equal((await request('/api/assets',{method:'POST',cookie:owner.cookie,data:{dataUrl:'data:image/svg+xml;base64,PHN2Zz4='}})).status,400);
    assert.equal((await request('/api/invitations/'+invitation.id,{method:'PATCH',cookie:owner.cookie,data:{data:{title:'Unsafe',mapsUrl:'javascript:alert(1)'}}})).status,400);
  });
  await t.test('admin authorization and archive revoke published reads',async()=>{
    assert.equal((await request('/api/admin',{cookie:owner.cookie})).status,403);
    db.prepare("UPDATE users SET role='admin' WHERE id=?").run(owner.body.user.id);
    assert.equal((await request('/api/admin',{cookie:owner.cookie})).status,200);
    assert.equal((await request('/api/admin/templates/'+invitation.templateId,{method:'PATCH',cookie:owner.cookie,data:{published:false}})).status,200);
    assert.equal((await request('/api/public/'+invitation.slug)).status,404);
    await request('/api/admin/templates/'+invitation.templateId,{method:'PATCH',cookie:owner.cookie,data:{published:true}});
    assert.equal((await request('/api/invitations/'+invitation.id+'/archive',{method:'POST',cookie:owner.cookie,data:{}})).status,200);
    assert.equal((await request('/api/public/'+invitation.slug)).status,404);
    assert.equal((await request(invitation.data.images[0].src)).status,404);
  });
});

