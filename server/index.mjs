import http from 'node:http'
import {readFile,stat,realpath} from 'node:fs/promises'
import {resolve,extname,sep} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {openStore,bootstrap} from './store.mjs'
import {HttpError,fail,plain} from './validation.mjs'
import {apiHandler} from './api.mjs'

const root=fileURLToPath(new URL('../',import.meta.url))
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.woff2':'font/woff2','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8','.mp4':'video/mp4'}
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
async function readBody(req) {
  if (req.headers['content-type']?.split(';')[0]!=='application/json') fail(415,'JSON_REQUIRED','أرسل البيانات بصيغة JSON.')
  let n=0
  const chunks=[]
  for await (const chunk of req) {
    n+=chunk.length
    if (n>6_000_000) fail(413,'BODY_TOO_LARGE','حجم البيانات يتجاوز المسموح.')
    chunks.push(chunk)
  }
  let parsed
  try {parsed=JSON.parse(Buffer.concat(chunks).toString()||'{}')} catch {fail(400,'INVALID_JSON','البيانات غير صالحة.')}
  if (!plain(parsed)) fail(400,'INVALID_JSON','البيانات غير صالحة.')
  return parsed
}
export async function createApp({database=process.env.DATABASE_PATH||resolve(root,'var/invitations.sqlite'),templates,publicDir=resolve(root,'public'),origin=process.env.PUBLIC_ORIGIN}={}) {
  templates??=(await import('../public/templates/index.js')).templates
  const db=openStore(database,templates)
  await bootstrap(db)
  const {route,published}=await apiHandler(db)
  const publicPath=await realpath(publicDir)
  const server=http.createServer({requestTimeout:30000,headersTimeout:15000},async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff')
    res.setHeader('Referrer-Policy','strict-origin-when-cross-origin')
    res.setHeader('X-Frame-Options','SAMEORIGIN')
    res.setHeader('Cache-Control','no-store')
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'")
    try {
      const appOrigin=origin?new URL(origin).origin:'http://'+req.headers.host
      const url=new URL(req.url,'http://localhost')
      let path
      try {path=decodeURIComponent(url.pathname)} catch {fail(400,'BAD_PATH','رابط غير صالح.')}
      if (path.includes('\\') || path.includes('\0') || path.split('/').includes('..')) fail(400,'BAD_PATH','رابط غير صالح.')
      if (path.startsWith('/api/')) {
        let body={}
        if (!['GET','HEAD'].includes(req.method)) {
          if (req.headers['sec-fetch-site']==='cross-site' || (req.headers.origin && req.headers.origin!==appOrigin)) fail(403,'BAD_ORIGIN','الطلب مرفوض.')
          body=await readBody(req)
        }
        const result=await route(req,res,path.replace(/\/$/,''),body)
        if (!res.writableEnded) {res.setHeader('Content-Type','application/json; charset=utf-8'); res.end(JSON.stringify(result))}
        return
      }
      if (!['GET','HEAD'].includes(req.method)) fail(405,'METHOD_NOT_ALLOWED','طريقة غير مدعومة.')
      const send=(type,bytes)=>{res.setHeader('Content-Type',type); res.end(req.method==='HEAD'?undefined:bytes)}
      if (path==='/robots.txt') return send('text/plain; charset=utf-8','User-agent: *\nDisallow: /api/\nDisallow: /i/\nDisallow: /dashboard\nDisallow: /admin\n')
      if (path==='/sitemap.xml') {
        const pages=['/','/occasions',...Array.from(new Set(templates.map(t=>t.category))).map(c=>'/occasions/'+c)]
        return send('application/xml','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+pages.map(p=>'<url><loc>'+escape(appOrigin+p)+'</loc></url>').join('')+'</urlset>')
      }
      const guest=path.match(/^\/i\/([\w-]+)$/)
      if (path!=='/' && (extname(path)||path.startsWith('/media/')||path.startsWith('/vendor/'))) {
        const f=resolve(publicPath,'.'+path)
        const actual=await realpath(f).catch(()=>null)
        if (!actual || !actual.startsWith(publicPath+sep) || !(await stat(actual)).isFile()) fail(404,'NOT_FOUND','الملف غير متاح.')
        res.setHeader('Cache-Control','public, max-age=60')
        return send(mime[extname(actual).toLowerCase()]||'application/octet-stream',await readFile(actual))
      }
      let html=await readFile(resolve(publicPath,'index.html'),'utf8')
      if (guest) {
        res.setHeader('X-Robots-Tag','noindex, nofollow')
        const row=await published(guest[1])
        if (!row) res.statusCode=404
        const open=row && JSON.parse(row.settings).privacy==='public'
        const data=open?JSON.parse(row.data):{}
        const title=data.title||'دعوة إلكترونية',description=data.message?.slice(0,160)||'افتح الدعوة التفاعلية.'
        const social='<meta property="og:type" content="website"><meta property="og:title" content="'+escape(title)+'"><meta property="og:description" content="'+escape(description)+'"><meta property="og:url" content="'+escape(appOrigin+path)+'">'
        const cover=open?templates.find(t=>t.id===row.templateId)?.thumbnail:null
        html=html.replace(/<title>[\s\S]*?<\/title>/i,'<title>'+escape(title)+'</title>').replace('</head>',social+(cover?'<meta property="og:image" content="'+escape(new URL(cover,appOrigin).href)+'">':'')+'</head>')
      } else if (!/^\/(?:$|occasions(?:\/[\w-]+)?$|(?:templates|create)\/[\w-]+$|dashboard(?:\/invitations\/[\w-]+)?$|auth(?:\/[\w-]+)?$|login$|register$|admin$)/.test(path)) res.statusCode=404
      return send(mime['.html'],html)
    } catch(e) {
      if (res.writableEnded) return
      const expected=e instanceof HttpError
      if (!expected) console.error('Request failed:',e.code||e.name)
      res.statusCode=expected?e.status:500
      res.setHeader('Content-Type','application/json; charset=utf-8')
      if (res.statusCode===429) res.setHeader('Retry-After','900')
      res.end(JSON.stringify({code:expected?e.code:'SERVER_ERROR',error:expected?e.message:'تعذّر إكمال الطلب.'}))
    }
  })
  server.on('close',()=>db.close())
  return {server,db}
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try {process.loadEnvFile?.(resolve(root,'.env'))} catch(e) {if(e.code!=='ENOENT') throw e}
  const {server}=await createApp()
  const port=Number(process.env.PORT||3000),host=process.env.HOST||'127.0.0.1'
  server.listen(port,host,()=>console.log('Invitation Studio listening at http://'+host+':'+server.address().port))
  for (const s of ['SIGINT','SIGTERM']) process.once(s,()=>server.close())
}

