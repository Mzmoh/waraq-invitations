import {isIP} from 'node:net';
import {resolve,relative,isAbsolute,sep} from 'node:path';
export function normalizeIP(value) {
 if(typeof value!=='string'||!isIP(value))return null;
 if(value.startsWith('::ffff:')&&isIP(value.slice(7))===4)return value.slice(7);
 return isIP(value)===6?new URL('http://['+value+']/').hostname.slice(1,-1):value;
}
export function trustedProxies(value='') {
 const list=value.split(',').map(x=>x.trim()).filter(Boolean);
 const normalized=list.map(normalizeIP);if(normalized.some(x=>!x))throw Error('TRUSTED_PROXY_IPS must contain exact IP addresses, not networks or hostnames.');
 return new Set(normalized);
}
export function clientAddress(req,trusted) {
 const remote=normalizeIP(req.socket.remoteAddress)||'unknown';
 if(!trusted.has(remote))return remote;
 // This header is overwritten by the supplied Caddy config. Never trust XFF.
 return normalizeIP(req.headers['x-waraq-client-ip'])||remote;
}
export function validateProduction(env,{database,publicDir}) {
 trustedProxies(env.TRUSTED_PROXY_IPS);
 if(env.NODE_ENV!=='production')return;
 let origin;try{origin=new URL(env.PUBLIC_ORIGIN)}catch{throw Error('Production requires PUBLIC_ORIGIN=https://your-domain');}
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw Error('PUBLIC_ORIGIN must be a canonical HTTPS origin.');
 if(env.COOKIE_SECURE!=='true')throw Error('Production requires COOKIE_SECURE=true');
 if(database===':memory:')throw Error('Production requires persistent DATABASE_PATH');
 const path=relative(resolve(publicDir),resolve(database));
 const outside=path==='..'||path.startsWith('..'+sep)||isAbsolute(path);
 if(!outside)throw Error('The database must be outside the public directory.');
}
