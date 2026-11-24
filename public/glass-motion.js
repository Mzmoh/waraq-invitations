// One deterministic timeline drives all scene and typography state.
export const glassDefaults=Object.freeze({duration:6,fps:30,aspect:'16:9',motion:1,startRotation:-.22,rotationSpeed:.035,drift:.035,cameraSpeed:.1,hold:.25,width:4.9,height:3.6,depth:.24,radius:.35,transmission:1,ior:1.46,thickness:.65,roughness:.16,clearcoat:1,fov:33,
 palette:Object.freeze({deep:'#221b49',coral:'#ff675f',violet:'#7059f3',amber:'#ffbc66',paper:'#fff5f1'})});
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export function glassOptions(input={}){
 const o={...glassDefaults,...input,palette:{...glassDefaults.palette}};
 for(const k of Object.keys(o.palette))if(/^#[a-f0-9]{6}$/i.test(input.palette?.[k]||''))o.palette[k]=input.palette[k];
 for(const [k,min,max] of [['duration',2,30],['fps',1,60],['motion',0,1],['startRotation',-.6,.6],['rotationSpeed',0,.2],['drift',0,.035],['cameraSpeed',0,.1],['hold',.25,.75]])o[k]=Number.isFinite(input[k])?clamp(input[k],min,max):glassDefaults[k];
 // Geometry and optical values are bounded developer parameters, not URL input.
 for(const [k,min,max] of [['width',2,8],['height',2,8],['depth',.1,.5],['radius',.1,.8],['transmission',0,1],['ior',1,2.33],['thickness',.1,2],['roughness',0,1],['clearcoat',0,1],['fov',20,60]])o[k]=Number.isFinite(input[k])?clamp(input[k],min,max):glassDefaults[k];
 o.aspect=input.aspect==='9:16'?'9:16':'16:9';return o;
}
export function glassFrame(seconds,input={},reduced=false){
 const o=glassOptions(input),time=clamp(Number.isFinite(seconds)?seconds:0,0,o.duration);
 const end=o.duration*(1-o.hold),active=reduced?end:Math.min(time,end),progress=active/end;
 const m=reduced?0:o.motion,limit=o.width*.05;
 return {time,progress,holding:reduced||time>=end,rotation:o.startRotation+o.rotationSpeed*active*m,
  drift:Math.sin(progress*Math.PI*2)*o.drift*m,cameraX:limit*Math.sin(o.cameraSpeed*active/limit)*m,
  formRotation:active*.08*m,reveal:reduced?1:clamp((time-.35)/1.1,0,1)};
}
export function glassCapability({reduced=false,saveData=false,memory,cores,webgl=true,mode='auto'}={}){
 if(mode==='light')return 'light';
 if(reduced)return 'reduced';
 if(saveData||(memory&&memory<=4)||(cores&&cores<=2)||!webgl)return 'light';
 return 'webgl';
}
export function createMotionClock(now=()=>performance.now()){
 let elapsed=0,anchor=now(),running=true;
 return {time(){return elapsed+(running?(now()-anchor)/1000:0);},pause(){if(running){elapsed+=(now()-anchor)/1000;running=false;}},play(){if(!running){anchor=now();running=true;}},seek(seconds){elapsed=Math.max(0,seconds);anchor=now();},get running(){return running;}};
}
