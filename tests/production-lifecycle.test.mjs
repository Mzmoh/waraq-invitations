import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server/index.mjs';
import {templates} from '../public/templates/index.js';
import {validateData} from '../server/validation.mjs';

test('reject impossible calendar dates without normalizing the event',()=>{
  for(const startAt of ['2027-02-29T12:00:00Z','2027-02-31T12:00:00Z','2028-04-31T12:00:00Z'])assert.throws(()=>validateData({startAt}));
  assert.equal(validateData({startAt:'2028-02-29T12:00:05Z'}).startAt,'2028-02-29T12:00:05.000Z');
});

test('copy/delete/export ownership and guest submission idempotency',async t=>{
  const {server,db}=await createApp({database:':memory:'});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const base='http://127.0.0.1:'+server.address().port;
  const req=async(path,method='GET',body,cookie='')=>{
    const r=await fetch(base+'/api'+path,{method,headers:{'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined});
    const text=await r.text();return {status:r.status,cookie:r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; '),data:r.headers.get('Content-Type')?.includes('json')?JSON.parse(text):text};
  };
  const a=await req('/auth/register','POST',{email:'a@lifecycle.test',password:'secure-test-password'});
  const b=await req('/auth/register','POST',{email:'b@lifecycle.test',password:'secure-test-password'});
  const created=await req('/invitations','POST',{templateId:templates[0].id,data:{title:'Lifecycle',startAt:'2028-01-01T12:00:01Z'},settings:{privacy:'pin',pin:'1234',rsvpEnabled:true,maxGuests:3}},a.cookie);
  assert.equal(created.status,200);const inv=created.data.invitation;
  assert.equal((await req('/invitations/'+inv.id,'PATCH',{data:{title:'Missing version'}},a.cookie)).status,428);
  assert.equal((await req('/invitations/'+inv.id,'PATCH',{expectedUpdatedAt:'2000-01-01T00:00:00.000Z',data:{title:'Stale version'}},a.cookie)).status,409);
  assert.equal((await req('/invitations/'+inv.id+'/copy','POST',{pin:'4567'},b.cookie)).status,404);
  assert.equal((await req('/invitations/'+inv.id+'/copy','POST',{},a.cookie)).status,400);
  const copied=await req('/invitations/'+inv.id+'/copy','POST',{pin:'4567'},a.cookie);
  assert.equal(copied.status,200);assert.equal(copied.data.invitation.status,'draft');assert.notEqual(copied.data.invitation.slug,inv.slug);
  await req('/invitations/'+copied.data.invitation.id+'/publish','POST',{},a.cookie);
  assert.equal((await req('/public/'+copied.data.invitation.slug+'/unlock','POST',{pin:'4567'})).status,200);
  await req('/invitations/'+inv.id+'/publish','POST',{},a.cookie);
  const list=await req('/invitations','GET',undefined,a.cookie);assert.equal(list.data.invitations.find(i=>i.id===inv.id).linkActive,true);
  const unlocked=await req('/public/'+inv.slug+'/unlock','POST',{pin:'1234'});
  const answer={name:'=HYPERLINK("https://example.test")',attending:true,count:2,submissionId:'12345678-1234-1234-1234-123456789012'};
  for(let i=0;i<2;i++)assert.equal((await req('/public/'+inv.slug+'/rsvp','POST',answer,unlocked.cookie)).status,200);
  const replies=await req('/invitations/'+inv.id+'/responses','GET',undefined,a.cookie);assert.equal(replies.data.responses.length,1);
  assert.equal((await req('/invitations/'+inv.id+'/responses.csv','GET',undefined,b.cookie)).status,404);
  const csv=await req('/invitations/'+inv.id+'/responses.csv','GET',undefined,a.cookie);assert.match(csv.data,/'=HYPERLINK/);
  await req('/public/'+inv.slug+'/report','POST',{reason:'Test report'},unlocked.cookie);
  const assetId='11111111-1111-4111-8111-111111111111',uid=db.prepare('SELECT id FROM users WHERE email=?').get('a@lifecycle.test').id;
  db.prepare('INSERT INTO assets VALUES (?,?,?,?)').run(assetId,uid,'image/png',Buffer.from('retained Undo image'));
  db.prepare('INSERT INTO managed_assets VALUES (?)').run(assetId);
  assert.equal((await req('/invitations/'+inv.id,'DELETE',{confirm:inv.id},b.cookie)).status,404);
  assert.equal((await req('/invitations/'+inv.id,'DELETE',{},a.cookie)).status,400);
  assert.equal((await req('/invitations/'+inv.id,'DELETE',{confirm:inv.id},a.cookie)).status,200);
  assert.ok(db.prepare('SELECT id FROM assets WHERE id=?').get(assetId),'Deletion must preserve other invitation Undo assets');
  assert.equal((await req('/public/'+inv.slug,'GET',undefined,unlocked.cookie)).status,404);
});
