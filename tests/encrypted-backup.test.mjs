import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createCipheriv,createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync,readdirSync,openSync,writeSync,closeSync,createReadStream} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {encryptSnapshot,decryptSnapshot} from '../scripts/encrypted-backup.mjs';
test('encrypted snapshot restores exactly and rejects tampering/wrong key without creating output',async()=>{
 const folder=mkdtempSync(join(tmpdir(),'waraq-encrypted-')),source=join(folder,'snapshot'),sealed=join(folder,'sealed'),restored=join(folder,'restored');
 try{const bytes=randomBytes(1024),key=randomBytes(32);writeFileSync(source,bytes);await encryptSnapshot(source,sealed,key);await decryptSnapshot(sealed,restored,key);assert.deepEqual(readFileSync(restored),bytes);
 await assert.rejects(decryptSnapshot(sealed,join(folder,'wrong'),randomBytes(32)));assert.equal(existsSync(join(folder,'wrong')),false);
 const bad=readFileSync(sealed);bad[40]^=1;writeFileSync(sealed,bad);await assert.rejects(decryptSnapshot(sealed,join(folder,'tampered'),key));assert.equal(existsSync(join(folder,'tampered')),false);
 await assert.rejects(encryptSnapshot(source,sealed,key));assert.equal(readdirSync(folder).some(f=>f.includes('.pending-')),false);
 }finally{if(!resolve(folder).startsWith(resolve(tmpdir())+'\\')&&!resolve(folder).startsWith(resolve(tmpdir())+'/'))throw Error('Unsafe temporary cleanup');rmSync(folder,{recursive:true,force:true})}
});
test('streaming decrypt retains compatibility with the original WARAQBK1 format',async()=>{
 const folder=mkdtempSync(join(tmpdir(),'waraq-legacy-'));
 try{const secret=randomBytes(32),nonce=randomBytes(12),magic=Buffer.from('WARAQBK1'),bytes=randomBytes(4096),cipher=createCipheriv('aes-256-gcm',secret,nonce);cipher.setAAD(magic);
 const ciphertext=Buffer.concat([cipher.update(bytes),cipher.final()]),source=join(folder,'legacy'),target=join(folder,'restored');writeFileSync(source,Buffer.concat([magic,nonce,cipher.getAuthTag(),ciphertext]));
 await decryptSnapshot(source,target,secret);assert.deepEqual(readFileSync(target),bytes);
 }finally{if(!resolve(folder).startsWith(resolve(tmpdir())+'\\')&&!resolve(folder).startsWith(resolve(tmpdir())+'/'))throw Error('Unsafe cleanup');rmSync(folder,{recursive:true,force:true})}
});
test('large snapshots stream roundtrip and concurrent publishers never overwrite',async()=>{
 const folder=mkdtempSync(join(tmpdir(),'waraq-large-'));
 try{const source=join(folder,'source'),sealed=join(folder,'sealed'),target=join(folder,'restored'),secret=randomBytes(32),chunk=randomBytes(256*1024),fd=openSync(source,'wx');
 try{for(let i=0;i<128;i++)writeSync(fd,chunk)}finally{closeSync(fd)}
 const writers=await Promise.allSettled([encryptSnapshot(source,sealed,secret),encryptSnapshot(source,sealed,secret)]);assert.equal(writers.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(writers.find(r=>r.status==='rejected').reason.code,'EEXIST');
 await decryptSnapshot(sealed,target,secret);
 const digest=async path=>{const h=createHash('sha256');for await(const b of createReadStream(path))h.update(b);return h.digest('hex')};assert.equal(await digest(source),await digest(target));
 assert.equal(readdirSync(folder).some(f=>f.includes('.pending-')),false);
 }finally{if(!resolve(folder).startsWith(resolve(tmpdir())+'\\')&&!resolve(folder).startsWith(resolve(tmpdir())+'/'))throw Error('Unsafe cleanup');rmSync(folder,{recursive:true,force:true})}
});
