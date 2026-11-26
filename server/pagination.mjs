import {fail} from './validation.mjs';
export function pageRequest(req,defaultSize=30){
 const search=new URL(req.url||'/', 'http://localhost').searchParams;
 const raw=search.get('limit');const limit=raw===null?defaultSize:Number(raw);
 if(!Number.isInteger(limit)||limit<1||limit>100)fail(400,'INVALID_PAGE','Page size must be 1–100.');
 let cursor=null;const value=search.get('cursor');
 if(value){try{
  if(value.length>512||!/^[a-zA-Z0-9_-]+$/.test(value))throw Error();
  cursor=JSON.parse(Buffer.from(value,'base64url').toString());
  if(!Array.isArray(cursor)||cursor.length!==2||typeof cursor[0]!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(cursor[0])||!Number.isFinite(Date.parse(cursor[0]))||typeof cursor[1]!=='string'||!/^[\w-]{1,128}$/.test(cursor[1]))throw Error();
 }catch{fail(400,'INVALID_CURSOR','Invalid page cursor.');}}
 const status=search.get('status');if(status&&!['all','draft','published','archived'].includes(status))fail(400,'INVALID_PAGE','Invalid status filter.');
 return {limit,cursor,status:status&&status!=='all'?status:null};
}
export function pageResult(rows,{limit},timeKey){
 const more=rows.length>limit,items=rows.slice(0,limit),last=items.at(-1);
 return {items,pagination:{limit,hasMore:more,nextCursor:more?Buffer.from(JSON.stringify([last[timeKey],last.id])).toString('base64url'):null}};
}
export function invitationList(owner,{limit,cursor,status}){
 const condition=(status?' AND i.status=?':'')+(cursor?' AND (i.updatedAt<? OR (i.updatedAt=? AND i.id<?))':'');
 const args=[owner,...(status?[status]:[]),...(cursor?[cursor[0],cursor[0],cursor[1]]:[]),limit+1];
 const sql=`WITH page AS (SELECT i.id,i.slug,i.templateId,i.status,i.updatedAt,i.pinHash,i.settings,json_object('title',json_extract(i.data,'$.title')) AS data FROM invitations i WHERE i.owner=?${condition} ORDER BY i.updatedAt DESC,i.id DESC LIMIT ?), counts AS (SELECT invitation,count(*) AS replies FROM responses WHERE invitation IN(SELECT id FROM page) GROUP BY invitation) SELECT i.id,i.slug,i.templateId,i.status,i.updatedAt,i.pinHash,i.settings,i.data,t.published*c.published AS linkActive,COALESCE(r.replies,0) AS responseCount FROM page i JOIN templates t ON t.id=i.templateId JOIN categories c ON c.id=t.category LEFT JOIN counts r ON r.invitation=i.id ORDER BY i.updatedAt DESC,i.id DESC`;
 return [sql,...args];
}
export function responseList(invitation,{limit,cursor}){
 const condition=cursor?' AND (createdAt<? OR (createdAt=? AND id<?))':'';
 return ['SELECT id,name,attending,count,comment,createdAt FROM responses WHERE invitation=?'+condition+' ORDER BY createdAt DESC,id DESC LIMIT ?',invitation,...(cursor?[cursor[0],cursor[0],cursor[1]]:[]),limit+1];
}
