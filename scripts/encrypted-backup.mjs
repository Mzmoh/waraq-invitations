import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const magic=Buffer.from('WARAQBK1');
function key(value){if(!Buffer.isBuffer(value)||value.length!==32)throw Error('A private 32-byte backup key is required');return value}
export function encryptSnapshot(source,target,secret){
 if(existsSync(target))throw Error('Backup target already exists');
 const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(secret),nonce);cipher.setAAD(magic);
 const ciphertext=Buffer.concat([cipher.update(readFileSync(source)),cipher.final()]);
 writeFileSync(target,Buffer.concat([magic,nonce,cipher.getAuthTag(),ciphertext]),{flag:'wx',mode:0o600});
}
export function decryptSnapshot(source,target,secret){
 if(existsSync(target))throw Error('Restore target already exists');
 const input=readFileSync(source);if(input.length<36||!input.subarray(0,8).equals(magic))throw Error('Invalid encrypted backup');
 const decipher=createDecipheriv('aes-256-gcm',key(secret),input.subarray(8,20));decipher.setAAD(magic);decipher.setAuthTag(input.subarray(20,36));
 const plain=Buffer.concat([decipher.update(input.subarray(36)),decipher.final()]);
 writeFileSync(target,plain,{flag:'wx',mode:0o600});
}
if(import.meta.main){
 const [mode,source,target]=process.argv.slice(2),secret=process.env.BACKUP_ENCRYPTION_KEY;
 if(!['encrypt','decrypt'].includes(mode)||!source||!target||!/^[a-f\d]{64}$/i.test(secret||''))throw Error('Set BACKUP_ENCRYPTION_KEY privately (64 hex digits), then run: encrypted-backup.mjs encrypt|decrypt source new-target');
 (mode==='encrypt'?encryptSnapshot:decryptSnapshot)(source,target,Buffer.from(secret,'hex'));console.log('Encrypted backup operation completed');
}
