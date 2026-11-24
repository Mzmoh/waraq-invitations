import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {openStore} from '../server/store.mjs';
import {backupDatabase} from '../scripts/backup.mjs';
test('competing snapshots publish one verified destination and clean temporary files',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'waraq-race-')),source=join(folder,'source.sqlite'),target=join(folder,'snapshot.sqlite');
 const db=openStore(source,[]);
 try{
  const result=await Promise.allSettled([backupDatabase(source,target),backupDatabase(source,target)]);
  assert.equal(result.filter(r=>r.status==='fulfilled').length,1,'Only one writer may publish the target');
  assert.equal(result.find(r=>r.status==='rejected').reason.code,'EEXIST');
  const snapshot=openStore(target,[]);snapshot.close();
  assert.equal((await readdir(folder)).filter(name=>name.includes('.pending-')).length,0);
 }finally{db.close();assert.ok(resolve(folder).startsWith(resolve(tmpdir())+sep));await rm(folder,{recursive:true,force:true})}
});
test('a snapshot with foreign-key corruption never appears as a usable backup',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'waraq-rejected-')),source=join(folder,'source.sqlite'),target=join(folder,'snapshot.sqlite');
 const db=openStore(source,[]);
 try{
  db.exec("PRAGMA foreign_keys=OFF; INSERT INTO sessions VALUES ('broken','missing-user',9999999999999)");
  await assert.rejects(backupDatabase(source,target),/verification failed/);
  await assert.rejects(access(target),'Rejected snapshot must not be published');
  assert.equal((await readdir(folder)).filter(name=>name.includes('.pending-')).length,0);
 }finally{db.close();assert.ok(resolve(folder).startsWith(resolve(tmpdir())+sep));await rm(folder,{recursive:true,force:true})}
});
