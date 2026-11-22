import {createRequire} from 'node:module';
import {readFileSync,readdirSync,mkdirSync,writeFileSync,cpSync} from 'node:fs';
import {join,extname} from 'node:path';

const require=createRequire(import.meta.url);
const {build}=require(process.env.ESBUILD_MODULE||'esbuild');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2','.png':'image/png','.txt':'text/plain'};
const assets={};
for(const file of readdirSync('public',{recursive:true})) {
  if(!extname(file))continue;
  const type=mime[extname(file)];
  if(!type)continue;
  assets['/'+file.replaceAll('\\','/')]={type,body:readFileSync(join('public',file)).toString('base64')};
}
mkdirSync('dist/server',{recursive:true});
mkdirSync('dist/.openai',{recursive:true});
await build({
  entryPoints:['worker/index.mjs'],outfile:'dist/server/index.js',
  bundle:true,platform:'neutral',format:'esm',target:'es2022',
  external:['node:crypto','node:util','node:buffer'],
  plugins:[{
    name:'static-assets',
    setup(build) {
      build.onResolve({filter:/^virtual:static$/},()=>({path:'assets',namespace:'static'}));
      build.onLoad({filter:/.*/,namespace:'static'},()=>({contents:'export const assets='+JSON.stringify(assets),loader:'js'}));
    }
  }]
});
cpSync('.openai/hosting.json','dist/.openai/hosting.json');
writeFileSync('dist/server/wrangler.json',JSON.stringify({main:'index.js',compatibility_date:'2026-11-01',compatibility_flags:['nodejs_compat']}));
console.log('Built hosted Worker with '+Object.keys(assets).length+' static assets.');

