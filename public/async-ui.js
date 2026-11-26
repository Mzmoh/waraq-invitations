// Delay indicators so fast cached/local operations do not flash a skeleton.
export function delayedSkeleton(host,delay=180){
 const initial=[...host.childNodes];let timer=setTimeout(()=>{
  timer=null;const shell=document.createElement('div');shell.className='perf-skeleton';shell.setAttribute('aria-hidden','true');
  for(let i=0;i<3;i++){const row=document.createElement('div');row.className='perf-skeleton-row';shell.append(row);}host.append(shell);
 },delay);
 return ()=>{if(timer!==null)clearTimeout(timer);host.querySelector('.perf-skeleton')?.remove();};
}
export async function optimisticChange({apply,commit,rollback}){
 apply();try{return await commit();}catch(error){rollback();throw error;}
}
