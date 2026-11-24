import {trialPool} from '../server/trial/postgres.mjs';
import {privateStorage} from '../server/trial/storage.mjs';
import {createTrialHandler} from '../server/trial/handler.mjs';
let handler;
export default {async fetch(request){
 try{handler??=createTrialHandler({pool:await trialPool(),storage:privateStorage(process.env)});return await handler(request);}
 catch{return Response.json({error:{code:'TRIAL_NOT_CONFIGURED',message:'Trial deployment is not configured.'}},{status:503,headers:{'Cache-Control':'no-store'}});}
}};
