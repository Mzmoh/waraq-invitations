import {DatabaseSync,backup} from 'node:sqlite';
import {resolve} from 'node:path';
import {existsSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';

export async function backupDatabase(source,target) {
 source=resolve(source);target=resolve(target);
 if(source===target||!existsSync(source)||existsSync(target))throw Error('Source must exist; destination must be a new, different file.');
 mkdirSync(dirname(target),{recursive:true});
 const db=new DatabaseSync(source,{readOnly:true});
 try{await backup(db,target);}finally{db.close()}
 const check=new DatabaseSync(target,{readOnly:true});
 try{
   if(check.prepare('PRAGMA integrity_check').get().integrity_check!=='ok'||check.prepare('PRAGMA foreign_key_check').all().length)throw Error('Backup verification failed.');
 }finally{check.close()}
 return target;
}
if(import.meta.main){
 const [source,target]=process.argv.slice(2);
 if(!source||!target)throw Error('Usage: node scripts/backup.mjs <source.sqlite> <new-backup.sqlite>');
 console.log('Verified database snapshot: '+await backupDatabase(source,target));
}
