import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {templates} from '../public/templates/index.js';
mkdirSync('drizzle/meta',{recursive:true});
const categories=[...new Set(templates.map(template=>template.category))];
const quote=value=>"'"+value.replaceAll("'","''")+"'";
writeFileSync('drizzle/0002_catalog.sql',[
  ...categories.map(category=>'INSERT OR IGNORE INTO categories(id) VALUES ('+quote(category)+');'),
  ...templates.map(template=>'INSERT OR IGNORE INTO templates(id,category) VALUES ('+quote(template.id)+','+quote(template.category)+');')
].join('\n--> statement-breakpoint\n')+'\n');
const journal={version:'7',dialect:'sqlite',entries:[
  {idx:0,version:'6',when:1795104000000,tag:'0000_001',breakpoints:true},
  {idx:1,version:'6',when:1795104000001,tag:'0001_002',breakpoints:true},
  {idx:2,version:'6',when:1795104000002,tag:'0002_catalog',breakpoints:true},
  {idx:3,version:'6',when:1795104000003,tag:'0003_lifecycle',breakpoints:true}
]};
writeFileSync('drizzle/meta/_journal.json',JSON.stringify(journal,null,2)+'\n');
for(const [source,target] of [['001','0000_001'],['002','0001_002'],['003','0003_lifecycle']]) {
  const lines=readFileSync('server/migrations/'+source+'.sql','utf8').trim().split('\n');
  let trigger=false;
  const output=[];
  for(const line of lines) {
    if(/^CREATE TRIGGER/i.test(line.trim()))trigger=true;
    output.push(line);
    if(trigger && /END;\s*$/.test(line))trigger=false;
    if(!trigger && /;\s*$/.test(line))output.push('--> statement-breakpoint');
  }
  if(output.at(-1)==='--> statement-breakpoint')output.pop();
  writeFileSync('drizzle/'+target+'.sql',output.join('\n')+'\n');
}
console.log('Prepared schema-only migrations and 80-template catalog seed.');

