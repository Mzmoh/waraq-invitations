import {randomBytes,createHash,createHmac,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {fail} from './validation.mjs';
const derive=promisify(scrypt);
export const token=()=>randomBytes(32).toString('base64url');
const digest=value=>createHash('sha256').update(value).digest('hex');

export async function hashPassword(password) {
  const salt=randomBytes(16).toString('hex');
  const key=await derive(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
  return salt+'.'+key.toString('hex');
}
export async function passwordMatches(password,stored) {
  const [salt,key]=stored.split('.');
  const actual=await derive(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
  const expected=Buffer.from(key,'hex');
  return expected.length===actual.length && timingSafeEqual(actual,expected);
}
export async function createAuth(db,{secure=false}={}) {
  let secret;if(db.authSecret)secret=await db.authSecret(token());else{await db.run("INSERT OR IGNORE INTO secrets(name,value) VALUES ('hmac',?)",token());secret=(await db.one("SELECT value FROM secrets WHERE name='hmac'")).value;}
  const mac=value=>createHmac('sha256',secret).update(value).digest('hex');
  const cookie=(req,name)=>(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||'';
  function set(res,name,value,seconds) {
    const entry=name+'='+value+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+seconds+(secure?'; Secure':'');
    res.setHeader('Set-Cookie',[...(res.getHeader('Set-Cookie')||[]),entry]);
  }
  const pinValue=(row,expires)=>mac([row.id,row.pinHash,expires].join('|'));
  return {
    hashPassword,passwordMatches,
    user:req=>db.one('SELECT u.id,u.email,u.role FROM sessions s JOIN users u ON u.id=s.userId WHERE s.hash=? AND s.expires>?',digest(cookie(req,'invite_session')),Date.now()),
    logout:async(req,res)=>{
      await db.run('DELETE FROM sessions WHERE hash=?',digest(cookie(req,'invite_session')));
      set(res,'invite_session','',0);
    },
    session:async(req,res,id)=>{
      const value=token(),seconds=14*86400;
      await db.batch([
        ['DELETE FROM sessions WHERE hash=? OR expires<=?',digest(cookie(req,'invite_session')),Date.now()],
        ['INSERT INTO sessions VALUES (?,?,?)',digest(value),id,Date.now()+seconds*1000]
      ]);
      set(res,'invite_session',value,seconds);
    },
    limit:async(bucket,maximum,seconds)=>{
      const now=Date.now();
      await db.run('DELETE FROM limits WHERE expires<=?',now);
      const result=await db.one('INSERT INTO limits VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=hits+1 RETURNING hits',mac(bucket),now+seconds*1000);
      if(result.hits>maximum)fail(429,'RATE_LIMIT','طلبات كثيرة. حاول مجددًا بعد قليل.');
    },
    protectPin:(id,pin)=>mac('pin|'+id+'|'+pin),
    unlock:(res,row)=>{
      const expires=Date.now()+86400000;
      set(res,'invite_pin_'+row.slug,expires+'.'+pinValue(row,expires),86400);
    },
    hasGrant:(req,row)=>{
      const [expires,signature]=cookie(req,'invite_pin_'+row.slug).split('.');
      return Number(expires)>Date.now() && signature===pinValue(row,expires);
    }
  };
}

