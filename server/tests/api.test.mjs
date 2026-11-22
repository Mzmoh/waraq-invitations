import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createApp} from '../index.mjs'
import {hashPassword} from '../store.mjs'

test('persistent invitation service', async t=>{
  const temp=await mkdtemp(join(tmpdir(),'invites-api-'))
  const publicDir=join(temp,'public'); await mkdir(publicDir)
  await writeFile(join(publicDir,'index.html'),'<html><head><title>Studio</title></head><body>studio</body></html>')
  const config={database:join(temp,'data.sqlite'),templates:[{id:'navy',category:'wedding',thumbnail:'/thumb.svg'}],publicDir}
  let app=await createApp(config)
  let url
  async function listen() {
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve))
    url='http://127.0.0.1:'+app.server.address().port
  }
  const close=()=>new Promise(resolve=>app.server.close(resolve))
  await listen()
  t.after(async()=>{await close(); await rm(temp,{recursive:true,force:true})})
  async function call(path,method='GET',body,session='',more={}) {
    const r=await fetch(url+path,{method,headers:{'content-type':'application/json',cookie:session,...more},body:body===undefined?undefined:JSON.stringify(body)})
    let value
    if(r.headers.get('content-type')?.includes('json')) value=await r.json()
    else value=await r.text()
    return {status:r.status,body:value,cookie:r.headers.get('set-cookie')?.split(';')[0],headers:r.headers}
  }
  const pw='rental-safe-demo-271'
  let owner,other,invite,asset,grant,admin,rid
  const data={title:'زفاف ليلى',groom:'علي',bride:'ليلى',startAt:'2028-04-21T12:24:59Z',timeZone:'Asia/Baghdad'}
  const pic='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7mQAAAAASUVORK5CYII='
  const own=()=>'/api/invitations/'+invite.id
  const guest=()=>'/api/public/'+invite.slug
  await t.test('registration, session and authenticated routes',async()=>{
    assert.equal((await call('/api/invitations')).status,401)
    owner=(await call('/api/auth/register','POST',{email:'one@test.local',password:pw})).cookie
    other=(await call('/api/auth/register','POST',{email:'two@test.local',password:pw})).cookie
    assert.ok(owner); assert.ok(other)
    assert.equal((await call('/api/me','GET',undefined,owner)).body.user.role,'creator')
    assert.equal((await call('/api/auth/login','POST',{email:'one@test.local',password:'wrong-pass'})).status,401)
    assert.equal((await call('/api/auth/logout','POST',{},owner,{origin:'https://other.invalid'})).status,403)
  })
  await t.test('upload raster, protect unreferenced file, reject other owner attachment',async()=>{
    const upload=await call('/api/assets','POST',{dataUrl:pic},owner)
    assert.equal(upload.status,200); asset=upload.body.url
    assert.equal((await call(asset)).status,404)
    assert.equal((await call(asset,'GET',undefined,owner)).headers.get('content-type'),'image/png')
    data.images=[{src:asset,alt:'portrait',x:45,y:52,zoom:1.3}]
    assert.equal((await call('/api/invitations','POST',{templateId:'navy',data},other)).status,400)
  })
  await t.test('draft does not appear to guests, enforce owner isolation',async()=>{
    const r=await call('/api/invitations','POST',{templateId:'navy',data,settings:{rsvpEnabled:true,maxGuests:3}},owner)
    assert.equal(r.status,200); invite=r.body.invitation
    assert.equal((await call(guest())).status,404)
    assert.equal((await call(own(),'PATCH',{data},other)).status,404)
    assert.equal((await call(own()+'/responses','GET',undefined,other)).status,404)
    assert.equal((await call('/api/admin','GET',undefined,owner)).status,403)
  })
  await t.test('publish at stable slug, guest can read only public fields',async()=>{
    assert.equal((await call(own()+'/publish','POST',{},owner)).status,200)
    const r=await call(guest())
    assert.equal(r.body.invitation.data.startAt,'2028-04-21T12:24:59.000Z')
    assert.equal(r.body.invitation.data.timeZone,'Asia/Baghdad')
    assert.ok(!('owner'in r.body.invitation)); assert.ok(!('responses'in r.body.invitation))
    assert.equal((await call(asset)).status,200)
    const page=await call('/i/'+invite.slug)
    assert.equal(page.status,200); assert.match(page.headers.get('x-robots-tag'),/noindex/)
    assert.ok(!page.body.includes(data.title))
  })
  await t.test('rsvp, guest limit, decline, private list and persistent throttle',async()=>{
    const answer={name:'guest',attending:true,count:2,comment:'thank you'}
    assert.equal((await call(guest()+'/rsvp','POST',{...answer,count:4})).status,400)
    assert.equal((await call(guest()+'/rsvp','POST',{...answer,attending:false})).status,200)
    for(let n=0;n<7;n++) assert.equal((await call(guest()+'/rsvp','POST',answer)).status,200)
    assert.equal((await call(guest()+'/rsvp','POST',answer)).status,429)
    const list=(await call(own()+'/responses','GET',undefined,owner)).body.responses
    assert.equal(list.length,8); assert.ok(list.some(r=>!r.attending&&r.count===0))
  })
  await t.test('report and server-authorized admin controls',async()=>{
    assert.equal((await call(guest()+'/report','POST',{reason:'Review invitation'})).status,200)
    app.db.prepare("INSERT INTO users VALUES ('a','admin@test.local',?,'admin')").run(await hashPassword(pw))
    admin=(await call('/api/auth/login','POST',{email:'admin@test.local',password:pw})).cookie
    rid=(await call('/api/admin','GET',undefined,admin)).body.reports[0].id
    assert.equal((await call('/api/admin/reports/'+rid,'PATCH',{status:'resolved'},admin)).status,200)
    assert.equal((await call('/api/admin/categories/wedding','PATCH',{published:false},admin)).status,200)
    assert.equal((await call(guest())).status,404)
    assert.equal((await call('/api/catalog')).body.hiddenCategories[0],'wedding')
    assert.equal((await call('/api/admin/categories/wedding','PATCH',{published:true},admin)).status,200)
  })
  await t.test('PIN protects data and photos, previous PIN grant invalidated upon rotation',async()=>{
    const r=await call(own(),'PATCH',{settings:{privacy:'pin',pin:'4529'}},owner)
    assert.equal(r.status,200); assert.ok(!('pin'in r.body.invitation.settings))
    assert.equal((await call(guest())).body.code,'PIN_REQUIRED')
    assert.equal((await call(asset)).status,404)
    assert.equal((await call(guest()+'/unlock','POST',{pin:'9431'})).status,401)
    const ok=await call(guest()+'/unlock','POST',{pin:'4529'})
    grant=ok.cookie; assert.equal(ok.status,200)
    assert.equal((await call(asset,'GET',undefined,grant)).status,200)
    assert.equal((await call(own(),'PATCH',{settings:{pin:'4567'}},owner)).status,200)
    assert.equal((await call(guest(),'GET',undefined,grant)).status,401)
  })
  await t.test('restart keeps invitations, owner session and RSVP records',async()=>{
    await close(); app=await createApp(config); await listen()
    assert.equal((await call(own(),'GET',undefined,owner)).body.invitation.responseCount,8)
    assert.equal((await call(own()+'/archive','POST',{},owner)).status,200)
    assert.equal((await call(guest())).status,404)
    assert.equal((await call('/i/'+invite.slug)).status,404)
    assert.equal((await call(asset)).status,404)
  })
  await t.test('invalid dates, URLs and inline upload format rejected; logout revokes session',async()=>{
    for(const bad of [{timeZone:'Invalid/Zone'},{mapsUrl:'http://maps.google.com'},{images:[{src:'data:text/html,test'}]}]) {
      assert.equal((await call(own(),'PATCH',{data:{...data,...bad}},owner)).status,400)
    }
    assert.equal((await call('/api/auth/logout','POST',{},owner)).status,200)
    assert.equal((await call(own(),'GET',undefined,owner)).status,401)
  })
})

