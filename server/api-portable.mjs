import {randomUUID,randomBytes} from 'node:crypto';
import {validateData,validateSettings,raster,str,integer,invalid,fail} from './validation.mjs';

const now=()=>new Date().toISOString();
const nextVersion=row=>new Date(Math.max(Date.now(),Date.parse(row.updatedAt)+1)).toISOString();
const absent=()=>fail(404,'NOT_FOUND','هذا المحتوى غير متوفر.');
const invitationSQL='SELECT i.*, (SELECT COUNT(*) FROM responses r WHERE r.invitation=i.id) AS responseCount FROM invitations i';
function publicFields(row) {
  return {slug:row.slug,templateId:row.templateId,data:JSON.parse(row.data),settings:JSON.parse(row.settings)};
}
function ownerFields(row) {
  const invitation=publicFields(row);
  invitation.settings.hasPin=Boolean(row.pinHash);
  return {...invitation,id:row.id,status:row.status,updatedAt:row.updatedAt,responseCount:row.responseCount};
}
export function portableAPI(db,auth) {
  const {one,all,run,batch}=db;
  const lookup=id=>one(invitationSQL+' WHERE i.id=?',id);
  const published=slug=>one("SELECT i.* FROM invitations i JOIN templates t ON t.id=i.templateId JOIN categories c ON c.id=t.category WHERE slug=? AND status='published' AND t.published=1 AND c.published=1",slug);
  const templateAllowed=id=>one('SELECT t.id FROM templates t JOIN categories c ON c.id=t.category WHERE t.id=? AND t.published=1 AND c.published=1',id);
  async function owner(req) {return await auth.user(req)||fail(401,'AUTH_REQUIRED','سجل الدخول للمتابعة.')}
  function publicAccess(req,row) {
    if(!row)absent();
    if(JSON.parse(row.settings).privacy==='pin' && !auth.hasGrant(req,row))fail(401,'PIN_REQUIRED','أدخل رمز الدعوة.');
  }
  async function route(req,res,path,body) {
    const [,,base,id,action]=path.split('/');
    const method=req.method,ip=req.socket.remoteAddress||'local';
    const limit=(key,n,s)=>auth.limit(key+'|'+ip,n,s);
    if(path==='/api/me' && method==='GET')return {user:await auth.user(req)||null};
    if(base==='auth' && method==='POST') {
      if(id==='logout'){await auth.logout(req,res);return {ok:true}}
      if(!['register','login'].includes(id))absent();
      await limit('auth',35,900);
      const email=str(body.email,254,3).toLowerCase(),pass=body.password;
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||typeof pass!=='string'||pass.length<8||pass.length>128)invalid('تحقق من البريد وكلمة المرور (8–128 حرفًا).');
      if(id==='register') {
        await limit('register',12,3600);
        const hash=await auth.hashPassword(pass),uid=randomUUID();
        if(!(await run('INSERT OR IGNORE INTO users(id,email,password) VALUES (?,?,?)',uid,email,hash)).changes)fail(409,'EMAIL_IN_USE','البريد مسجل بالفعل.');
        await auth.session(req,res,uid);
        return {user:{id:uid,email,role:'creator'}};
      }
      const account=await one('SELECT id,email,role,password FROM users WHERE email=?',email);
      const valid=await auth.passwordMatches(pass,account?.password||('0'.repeat(32)+'.'+'0'.repeat(128)));
      if(!valid||!account)fail(401,'BAD_CREDENTIALS','تحقق من البريد وكلمة المرور.');
      await auth.session(req,res,account.id);
      return {user:{id:account.id,email:account.email,role:account.role}};
    }
    if(path==='/api/catalog' && method==='GET')return {
      hiddenTemplates:(await all('SELECT id FROM templates WHERE published=0')).map(t=>t.id),
      hiddenCategories:(await all('SELECT id FROM categories WHERE published=0')).map(c=>c.id)
    };
    if(base==='assets') {
      if(!id && method==='POST') {
        const user=await owner(req);
        await limit('assets:'+user.id,120,3600);
        const {bytes,mime}=raster(body.dataUrl),asset=randomUUID();
        await run('INSERT INTO assets VALUES (?,?,?,?)',asset,user.id,mime,bytes);
        return {url:'/api/assets/'+asset};
      }
      if(id && method==='GET') {
        const asset=await one('SELECT owner,mime,bytes FROM assets WHERE id=?',id);
        if(!asset)absent();
        if(asset.owner!==(await auth.user(req))?.id) {
          const bindings=await all("SELECT i.id,i.slug,i.pinHash,i.settings FROM invitation_assets a JOIN invitations i ON i.id=a.invitation JOIN templates t ON t.id=i.templateId JOIN categories c ON c.id=t.category WHERE a.asset=? AND i.status='published' AND t.published=1 AND c.published=1",id);
          const allowed=bindings.some(row=>JSON.parse(row.settings).privacy!=='pin'||auth.hasGrant(req,row));
          if(!allowed)absent();
        }
        res.setHeader('Content-Type',asset.mime);res.end(new Uint8Array(asset.bytes));return;
      }
    }
    if(base==='invitations') {
      const user=await owner(req);
      if(!id && method==='GET') {
        const rows=await all("SELECT i.id,i.slug,i.templateId,i.status,i.updatedAt,i.pinHash,i.settings,json_object('title',json_extract(i.data,'$.title')) AS data,(SELECT count(*) FROM responses r WHERE r.invitation=i.id) AS responseCount FROM invitations i WHERE owner=? ORDER BY updatedAt DESC",user.id);
        return {invitations:rows.map(ownerFields)};
      }
      const row=id?await lookup(id):null;
      if(id && (!row||row.owner!==user.id))absent();
      if(id && !action && method==='GET')return {invitation:ownerFields(row)};
      if(action==='responses' && method==='GET')return {responses:(await all('SELECT id,name,attending,count,comment,createdAt FROM responses WHERE invitation=? ORDER BY createdAt DESC',id)).map(r=>({...r,attending:!!r.attending}))};
      if(['publish','archive'].includes(action) && method==='POST') {
        await limit('status:'+user.id,60,3600);
        if(action==='publish') {
          validateData(JSON.parse(row.data),true);
          if(!await templateAllowed(row.templateId))invalid('القالب متوقف حاليًا.');
        }
        const changed=await run('UPDATE invitations SET status=?,updatedAt=? WHERE id=? AND updatedAt=?',action==='publish'?'published':'archived',nextVersion(row),id,row.updatedAt);
        if(!changed.changes)fail(409,'EDIT_CONFLICT','تغيرت الدعوة. أعد تحميلها.');
        return {invitation:ownerFields(await lookup(id))};
      }
      if((!id && method==='POST') || (id && !action && method==='PATCH')) {
        const recordId=id||randomUUID();
        if(!id)await limit('create:'+user.id,100,3600);
        const templateId=str(body.templateId??row?.templateId,150,1);
        if(!await templateAllowed(templateId) && !(row && templateId===row.templateId))invalid('القالب غير متوفر.');
        if(row && body.expectedUpdatedAt && row.updatedAt!==body.expectedUpdatedAt)fail(409,'EDIT_CONFLICT','تغيرت الدعوة. أعد تحميلها.');
        const data=validateData(body.data??(row?JSON.parse(row.data):{}),row?.status==='published');
        const inputs={...(row?JSON.parse(row.settings):{}),...body.settings};
        const settings=validateSettings(inputs);
        let pinHash=row?.pinHash||'';
        if(inputs.pin) {
          if(typeof inputs.pin!=='string'||!/^\d{4,12}$/.test(inputs.pin))invalid('الرمز يتكون من 4 إلى 12 رقمًا.');
          pinHash=auth.protectPin(recordId,inputs.pin);
        }
        if(settings.privacy==='pin' && !pinHash)invalid('أدخل رمز حماية للدعوة.');
        if(settings.privacy!=='pin')pinHash='';
        const statements=[];
        for(const image of data.images||[]) {
          if(image.src.startsWith('data:')) {
            const {bytes,mime}=raster(image.src),asset=randomUUID();
            statements.push(['INSERT INTO assets VALUES (?,?,?,?)',asset,user.id,mime,bytes],['INSERT INTO managed_assets VALUES (?)',asset]);
            image.src='/api/assets/'+asset;
          } else if(!await one('SELECT id FROM assets WHERE id=? AND owner=?',image.src.split('/').pop(),user.id)) {
            invalid('الصورة غير مملوكة لك.');
          }
        }
        if(row) {
          statements.push(['UPDATE invitations SET templateId=?,data=?,settings=?,pinHash=?,updatedAt=? WHERE id=? AND updatedAt=?',templateId,JSON.stringify(data),JSON.stringify(settings),pinHash,nextVersion(row),id,row.updatedAt]);
        } else {
          statements.push(['INSERT INTO invitations(id,owner,slug,templateId,data,settings,pinHash,updatedAt) VALUES (?,?,?,?,?,?,?,?)',recordId,user.id,randomBytes(12).toString('base64url'),templateId,JSON.stringify(data),JSON.stringify(settings),pinHash,now()]);
        }
        const results=await batch(statements);
        if(row && !results.at(-1).changes) {
          await run('DELETE FROM assets WHERE id IN (SELECT asset FROM managed_assets) AND owner=? AND NOT EXISTS (SELECT 1 FROM invitation_assets a WHERE a.asset=assets.id)',user.id);
          fail(409,'EDIT_CONFLICT','تغيرت الدعوة. أعد تحميلها.');
        }
        return {invitation:ownerFields(await lookup(recordId))};
      }
    }
    if(base==='public' && id) {
      const row=await published(id);
      if(!row)absent();
      const settings=JSON.parse(row.settings);
      if(action==='unlock' && method==='POST') {
        await limit('pin:'+id,12,900);
        if(settings.privacy==='pin') {
          if(row.pinHash!==auth.protectPin(row.id,str(body.pin,12,1)))fail(401,'PIN_REQUIRED','رمز الدعوة غير صحيح.');
          auth.unlock(res,row);
        }
        return {invitation:publicFields(row)};
      }
      publicAccess(req,row);
      if(!action && method==='GET')return {invitation:publicFields(row)};
      if(action==='rsvp' && method==='POST') {
        if(!settings.rsvpEnabled)absent();
        const name=str(body.name,100,1),comment=str(body.comment??'',1000);
        if(typeof body.attending!=='boolean')invalid();
        const count=body.attending?integer(body.count??1,1,settings.maxGuests):0;
        await limit('rsvp:'+id,8,3600);
        await run('INSERT INTO responses VALUES (?,?,?,?,?,?,?)',randomUUID(),row.id,name,+body.attending,count,comment,now());
        return {ok:true};
      }
      if(action==='report' && method==='POST') {
        const reason=str(body.reason,1500,3);
        await limit('report',8,3600);
        await run('INSERT INTO reports(id,invitation,reason,createdAt) VALUES (?,?,?,?)',randomUUID(),row.id,reason,now());
        return {ok:true};
      }
    }
    if(base==='admin') {
      const user=await owner(req);
      if(user.role!=='admin')fail(403,'FORBIDDEN','هذه الصفحة لمسؤول المنصة.');
      if(!id && method==='GET') {
        const list=async table=>(await all('SELECT id,published FROM '+table)).map(r=>({...r,published:!!r.published}));
        return {templates:await list('templates'),categories:await list('categories'),reports:await all('SELECT r.id,i.slug,r.reason,r.status,r.createdAt FROM reports r JOIN invitations i ON i.id=r.invitation ORDER BY r.createdAt DESC')};
      }
      if(action && method==='PATCH' && ['categories','templates','reports'].includes(id)) {
        if(!await one('SELECT id FROM '+id+' WHERE id=?',action))absent();
        let change;
        if(id==='reports') {
          if(!['resolved','open'].includes(body.status))invalid();
          change=['UPDATE reports SET status=? WHERE id=?',body.status,action];
        } else {
          if(typeof body.published!=='boolean')invalid();
          change=['UPDATE '+id+' SET published=? WHERE id=?',+body.published,action];
        }
        await batch([change,['INSERT INTO audit VALUES (?,?,?,?)',id,user.id,action,now()]]);
        return {ok:true};
      }
    }
    absent();
  }
  return {route,published};
}

