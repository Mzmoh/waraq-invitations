import {createHash} from 'node:crypto';
const bucket='waraq-trial-private';
export function privateStorage(env,{fetcher=fetch}={}){
 const url=new URL(env.SUPABASE_URL||'');if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||!env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Private Supabase storage configuration required');
 const headers={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY};
 const endpoint=key=>url.origin+'/storage/v1/object/'+bucket+'/'+key.split('/').map(encodeURIComponent).join('/');
 const valid=key=>typeof key==='string'&&/^[\w-]{1,128}\/[a-f\d-]{36}$/.test(key);
 return {
  async put({id,owner,mime,bytes}){
   const key=owner+'/'+id;if(!valid(key)||!bytes.length||bytes.length>1400000)throw Error('Invalid private object');
   const response=await fetcher(endpoint(key),{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{...headers,'Content-Type':mime,'x-upsert':'false'},body:bytes});if(!response.ok)throw Error('Private upload failed');
   return {key,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  },
  async get(meta){
   if(!valid(meta.key)||meta.key!==meta.owner+'/'+meta.id||!Number.isInteger(meta.size)||meta.size>1400000)throw Error('Invalid media binding');
   const response=await fetcher(endpoint(meta.key),{redirect:'error',signal:AbortSignal.timeout(10000),headers});if(!response.ok)throw Error('Private download failed');
   const data=new Uint8Array(await response.arrayBuffer());if(data.length!==meta.size||createHash('sha256').update(data).digest('hex')!==meta.sha256)throw Error('Private media integrity failed');return data;
  },
  async remove(keys){
   if(keys.some(k=>!valid(k)))throw Error('Invalid cleanup key');
   const response=await fetcher(url.origin+'/storage/v1/object/'+bucket,{method:'DELETE',redirect:'error',signal:AbortSignal.timeout(10000),headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({prefixes:keys})});if(!response.ok)throw Error('Private cleanup failed');
  }
 };
}
