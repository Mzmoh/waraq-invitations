import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore} from '../server/store.mjs';
import {backupDatabase} from '../scripts/backup.mjs';
test('online SQLite backup restores rows and secrets without overwriting existing files',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'waraq-restore-')),source=join(folder,'source.sqlite'),target=join(folder,'backup.sqlite');
 let db;try{
 db=openStore(source,[]);db.prepare('INSERT INTO users(id,email,password) VALUES (?,?,?)').run('test','backup@test.test','hash');
 const secret=db.prepare("SELECT value FROM secrets WHERE name='hmac'").get().value;
 await backupDatabase(source,target);
 const restored=openStore(target,[]);try{assert.equal(restored.prepare('SELECT email FROM users').get().email,'backup@test.test');assert.equal(restored.prepare("SELECT value FROM secrets WHERE name='hmac'").get().value,secret);}finally{restored.close()}
 await assert.rejects(backupDatabase(source,target),/new, different/);
 }finally{db?.close();await rm(folder,{recursive:true,force:true})}
});
