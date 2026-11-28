import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
import {trialDatabase,memoryStorage} from './trial/helpers.mjs';
import {createTrialHandler,CSP} from '../server/trial/handler.mjs';

const root=resolve('public');
const output=process.env.WARAQ_RENTAL_SCREENSHOTS;
const {pg,pool}=await trialDatabase({rentalMigration:true});
const origin='https://waraq.example';
const handler=createTrialHandler({pool,storage:memoryStorage(),env:{
 PUBLIC_ORIGIN:origin,COOKIE_SECURE:'true',WARAQ_TRIAL_ONLY:'true',WARAQ_RENTALS:'true'}});
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.woff':'font/woff','.webp':'image/webp'};
const server=createServer(async (req,res)=>{
 try{
  const url=new URL(req.url,origin);
  if(url.pathname.startsWith('/api/')||/^\/i\//.test(url.pathname)){
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   const response=await handler(new Request(url,{method:req.method,headers:{...req.headers,...(req.headers.origin?{origin}:{})},body:chunks.length?Buffer.concat(chunks):undefined}));
   const headers=Object.fromEntries(response.headers);
   if(response.headers.has('set-cookie'))headers['set-cookie']=response.headers.getSetCookie();
   res.writeHead(response.status,headers);res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  const path=extname(url.pathname)?resolve(root,'.'+decodeURIComponent(url.pathname)):resolve(root,'index.html');
  if(!path.startsWith(root+sep)){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Content-Security-Policy':CSP});
  res.end(await readFile(path));
 }catch{if(!res.headersSent)res.writeHead(404);res.end();}
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const base='http://127.0.0.1:'+server.address().port;
let browser;
try{
 const register=async (email,admin=false)=>{
  const result=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'local-fixture-password'})});
  assert.equal(result.status,200);
  const {user}=await result.json();
  if(admin)await pg.query("UPDATE users SET role='admin' WHERE id=$1",[user.id]);
  return result.headers.getSetCookie()[0].split(';')[0];
 };
 const make=async (session,title,templateId)=>{
  const response=await fetch(base+'/api/invitations',{method:'POST',headers:{cookie:session,'Content-Type':'application/json'},
   body:JSON.stringify({templateId,data:{title,message:'يسعدنا أن تشاركونا الاحتفال بهذه المناسبة.',startAt:'2030-03-10T15:00:00.000Z',timeZone:'Asia/Baghdad',place:'بغداد · قاعة الورد'},settings:{privacy:'public',rsvpEnabled:true}})});
  assert.equal(response.status,200);return (await response.json()).invitation;
 };
 const staff=await register('admin@example.test',true);
 const customer=await register('layla@example.test');
 const other=await register('mariam@example.test');
 const first=await make(customer,'زفاف ليلى وعمر','blush-floral-envelope');
 const second=await make(other,'حفل تخرّج مريم','golden-diploma');
 const third=await make(other,'أمسية الورد','minimal-signature');
 const submitFixture=async (session,invite,note)=>{
  const r=await fetch(base+'/api/invitations/'+invite.id+'/rent',{method:'POST',headers:{cookie:session,'Content-Type':'application/json'},body:JSON.stringify({days:5,expectedUpdatedAt:invite.updatedAt,note})});
  assert.equal(r.status,200);
 };
 await submitFixture(other,second,'نحتاج الرابط لمدة خمسة أيام لمشاركة الدعوة مع العائلة.');
 await submitFixture(other,third,'يرجى مراعاة موعد الأمسية المذكور في الدعوة.');
 browser=await chromium.launch({channel:process.env.WARAQ_BROWSER_CHANNEL||'chrome'});
 const newPage=async (session,viewport)=>{
  const context=await browser.newContext({viewport,locale:'ar-IQ',timezoneId:'Asia/Baghdad',reducedMotion:'reduce'});
  if(session)await context.addCookies([{name:'invite_session',value:session.slice('invite_session='.length),url:base,httpOnly:true,secure:true,sameSite:'Lax'}]);
  const page=await context.newPage();page.setDefaultTimeout(12000);
  page.on('pageerror',error=>console.log('Browser error:',error.message));
  return page;
 };
 const snapshot=async (page,name)=>{
  if(output){await mkdir(output,{recursive:true});await page.screenshot({path:resolve(output,name+'.png'),fullPage:name!=='waraq-admin-review',animations:'disabled'});}
 };
 const owner=await newPage(customer,{width:1440,height:1000});
 await owner.goto(base+'/create/blush-floral-envelope?id='+first.id+'&resume=publish');
 await owner.getByRole('button',{name:'متابعة إلى طلب الإيجار'}).click();
 await owner.waitForURL('**/dashboard/invitations/'+first.id+'#rental-request');
 await owner.getByLabel('مدة الإيجار بالأيام').fill('7');
 await owner.getByLabel('ملاحظة للإدارة (اختياري)').fill('الرجاء تفعيل الرابط بعد مراجعة التسوية.');
 assert.equal(await owner.getByRole('link',{name:'فتح رابط الضيوف'}).count(),0);
 await owner.getByRole('button',{name:'إرسال طلب الإيجار'}).click();
 await owner.getByText('بانتظار المراجعة',{exact:true}).waitFor();

 const admin=await newPage(staff,{width:1440,height:1000});
 await admin.goto(base+'/admin');
 const card=admin.locator('.sa-request').filter({hasText:'زفاف ليلى وعمر'});
 await card.waitFor();
 assert.equal(await admin.locator('html').getAttribute('dir'),'rtl');
 await snapshot(admin,'waraq-admin-desktop');
 const mobile=await newPage(staff,{width:390,height:844});
 await mobile.goto(base+'/admin');
 await mobile.locator('.sa-request').filter({hasText:'زفاف ليلى وعمر'}).waitFor();
 assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth),390);
 await snapshot(mobile,'waraq-admin-mobile');
 await card.getByRole('button',{name:'مراجعة الطلب'}).click();
 const approve=admin.getByRole('button',{name:'موافقة وتفعيل الرابط'});
 assert.equal(await approve.isDisabled(),true);
 await admin.getByText('بغداد · قاعة الورد').waitFor();
 await snapshot(admin,'waraq-admin-review');
 await admin.getByLabel('مرجع التسوية الخارجية').fill('TEST-001');
 assert.equal(await approve.isDisabled(),true);
 await admin.getByLabel('أؤكد أن التسوية الخارجية تمت').check();
 await approve.click();
 await admin.getByText('تم حفظ القرار.').waitFor();
 await owner.reload();
 const guestPath=await owner.getByRole('link',{name:'فتح رابط الضيوف'}).getAttribute('href');
 const guest=await newPage(null,{width:390,height:844});
 assert.equal((await guest.goto(guestPath)).status(),200);
 await guest.getByRole('heading',{name:'زفاف ليلى وعمر'}).first().waitFor();
 await pg.query('UPDATE invitations SET rental_until=statement_timestamp() WHERE id=$1',[first.id]);
 assert.equal((await guest.reload()).status(),404);
 await guest.getByText('هذه الدعوة غير متاحة حاليًا.').waitFor();

 await admin.getByRole('button',{name:'الحسابات',exact:true}).click();
 const account=admin.getByRole('row').filter({hasText:'mariam@example.test'});
 await account.getByText('2',{exact:true}).waitFor();
 await account.getByRole('button',{name:'عرض دعوات الحساب'}).click();
 await admin.getByText('حفل تخرّج مريم',{exact:true}).waitFor();
 assert.equal(await admin.getByText('زفاف ليلى وعمر',{exact:true}).count(),0);
 await admin.getByRole('button',{name:'القوالب',exact:true}).click();
 await admin.getByLabel('الاسم بالعربية').fill('ليل الورد');
 await admin.getByLabel('الاسم بالإنجليزية').fill('Rose Night');
 await admin.getByRole('button',{name:'حفظ قالب كمسودة'}).click();
 await admin.getByRole('button',{name:'نشر القالب'}).click();
 const template=await admin.getByRole('link',{name:'عرض القالب'}).getAttribute('href');
 assert.equal((await guest.goto(base+template)).status(),200);
 await guest.getByRole('heading',{name:'ليل الورد'}).waitFor();
 await admin.getByRole('button',{name:'روابط التواصل',exact:true}).click();
 const social=admin.locator('form.sa-social').filter({hasText:'Instagram'});
 await social.getByLabel('Instagram').fill('https://instagram.com/waraq');
 await social.getByRole('button',{name:'حفظ الرابط'}).click();
 await admin.getByText('تم حفظ روابط التواصل.').waitFor();
 await guest.goto(base+'/occasions');
 await guest.getByRole('link',{name:'Instagram'}).waitFor();
 console.log('Rental workflow passed in Chrome at 1440px and 390px.');
}finally{
 await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await pg.close();
}
