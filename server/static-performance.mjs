import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const cache=new Map();let cachedBytes=0;
const text=/\.(?:js|mjs|css|svg|json|html|txt|xml)$/;
export function publicRepresentation(path,bytes,acceptEncoding=''){
 const digest=createHash('sha256').update(bytes).digest('hex');const etag='W/"'+digest+'"';
 let entry=cache.get(path);if(entry?.etag!==etag){if(entry)cachedBytes-=entry.size;entry={etag,bytes,gzip:text.test(path)&&bytes.length>1024?gzipSync(bytes,{level:6}):null};entry.size=entry.bytes.length+(entry.gzip?.length||0);cache.delete(path);cache.set(path,entry);cachedBytes+=entry.size;
  while(cachedBytes>8*1024*1024&&cache.size>1){const key=cache.keys().next().value;cachedBytes-=cache.get(key).size;cache.delete(key);}
 }
 const gzip=entry.gzip&&/(?:^|,)\s*gzip\s*(?:;\s*q=(?!0(?:\.0*)?(?:,|$))[^,]+)?(?:,|$)/i.test(acceptEncoding);
 return {etag,body:gzip?entry.gzip:entry.bytes,encoding:gzip?'gzip':null,cacheControl:'public, max-age=0, must-revalidate'};
}
