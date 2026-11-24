import {randomUUID} from 'node:crypto';
import {open,mkdir,link,unlink} from 'node:fs/promises';
import {resolve,dirname,basename} from 'node:path';
// Only this invocation's reserved temporary file is cleaned up. Publication uses
// an exclusive hard link: rename could overwrite another writer's destination.
export async function withVerifiedOutput(destination,writeAndVerify) {
 const target=resolve(destination),folder=dirname(target);
 await mkdir(folder,{recursive:true});
 const temporary=resolve(folder,'.'+basename(target)+'.pending-'+randomUUID());
 const reservation=await open(temporary,'wx',0o600);await reservation.close();
 try{
  await writeAndVerify(temporary);
  const file=await open(temporary,'r+');try{await file.sync()}finally{await file.close()}
  await link(temporary,target);
  return target;
 }finally{await unlink(temporary).catch(e=>{if(e.code!=='ENOENT')throw e})}
}
