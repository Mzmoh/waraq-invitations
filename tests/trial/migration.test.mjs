import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createTrialFixture} from '../../scripts/trial-fixture.mjs';
import {planDemoMigration,applyDemoMigration,assertTrialTarget} from '../../scripts/trial-migration.mjs';
import {trialDatabase,memoryStorage} from './helpers.mjs';
import {createTrialHandler} from '../../server/trial/handler.mjs';
import {passwordMatches} from '../../server/auth.mjs';

test('read-only synthetic SQLite migration, auth preservation and rollback',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'waraq-trial-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const file=join(dir,'demo.sqlite');const fixture=await createTrialFixture(file);const before=await readFile(file);
 const plan=planDemoMigration(file);assert.equal(plan.objects.length,2);assert.equal(plan.summary.counts.templates,80);assert.deepEqual(await readFile(file),before);
 const source=new DatabaseSync(file,{readOnly:true});const old=source.prepare('SELECT password FROM users WHERE id=?').get(fixture.owner).password;source.close();
 assert.equal(await passwordMatches('demo-password-123',old),true);
 const {pg,pool}=await trialDatabase();t.after(()=>pg.close());const storage=memoryStorage();
 const client=await pool.connect();try{await applyDemoMigration(plan,{client,storage});}finally{client.release();}
 assert.equal((await pg.query('SELECT password FROM users WHERE id=$1',[fixture.owner])).rows[0].password,old);assert.equal(storage.objects.size,2);
 const env={PUBLIC_ORIGIN:'https://waraq.example',COOKIE_SECURE:'true',WARAQ_TRIAL_ONLY:'true'};const handle=createTrialHandler({pool,storage,env});
 const session=await handle(new Request(env.PUBLIC_ORIGIN+'/api/me',{headers:{cookie:'invite_session='+fixture.session}}));assert.equal((await session.json()).user.id,fixture.owner);
 const login=await handle(new Request(env.PUBLIC_ORIGIN+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'owner@example.test',password:'demo-password-123'})}));assert.equal(login.status,200);
 const unlocked=await handle(new Request(env.PUBLIC_ORIGIN+'/api/public/synthetic-pin-demo/unlock',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:'1234'})}));assert.equal(unlocked.status,200);const data=await unlocked.json();assert.match(data.invitation.data.audio.src,/^\/api\/assets\//);
 const again=await pool.connect();try{await assert.rejects(()=>applyDemoMigration(plan,{client:again,storage}),/Target must be empty/);}finally{again.release();}
 assert.equal(storage.objects.size,2);assert.deepEqual(await readFile(file),before);
 const original=join(dir,'original.sqlite');const db=new DatabaseSync(original);db.exec('CREATE TABLE users(id TEXT)');db.close();assert.throws(()=>planDemoMigration(original),/Production source refused/);
 assert.throws(()=>assertTrialTarget({}),/Invalid URL|trial project/);
 assert.throws(()=>assertTrialTarget({WARAQ_TRIAL_ONLY:'true',SUPABASE_URL:'https://trialref.supabase.co',WARAQ_TRIAL_PROJECT_REF:'trialref',DATABASE_URL:'postgresql://postgres.otherref:password@pooler.supabase.com:6543/postgres'}),/does not match/);
 assert.doesNotThrow(()=>assertTrialTarget({WARAQ_TRIAL_ONLY:'true',SUPABASE_URL:'https://trialref.supabase.co',WARAQ_TRIAL_PROJECT_REF:'trialref',DATABASE_URL:'postgresql://postgres.trialref:password@pooler.supabase.com:6543/postgres'}));
});

test('failed media migration rolls PostgreSQL back and removes newly uploaded objects',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'waraq-trial-fail-'));t.after(()=>rm(dir,{recursive:true,force:true}));const file=join(dir,'demo.sqlite');await createTrialFixture(file);const plan=planDemoMigration(file);
 const {pg,pool}=await trialDatabase();t.after(()=>pg.close());const storage=memoryStorage();const put=storage.put;let calls=0;storage.put=async value=>{if(++calls===2)throw Error('Injected upload failure');return put(value);};
 const client=await pool.connect();try{await assert.rejects(()=>applyDemoMigration(plan,{client,storage}),/Injected upload failure/);}finally{client.release();}
 assert.equal((await pg.query('SELECT count(*)::int AS n FROM users')).rows[0].n,0);assert.equal(storage.objects.size,0);
});
