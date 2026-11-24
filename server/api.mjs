import {localDatabase} from './database.mjs';
import {createAuth} from './auth.mjs';
import {portableAPI} from './api-portable.mjs';
import {mailConfiguration} from './account-recovery.mjs';

export async function apiHandler(db,mail=mailConfiguration(process.env)) {
  const store=localDatabase(db);
  const auth=await createAuth(store,{secure:process.env.COOKIE_SECURE==='true'||process.env.NODE_ENV==='production'});
  return portableAPI(store,auth,mail);
}
