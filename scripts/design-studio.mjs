// Explicit opt-in, loopback-only studio. Nothing in dev/ is copied to public/.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createApp} from '../server/index.mjs';
const files=new Map([['/dev/design-studio','studio.html'],['/dev/studio.js','studio.js'],['/dev/studio.css','studio.css'],['/dev/optical-proof.js','optical-proof.js']]);
const {server:app}=await createApp({database:':memory:'});await new Promise(r=>app.listen(0,'127.0.0.1',r));
const server=http.createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path.startsWith('/dev/')){
  const file=files.get(path);if(!file){res.writeHead(404);return res.end();}
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'");
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html; charset=utf-8');
  try{res.end(await readFile(new URL('../dev/'+file,import.meta.url)));}catch{res.writeHead(500);res.end('Studio file unavailable');}return;
 }
 // Preserve the browser-visible Host so the existing CSRF Origin check and
 // generated invitation URLs use the outer loopback origin.
 const upstream=http.request({hostname:'127.0.0.1',port:app.address().port,path:req.url,method:req.method,headers:req.headers},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res);});upstream.on('error',()=>{res.writeHead(502);res.end();});req.pipe(upstream);
});
server.listen(Number(process.env.STUDIO_PORT||4318),'127.0.0.1',()=>console.log('WARAQ local studio http://127.0.0.1:'+server.address().port+'/dev/design-studio — disposable SQLite'));
function close(){server.close();app.close();}process.on('SIGINT',close);process.on('SIGTERM',close);
