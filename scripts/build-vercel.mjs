import './build-catalog.mjs';
import {cpSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const check=spawnSync(process.execPath,['scripts/check.mjs'],{stdio:'inherit'});
if(check.status!==0)process.exit(check.status||1);
mkdirSync('dist/vercel',{recursive:true});
cpSync('public','dist/vercel',{recursive:true});
console.log('Vercel static build ready; API and private configuration are excluded.');
