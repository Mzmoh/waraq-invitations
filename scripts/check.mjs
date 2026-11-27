import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';

const roots = ['public','server','scripts','worker','api','dev'];
const files = roots.flatMap(root => readdirSync(root,{recursive:true}).map(file => join(root,file)));
let checked = 0;
for (const file of files.filter(file=>/\.(m?js)$/.test(file))) {
  const run = spawnSync(process.execPath,['--check',file],{stdio:'inherit'});
  if (run.status !== 0) process.exit(run.status || 1);
  checked++;
}
console.log(`Syntax validated for ${checked} JavaScript modules.`);

