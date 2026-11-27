import {trialPool} from '../server/trial/postgres.mjs';
import {privateStorage} from '../server/trial/storage.mjs';
import {createTrialHandler} from '../server/trial/handler.mjs';
let handler;
export default {
 async fetch(request) {
  try {
   if (!handler) {
    const required = ['DATABASE_URL','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','PUBLIC_ORIGIN','WARAQ_TRIAL_ONLY','COOKIE_SECURE'];
    const missing = required.filter(name => !process.env[name]);
    if (missing.length) {
     console.error('Trial configuration missing environment variables', missing.join(', '));
     throw new Error('Missing trial configuration');
    }
    handler = createTrialHandler({pool:await trialPool(),storage:privateStorage(process.env)});
   }
   return await handler(request);
  } catch {
   // Configuration exceptions can contain credentials. Log a fixed message only.
   console.error('Trial initialization failed. Check server-side trial configuration.');
   return Response.json({error:{code:'TRIAL_NOT_CONFIGURED',message:'Trial deployment is not configured.'}},{status:503,headers:{'Cache-Control':'no-store'}});
  }
 }
};
