import {localDatabase} from './database.mjs';
import {createAuth} from './auth.mjs';
import {portableAPI} from './api-portable.mjs';

export async function apiHandler(db) {
  const store=localDatabase(db);
  const auth=await createAuth(store,{secure:process.env.COOKIE_SECURE==='true'||process.env.NODE_ENV==='production'});
  return portableAPI(store,auth);
}