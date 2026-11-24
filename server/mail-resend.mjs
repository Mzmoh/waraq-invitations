import {createHash} from 'node:crypto';
const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function resendConfiguration(env,{fetcher=fetch}={}) {
 if(!env.RESEND_API_KEY||!env.MAIL_FROM||!env.PUBLIC_ORIGIN)throw Error('Resend requires RESEND_API_KEY, MAIL_FROM and PUBLIC_ORIGIN');
 const origin=new URL(env.PUBLIC_ORIGIN);
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw Error('Invalid email PUBLIC_ORIGIN');
 if(/[\r\n]/.test(env.MAIL_FROM)||!/@/.test(env.MAIL_FROM))throw Error('Invalid MAIL_FROM');
 return {origin:origin.origin,deliver:async({to,purpose,url})=>{
   const target=new URL(url);
   if(target.origin!==origin.origin||target.pathname!=='/auth'||!['reset','verify'].includes(purpose))throw Error('Invalid account link');
   const subject=purpose==='reset'?'وَرَق — استعادة كلمة المرور / Reset password':'وَرَق — تأكيد البريد الإلكتروني / Verify email';
   const text=subject+'\n\n'+url+'\n\nينتهي الرابط بعد 30 دقيقة. إذا لم تطلب هذه الرسالة فتجاهلها.\nThis link expires in 30 minutes. Ignore this email if you did not request it.';
   const response=await fetcher('https://api.resend.com/emails',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'waraq-'+createHash('sha256').update(purpose+'|'+url).digest('hex')},body:JSON.stringify({from:env.MAIL_FROM,to:[to],subject,text,html:'<div dir="rtl" lang="ar"><h1>'+escape(subject)+'</h1><p><a href="'+escape(url)+'">متابعة / Continue</a></p><p>ينتهي الرابط بعد 30 دقيقة.</p></div>'})});
   if(!response.ok)throw Error('Mail provider rejected delivery');
   const receipt=await response.json();if(typeof receipt.id!=='string'||!receipt.id)throw Error('Invalid mail provider receipt');
   return {id:receipt.id};
 }};
}
