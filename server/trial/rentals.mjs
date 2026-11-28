import {randomBytes,randomUUID} from 'node:crypto';
import {fail,integer,invalid,str} from '../validation.mjs';
import {pageRequest,pageResult} from '../pagination.mjs';

const platforms={
 instagram:['instagram.com','www.instagram.com'],
 tiktok:['tiktok.com','www.tiktok.com'],
 whatsapp:['wa.me','api.whatsapp.com','www.whatsapp.com']
};
const errors={
 P4201:[400,'INVALID_RENTAL','تحقق من بيانات الإيجار.'],
 P4202:[409,'RENTAL_CONFLICT','حالة الدعوة أو الطلب تغيّرت. حدّث الصفحة.'],
 P4203:[404,'NOT_FOUND','هذا المحتوى غير متوفر.'],
 P4204:[403,'FORBIDDEN','هذه الصفحة لمسؤول المنصة.']
};
export function rentalError(error) {
 const details=errors[error.code];
 if(details)fail(...details);
 throw error;
}
function socialUrl(platform,value) {
 if(!Object.hasOwn(platforms,platform))invalid();
 let url;
 try{url=new URL(str(value,500,1));}catch{invalid('أدخل رابط HTTPS صالحًا.');}
 if(url.protocol!=='https:'||url.username||url.password||url.port||!platforms[platform].includes(url.hostname))
  invalid('اختر رابطًا من المنصة المحددة.');
 return url.href;
}
const customSQL='SELECT id,base_id AS base, title_ar,title_en,background,accent FROM custom_templates';
const rentalSQL=`SELECT r.id,r.invitation,r.title,r.days,r.note,r.state,
 to_char(r.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS createdat,r.decided_at,r.ends_at
 FROM rental_requests r`;

export function rentalRoutes(db) {
 const {one,all,batch}=db;
 return {
  async catalog(){
   const [custom,social]=await db.readMany([
    [customSQL+' WHERE id IN (SELECT t.id FROM templates t JOIN categories c ON c.id=t.category WHERE t.published=1 AND c.published=1)'],
    ['SELECT platform,url FROM social_links ORDER BY platform']
   ]);
   return {rentals:true,custom,social};
  },
  custom:id=>id.startsWith('custom-')?one(customSQL+' WHERE id=?',id):null,
  async ownerDetails(inv){
   const row=await one(`SELECT i.rental_until,waraq_private.link_open(i.status,i.rental_until) AS live,
    r.state,r.days,r.note,r.created_at,r.ends_at FROM invitations i
    LEFT JOIN LATERAL (SELECT state,days,note,created_at,ends_at FROM rental_requests
     WHERE invitation=i.id ORDER BY created_at DESC,id DESC LIMIT 1) r ON true
    WHERE i.id=? AND i.owner=waraq_private.current_uid()`,inv.id);
   return {...inv,rentals:true,linkActive:Boolean(inv.linkActive&&row?.live),
    slug:inv.linkActive&&row?.live?inv.slug:null,
    rentalUntil:row?.rental_until??null,rental:row?.state?{state:row.state,days:row.days,note:row.note,createdAt:row.created_at,endsAt:row.ends_at}:null,custom:await this.custom(inv.templateId)};
  },
  async request(inv,body){
   const expected=str(body.expectedUpdatedAt,40,1);
   const result=await one('SELECT waraq_private.request_rental(?,?,?,?,?) AS id',
    inv.id,expected,randomUUID(),integer(body.days,1,365),str(body.note??'',1000));
   return {id:result.id};
  },
  async admin(req,id,action,body,user){
   if(req.method==='GET'&&id==='rental-overview'){
    return one('SELECT * FROM waraq_private.admin_rental_overview()');
   }
   if(req.method==='GET'&&id==='rentals'&&!action){
    const paging=pageRequest(req);
    const query=new URL(req.url).searchParams;
    const state=query.get('state')||'pending';
    if(!['pending','approved','rejected','all'].includes(state))invalid();
    const args=[];
    let sql=rentalSQL.replace('r.title,','r.title,u.email,r.settlement_ref,')+' JOIN users u ON u.id=r.owner WHERE true';
    if(state!=='all'){sql+=' AND r.state=?';args.push(state);}
    if(paging.cursor&&!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/.test(paging.cursor[1]))invalid();
    if(paging.cursor){sql+=' AND (r.created_at,r.id)<(?::timestamptz,?::uuid)';args.push(...paging.cursor);}
    const rows=await all(sql+' ORDER BY r.created_at DESC,r.id DESC LIMIT ?',...args,paging.limit+1);
    return pageResult(rows,paging,'createdAt');
   }
   if(id==='rentals'&&action&&!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(action))invalid();
   if(req.method==='GET'&&id==='rentals'&&action){
    const result=await one('SELECT * FROM waraq_private.admin_rental_detail(?)',action);
    if(!result)fail(404,'NOT_FOUND','الطلب غير متاح للمراجعة.');
    return result;
   }
   if(req.method==='POST'&&id==='rentals'&&action){
    const verdict=body.state;
    if(!['approved','rejected'].includes(verdict))invalid();
    if(verdict==='approved'&&body.settlementConfirmed!==true)
      invalid('أكّد التسوية الخارجية قبل الموافقة.');
    const reference=verdict==='approved'?str(body.settlementReference,120,1):null;
    return one('SELECT waraq_private.decide_rental(?,?,?,?) AS state',action,verdict,reference,randomBytes(16).toString('base64url'));
   }
   if(req.method==='GET'&&['accounts','all-invitations'].includes(id)){
    const query=new URL(req.url).searchParams;
    const after=query.get('after')||'';
    const account=query.get('account')||null;
    if(!/^[\w-]{0,128}$/.test(after)||(account&&!/^[\w-]{1,128}$/.test(account)))invalid();
    const size=30;
    const result=id==='accounts'?await all('SELECT * FROM waraq_private.admin_rental_accounts(?,?)',after,size+1)
     :await all('SELECT * FROM waraq_private.admin_rental_invitations(?,?,?)',after,account,size+1);
    const items=result.slice(0,size);
    return {items,next:result.length>size?items.at(-1).id:null};
   }
   if(req.method==='GET'&&id==='custom-templates')return {items:await all(customSQL+' ORDER BY id')};
   if(req.method==='POST'&&id==='custom-templates'){
    const color=value=>{if(typeof value!=='string'||!/^#[a-f\d]{6}$/i.test(value))invalid();return value.toLowerCase();};
    const templateId='custom-'+randomUUID();
    await one('SELECT waraq_private.create_rental_template(?,?,?,?,?,?)',templateId,str(body.base,150,1),
      str(body.titleAr,80,1),str(body.titleEn,80,1),color(body.background),color(body.accent));
    return {id:templateId};
   }
   if(req.method==='PATCH'&&id==='social'&&action){
    if(!Object.hasOwn(platforms,action))invalid();
    const change=body.url===''?['DELETE FROM social_links WHERE platform=?',action]:
      ['INSERT INTO social_links(platform,url) VALUES (?,?) ON CONFLICT(platform) DO UPDATE SET url=excluded.url',action,socialUrl(action,body.url)];
    await batch([change,['INSERT INTO audit VALUES (?,?,?,?)','social_updated',user.id,action,new Date().toISOString()]]);
    return {ok:true};
   }
  }
 };
}
