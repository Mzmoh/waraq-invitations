import test from 'node:test';
import assert from 'node:assert/strict';
import {clientAddress,trustedProxies,validateProduction} from '../server/production-config.mjs';
import {resendConfiguration} from '../server/mail-resend.mjs';
import {createApp} from '../server/index.mjs';
import {templates} from '../public/templates/index.js';
test('proxy identity trusts exact upstream only and ignores forged forwarded headers',()=>{
 const trusted=trustedProxies('172.30.0.2,::1');
 const req={socket:{remoteAddress:'::ffff:172.30.0.2'},headers:{'x-waraq-client-ip':'198.51.100.4','x-forwarded-for':'1.2.3.4'}};
 assert.equal(clientAddress(req,trusted),'198.51.100.4');
 req.socket.remoteAddress='198.51.100.9';assert.equal(clientAddress(req,trusted),'198.51.100.9');
 req.socket.remoteAddress='172.30.0.2';req.headers['x-waraq-client-ip']='1.2.3.4,5.6.7.8';assert.equal(clientAddress(req,trusted),'172.30.0.2');
 assert.throws(()=>trustedProxies('0.0.0.0/0'));assert.throws(()=>trustedProxies('proxy.example'));
});
test('production refuses insecure origins/cookies and public or memory databases',()=>{
 const config={NODE_ENV:'production',PUBLIC_ORIGIN:'https://waraq.test',COOKIE_SECURE:'true'},paths={database:'var/release.sqlite',publicDir:'public'};
 validateProduction(config,paths);
 for(const change of [{PUBLIC_ORIGIN:'http://waraq.test'},{PUBLIC_ORIGIN:'https://waraq.test/path'},{COOKIE_SECURE:'false'},{PUBLIC_ORIGIN:''}])assert.throws(()=>validateProduction({...config,...change},paths));
 assert.throws(()=>validateProduction(config,{...paths,database:':memory:'}));assert.throws(()=>validateProduction(config,{...paths,database:'public/private.sqlite'}));
 assert.throws(()=>validateProduction(config,{...paths,database:'public/..hidden/private.sqlite'}));
});
test('real Resend API adapter constructs safe bilingual mail and checks provider receipts',async()=>{
 const calls=[],env={RESEND_API_KEY:'test-only-key',MAIL_FROM:'Waraq <mail@waraq.test>',PUBLIC_ORIGIN:'https://waraq.test'};
 const config=resendConfiguration(env,{fetcher:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({id:'mock-provider-id'}),{status:200})}});
 const link='https://waraq.test/auth?mode=reset#token=private-test-token';
 assert.deepEqual(await config.deliver({to:'user@test.test',purpose:'reset',url:link}),{id:'mock-provider-id'});
 assert.equal(calls[0].url,'https://api.resend.com/emails');const payload=JSON.parse(calls[0].options.body);assert.deepEqual(payload.to,['user@test.test']);assert.ok(payload.text.includes(link));assert.ok(!calls[0].options.headers['Idempotency-Key'].includes('private-test-token'));
 await assert.rejects(config.deliver({to:'user@test.test',purpose:'reset',url:'https://attacker.test/auth#token=bad'}));
 const failed=resendConfiguration(env,{fetcher:async()=>new Response('{}',{status:401})});await assert.rejects(failed.deliver({to:'user@test.test',purpose:'verify',url:'https://waraq.test/auth?mode=verify#token=private-test-token'}));
 assert.throws(()=>resendConfiguration({...env,MAIL_FROM:'bad\r\nBcc: x@test.test'}));
});
test('RSVP limits stay per client behind the configured proxy',async t=>{
 const previous=process.env.TRUSTED_PROXY_IPS;process.env.TRUSTED_PROXY_IPS='127.0.0.1';let app;
 try{app=await createApp({database:':memory:'})}finally{if(previous===undefined)delete process.env.TRUSTED_PROXY_IPS;else process.env.TRUSTED_PROXY_IPS=previous}
 const {server}=app;await new Promise(ok=>server.listen(0,'127.0.0.1',ok));t.after(()=>new Promise(ok=>{server.close(ok);server.closeAllConnections()}));
 const base='http://127.0.0.1:'+server.address().port;
 const request=async(path,data,cookie='',ip='198.51.100.1')=>fetch(base+'/api'+path,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,'X-Waraq-Client-IP':ip,'X-Forwarded-For':'10.0.0.1'},body:JSON.stringify(data)});
 const registered=await request('/auth/register',{email:'proxy@qa.test',password:'proxy-test-password'}),cookie=registered.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
 const created=await request('/invitations',{templateId:templates[0].id,data:{title:'Proxy rate test',startAt:'2035-01-01T12:00:00Z'},settings:{privacy:'public',rsvpEnabled:true,maxGuests:2}},cookie),inv=(await created.json()).invitation;
 assert.equal((await request('/invitations/'+inv.id+'/publish',{},cookie)).status,200);
 const reply={name:'Guest',attending:true,count:1};for(let i=0;i<8;i++)assert.equal((await request('/public/'+inv.slug+'/rsvp',reply)).status,200);
 assert.equal((await request('/public/'+inv.slug+'/rsvp',reply)).status,429);
 assert.equal((await request('/public/'+inv.slug+'/rsvp',reply,'','198.51.100.2')).status,200);
});
