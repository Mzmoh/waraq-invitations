export function remoteDatabase(db) {
  const bind=(sql,args)=>db.prepare(sql).bind(...args.map(value=>value instanceof Uint8Array?[...value]:value));
  return {
    readMany:async statements=>(await db.batch(statements.map(([sql,...args])=>bind(sql,args)))).map(r=>r.results||[]),
    one:(sql,...args)=>bind(sql,args).first(),
    all:async(sql,...args)=>(await bind(sql,args).all()).results,
    run:async(sql,...args)=>{const result=await bind(sql,args).run();return {...result,changes:result.meta.changes}},
    batch:async statements=>(await db.batch(statements.map(([sql,...args])=>bind(sql,args)))).map(result=>({...result,changes:result.meta.changes}))
  };
}

