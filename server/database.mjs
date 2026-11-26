import {transaction} from './store.mjs';

export function localDatabase(db) {
  return {
    readMany:statements=>statements.map(([sql,...args])=>db.prepare(sql).all(...args)),
    one:(sql,...args)=>db.prepare(sql).get(...args),
    all:(sql,...args)=>db.prepare(sql).all(...args),
    run:(sql,...args)=>db.prepare(sql).run(...args),
    batch:statements=>transaction(db,()=>statements.map(([sql,...args])=>db.prepare(sql).run(...args)))
  };
}