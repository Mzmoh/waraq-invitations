import {cpSync,readFileSync,mkdirSync,statSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {templates} from '../public/templates/index.js';

const checked = spawnSync(process.execPath,['scripts/check.mjs'],{stdio:'inherit'});
if (checked.status !== 0) process.exit(checked.status || 1);
const counts = new Map();
for (const template of templates) {
  counts.set(template.category,(counts.get(template.category) ?? 0)+1);
  if (!statSync('public'+template.thumbnail).isFile()) throw new Error(`Missing cover for ${template.id}`);
}
if (templates.length !== 80 || counts.size !== 8 || [...counts.values()].some(count=>count!==10) ||
  new Set(templates.map(template=>template.id)).size !== 80) {
  throw new Error('The release requires eight categories of ten distinct templates.');
}
mkdirSync('dist',{recursive:true});
for (const name of ['public','server']) cpSync(name,`dist/${name}`,{recursive:true});
readFileSync('dist/server/index.mjs');
console.log('Built Node application in dist/ with 80 covers.');

