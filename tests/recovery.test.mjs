import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from '../server/store.mjs';
import {localDatabase} from '../server/database.mjs';
import {createAuth,passwordMatches} from '../server/auth.mjs';
import {recoveryHandler} from '../server/account-recovery.mjs';
test('recovery tokens are hashed, expire, are single-use and revoke sessions',async()=>{
 const sql=openStore(':memory:',[]),db=localDatabase(sql);try{
 const auth=await createAuth(db);await db.run('INSERT INTO users(id,email,password) VALUES (?,?,?)','u','test@reset.test',await auth.hashPassword('old-password'));
 await db.run('INSERT INTO sessions VALUES (?,?,?)','session','u',Date.now()+60000);
 const mails=[],handler=recoveryHandler(db,auth,{origin:'https://waraq.test',deliver:async m=>mails.push(m)});
 const req={headers:{},socket:{remoteAddress:'test'}};
 assert.deepEqual(await handler(req,'/api/auth/forgot',{email:'missing@reset.test'}),await handler(req,'/api/auth/forgot',{email:'test@reset.test'}));
 assert.equal(mails.length,1);const token=new URLSearchParams(new URL(mails[0].url).hash.slice(1)).get('token');
 assert.notEqual((await db.one('SELECT hash FROM account_tokens')).hash,token);
 await handler(req,'/api/auth/reset',{token,password:'new-password'});
 assert.ok(await passwordMatches('new-password',(await db.one('SELECT password FROM users')).password));
 assert.equal((await db.one('SELECT count(*) n FROM sessions')).n,0);
 await assert.rejects(handler(req,'/api/auth/reset',{token,password:'another-password'}),/invalid|expired/);
 await handler(req,'/api/auth/forgot',{email:'test@reset.test'});const expired=new URLSearchParams(new URL(mails.at(-1).url).hash.slice(1)).get('token');
 await db.run('UPDATE account_tokens SET expires=0');await assert.rejects(handler(req,'/api/auth/reset',{token:expired,password:'another-password'}),/invalid|expired/);
 }finally{sql.close()}
});
test('mail absence is explicit and does not issue recovery tokens',async()=>{
 const sql=openStore(':memory:',[]),db=localDatabase(sql);try{const auth=await createAuth(db),handler=recoveryHandler(db,auth);await assert.rejects(handler({headers:{},socket:{remoteAddress:'local'}},'/api/auth/forgot',{email:'x@test.test'}),e=>e.status===503);assert.equal((await db.one('SELECT count(*) n FROM account_tokens')).n,0);}finally{sql.close()}
});
test('an obsolete in-flight reset cannot consume a newer recovery link',async()=>{
 const sql=openStore(':memory:',[]),db=localDatabase(sql);try{
 const auth=await createAuth(db);await db.run('INSERT INTO users(id,email,password) VALUES (?,?,?)','u','race@reset.test',await auth.hashPassword('old-password'));
 const mails=[];let release,entered;
 const hashing=new Promise(ok=>entered=ok),gate=new Promise(ok=>release=ok);
 const delayed={...auth,hashPassword:async value=>{entered();await gate;return auth.hashPassword(value)}};
 const handler=recoveryHandler(db,delayed,{origin:'https://waraq.test',deliver:async m=>mails.push(m)}),req={headers:{},socket:{remoteAddress:'race'}};
 await handler(req,'/api/auth/forgot',{email:'race@reset.test'});
 const getToken=()=>new URLSearchParams(new URL(mails.at(-1).url).hash.slice(1)).get('token');
 const oldReset=handler(req,'/api/auth/reset',{token:getToken(),password:'new-password'});const rejected=assert.rejects(oldReset,e=>e.code==='TOKEN_INVALID');
 await hashing;await handler(req,'/api/auth/forgot',{email:'race@reset.test'});const fresh=getToken();release();await rejected;
 assert.equal((await db.one('SELECT count(*) n FROM account_tokens WHERE purpose=\'reset\'')).n,1);
 await handler(req,'/api/auth/reset',{token:fresh,password:'fresh-password'});
 assert.ok(await passwordMatches('fresh-password',(await db.one('SELECT password FROM users')).password));
 }finally{sql.close()}
});
