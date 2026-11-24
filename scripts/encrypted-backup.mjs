import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {createReadStream,createWriteStream,existsSync} from 'node:fs';
import {open,writeFile} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {withVerifiedOutput} from './safe-output.mjs';
const magic=Buffer.from('WARAQBK1');
function key(value){if(!Buffer.isBuffer(value)||value.length!==32)throw Error('A private 32-byte backup key is required');return value}
export async function encryptSnapshot(source,target,secret){
 if(existsSync(target))throw Error('Backup target already exists');
 const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(secret),nonce);cipher.setAAD(magic);
 return withVerifiedOutput(target,async temporary=>{
  await writeFile(temporary,Buffer.concat([magic,nonce,Buffer.alloc(16)]));
  await pipeline(createReadStream(source),cipher,createWriteStream(temporary,{flags:'a'}));
  const file=await open(temporary,'r+');try{if((await file.write(cipher.getAuthTag(),0,16,20)).bytesWritten!==16)throw Error('Incomplete backup authentication tag')}finally{await file.close()}
 });
}
export async function decryptSnapshot(source,target,secret){
 if(existsSync(target))throw Error('Restore target already exists');
 const file=await open(source,'r');const input=Buffer.alloc(36);let size;
 try{size=(await file.read(input,0,36,0)).bytesRead}finally{await file.close()}
 if(size!==36||!input.subarray(0,8).equals(magic))throw Error('Invalid encrypted backup');
 const decipher=createDecipheriv('aes-256-gcm',key(secret),input.subarray(8,20));decipher.setAAD(magic);decipher.setAuthTag(input.subarray(20,36));
 return withVerifiedOutput(target,async temporary=>{
  await pipeline(createReadStream(source,{start:36}),decipher,createWriteStream(temporary));
 });
}
if(import.meta.main){
 const [mode,source,target]=process.argv.slice(2),secret=process.env.BACKUP_ENCRYPTION_KEY;
 if(!['encrypt','decrypt'].includes(mode)||!source||!target||!/^[a-f\d]{64}$/i.test(secret||''))throw Error('Set BACKUP_ENCRYPTION_KEY privately (64 hex digits), then run: encrypted-backup.mjs encrypt|decrypt source new-target');
 await (mode==='encrypt'?encryptSnapshot:decryptSnapshot)(source,target,Buffer.from(secret,'hex'));console.log('Encrypted backup operation completed');
}
