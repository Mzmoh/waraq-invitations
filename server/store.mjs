import {DatabaseSync} from 'node:sqlite'
import {randomBytes, randomUUID, createHash, createHmac, scrypt, timingSafeEqual} from 'node:crypto'
import {promisify} from 'node:util'
import {readFileSync,mkdirSync} from 'node:fs'
import {dirname} from 'node:path'
import {fail,invalid} from './validation.mjs'
const derive = promisify(scrypt)
export const token = () => randomBytes(32).toString('base64url')
export const digest = s => createHash('sha256').update(s).digest('hex')
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const key = await derive(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024})
  return salt+'.'+key.toString('hex')
}
export async function passwordMatches(password,stored) {
  const [salt,key] = stored.split('.')
  const actual = await derive(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024})
  return timingSafeEqual(actual,Buffer.from(key,'hex'))
}
export function openStore(file,templates) {
  if (file !== ':memory:') mkdirSync(dirname(file),{recursive:true})
  const db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;')
  db.exec(readFileSync(new URL('./migrations/001.sql',import.meta.url),'utf8'))
  db.exec(readFileSync(new URL('./migrations/002.sql',import.meta.url),'utf8'))
  db.exec(readFileSync(new URL('./migrations/003.sql',import.meta.url),'utf8'))
  db.exec(readFileSync(new URL('./migrations/004.sql',import.meta.url),'utf8'))
  const category = db.prepare('INSERT OR IGNORE INTO categories(id) VALUES (?)')
  const template = db.prepare('INSERT INTO templates(id,category) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET category=excluded.category')
  transaction(db,()=>{
    for (const t of templates) { category.run(t.category); template.run(t.id,t.category) }
    db.prepare("INSERT OR IGNORE INTO secrets(name,value) VALUES ('hmac',?)").run(token())
  })
  return db
}
export function transaction(db,fn) {
  db.exec('BEGIN IMMEDIATE')
  try { const result=fn(); db.exec('COMMIT'); return result }
  catch(e) { db.exec('ROLLBACK'); throw e }
}
export function makeAuth(db) {
  const secret=db.prepare("SELECT value FROM secrets WHERE name='hmac'").get().value
  const mac = s => createHmac('sha256',secret).update(s).digest('hex')
  const cookie = (req,name) => (req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||''
  const set = (res,name,value,seconds,path='/') => {
    const secure = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production'
    const entry = name+'='+value+'; Path='+path+'; HttpOnly; SameSite=Lax; Max-Age='+seconds+(secure?'; Secure':'')
    res.setHeader('Set-Cookie',[...(res.getHeader('Set-Cookie')||[]),entry])
  }
  const user=req => db.prepare('SELECT u.id,u.email,u.role FROM sessions s JOIN users u ON u.id=s.userId WHERE s.hash=? AND s.expires>?').get(digest(cookie(req,'invite_session')),Date.now())
  const logout=(req,res)=>{
    db.prepare('DELETE FROM sessions WHERE hash=?').run(digest(cookie(req,'invite_session')))
    set(res,'invite_session','',0)
  }
  const session=(req,res,id)=>{
    db.prepare('DELETE FROM sessions WHERE hash=? OR expires<=?').run(digest(cookie(req,'invite_session')),Date.now())
    const value=token(), seconds=14*86400
    db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(digest(value),id,Date.now()+1000*seconds)
    set(res,'invite_session',value,seconds)
  }
  const limit=(bucket,maximum,seconds)=>{
    const now=Date.now()
    db.prepare('DELETE FROM limits WHERE expires<=?').run(now)
    const {hits}=db.prepare('INSERT INTO limits VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=hits+1 RETURNING hits').get(mac(bucket),now+seconds*1000)
    if (hits>maximum) fail(429,'RATE_LIMIT','محاولات كثيرة. انتظر قبل المحاولة مجددًا.')
  }
  const pinName = slug=>'invite_pin_'+slug
  const pinValue = (row,expires) => mac([row.id,row.pinHash,expires].join('|'))
  return {user,logout,session,limit,
    protectPin:(id,pin)=>mac('pin|'+id+'|'+pin), 
    unlock:(res,row)=>{const exp=Date.now()+86400000; set(res,pinName(row.slug),exp+'.'+pinValue(row,exp),86400)},
    hasGrant:(req,row)=>{
      const [exp,signature]=cookie(req,pinName(row.slug)).split('.')
      return Number(exp)>Date.now() && signature===pinValue(row,exp)
    }
  }
}
export async function bootstrap(db) {
  const email=process.env.ADMIN_EMAIL?.trim().toLowerCase(), password=process.env.ADMIN_PASSWORD
  if (!email || !password) return
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length<12 || password.length>128) invalid('Invalid admin bootstrap configuration')
  const existing=db.prepare('SELECT role FROM users WHERE email=?').get(email)
  if (existing && existing.role !== 'admin') throw Error('Admin bootstrap email already belongs to a creator')
  if (!existing) db.prepare("INSERT INTO users(id,email,password,role) VALUES (?,?,?,'admin')").run(randomUUID(),email,await hashPassword(password))
}

