import {existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createHmac,createHash,randomUUID} from 'node:crypto';
import {openStore,hashPassword} from '../server/store.mjs';
import {templates} from '../public/templates/index.js';
export async function createTrialFixture(file){
 if(existsSync(file))throw Error('Refusing to overwrite an existing SQLite file');
 const db=openStore(file,templates);
 try{
  db.exec('CREATE TABLE waraq_trial_fixture(marker TEXT NOT NULL)');
  db.prepare('INSERT INTO waraq_trial_fixture VALUES (?)').run('WARAQ_SYNTHETIC_ONLY_V1');
  const owner=randomUUID(),other=randomUUID(),password=await hashPassword('demo-password-123');
  for(const [id,email] of [[owner,'owner@example.test'],[other,'other@example.test']])db.prepare('INSERT INTO users(id,email,password) VALUES (?,?,?)').run(id,email,password);
  const session='synthetic-session-for-migration-only';
  db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(createHash('sha256').update(session).digest('hex'),owner,Date.now()+86400000);
  const id=randomUUID(),asset=randomUUID(),secret=db.prepare("SELECT value FROM secrets WHERE name='hmac'").get().value;
  const pinHash=createHmac('sha256',secret).update('pin|'+id+'|1234').digest('hex');
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
  db.prepare('INSERT INTO assets VALUES (?,?,?,?)').run(asset,owner,'image/png',bytes);
  db.prepare('INSERT INTO managed_assets VALUES (?)').run(asset);
  const data={title:'دعوة تجريبية للهجرة',startAt:'2030-01-02T12:00:00.000Z',images:[{src:'/api/assets/'+asset}],audio:{track:'upload',volume:.5,loop:false,rightsConfirmed:true,src:'data:audio/wav;base64,'+Buffer.from('RIFF0000WAVE0123456789').toString('base64')}};
  db.prepare('INSERT INTO invitations VALUES (?,?,?,?,?,?,?,?,?)').run(id,owner,'synthetic-pin-demo',templates[0].id,'published',JSON.stringify(data),JSON.stringify({privacy:'pin',rsvpEnabled:true,maxGuests:3}),pinHash,new Date().toISOString());
  db.prepare('INSERT INTO responses VALUES (?,?,?,?,?,?,?)').run(randomUUID(),id,'ضيف تجريبي',1,2,'',new Date().toISOString());
  return {owner,other,id,session};
 }finally{db.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const file=process.argv[2];if(!file)throw Error('Usage: node scripts/trial-fixture.mjs var/trial-demo.sqlite');
 await createTrialFixture(file);console.log('Synthetic SQLite fixture created; no existing database was read.');
}
