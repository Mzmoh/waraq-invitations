import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {encryptSnapshot,decryptSnapshot} from '../scripts/encrypted-backup.mjs';
test('encrypted snapshot restores exactly and rejects tampering/wrong key without creating output',()=>{
 const folder=mkdtempSync(join(tmpdir(),'waraq-encrypted-')),source=join(folder,'snapshot'),sealed=join(folder,'sealed'),restored=join(folder,'restored');
 try{const bytes=randomBytes(1024),key=randomBytes(32);writeFileSync(source,bytes);encryptSnapshot(source,sealed,key);decryptSnapshot(sealed,restored,key);assert.deepEqual(readFileSync(restored),bytes);
 assert.throws(()=>decryptSnapshot(sealed,join(folder,'wrong'),randomBytes(32)));assert.equal(existsSync(join(folder,'wrong')),false);
 const bad=readFileSync(sealed);bad[40]^=1;writeFileSync(sealed,bad);assert.throws(()=>decryptSnapshot(sealed,join(folder,'tampered'),key));assert.equal(existsSync(join(folder,'tampered')),false);
 assert.throws(()=>encryptSnapshot(source,sealed,key));
 }finally{if(!resolve(folder).startsWith(resolve(tmpdir())+'\\')&&!resolve(folder).startsWith(resolve(tmpdir())+'/'))throw Error('Unsafe temporary cleanup');rmSync(folder,{recursive:true,force:true})}
});
