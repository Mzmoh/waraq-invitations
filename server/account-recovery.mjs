import {randomBytes,createHash} from 'node:crypto';
import {resendConfiguration} from './mail-resend.mjs';
import {fail,str,invalid} from './validation.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
export function recoveryHandler(db,auth,{origin,deliver}={}) {
  return async(req,path,body)=>{
    const action=path.split('/').at(-1);
    if(!['forgot','reset','request-verification','verify'].includes(action))return null;
    await auth.limit('account:'+action+'|'+(req.clientAddress||req.socket.remoteAddress),10,900);
    if(['forgot','request-verification'].includes(action)) {
      if(!deliver||!origin)fail(503,'MAIL_UNAVAILABLE','Email delivery is not configured. Contact the site administrator.');
      const purpose=action==='forgot'?'reset':'verify';
      const email=purpose==='reset'?str(body.email,254,3).toLowerCase():(await auth.user(req))?.email;
      if(!email)fail(401,'AUTH_REQUIRED','Sign in to continue.');
      const user=await db.one('SELECT id,email FROM users WHERE email=?',email);
      if(user){
        const token=randomBytes(32).toString('base64url');
        await db.batch([['DELETE FROM account_tokens WHERE expires<=? OR (userId=? AND purpose=?)',Date.now(),user.id,purpose],['INSERT INTO account_tokens VALUES (?,?,?,?)',hash(token),user.id,purpose,Date.now()+1800000]]);
        try {await deliver({to:user.email,purpose,url:new URL('/auth?mode='+purpose+'#token='+token,origin).href});}
        catch {await db.run('DELETE FROM account_tokens WHERE hash=?',hash(token));console.warn('Account email delivery failed');}
      }
      return {ok:true,message:'If this account is eligible, an email will arrive shortly.'};
    }
    const token=str(body.token,100,32),purpose=action==='reset'?'reset':'verify',digest=hash(token);
    const row=await db.one('SELECT userId FROM account_tokens WHERE hash=? AND purpose=? AND expires>?',digest,purpose,Date.now());
    if(!row)fail(400,'TOKEN_INVALID','This link is invalid or expired. Request a new email.');
    if(purpose==='reset'){
      if(typeof body.password!=='string'||body.password.length<8||body.password.length>128)invalid('Use a password of 8–128 characters.');
      const password=await auth.hashPassword(body.password),now=Date.now();
      const results=await db.batch([
        ['UPDATE users SET password=? WHERE id=? AND EXISTS (SELECT 1 FROM account_tokens WHERE hash=? AND purpose=\'reset\' AND expires>?)',password,row.userId,digest,now],
        ['DELETE FROM sessions WHERE userId=? AND EXISTS (SELECT 1 FROM account_tokens WHERE hash=? AND expires>?)',row.userId,digest,now],
        ['DELETE FROM account_tokens WHERE hash=? AND purpose=\'reset\'',digest]
      ]);
      if(!results[0].changes)fail(400,'TOKEN_INVALID','This link has already been used.');
    } else {
      const results=await db.batch([
        ['INSERT OR IGNORE INTO verified_emails SELECT userId,? FROM account_tokens WHERE hash=? AND purpose=\'verify\' AND expires>?',new Date().toISOString(),digest,Date.now()],
        ['DELETE FROM account_tokens WHERE hash=?',digest]
      ]);
      if(!results[1].changes)fail(400,'TOKEN_INVALID','This link has already been used.');
    }
    return {ok:true};
  };
}
export function mailConfiguration(env) {
  if(env.MAIL_PROVIDER==='resend')return resendConfiguration(env);
  if(env.MAIL_PROVIDER && env.MAIL_PROVIDER!=='webhook')throw Error('Unsupported MAIL_PROVIDER');
  if(!env.MAIL_DELIVERY_URL||!env.PUBLIC_ORIGIN)return {};
  const endpoint=new URL(env.MAIL_DELIVERY_URL),origin=new URL(env.PUBLIC_ORIGIN);
  if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||origin.protocol!=='https:')throw Error('Invalid mail configuration');
  return {origin:origin.origin,deliver:async message=>{
    const r=await fetch(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json',...(env.MAIL_DELIVERY_TOKEN?{Authorization:'Bearer '+env.MAIL_DELIVERY_TOKEN}:{})},body:JSON.stringify(message)});
    if(!r.ok)throw Error('Mail delivery failed');
  }};
}
