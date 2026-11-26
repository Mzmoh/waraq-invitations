import {glassOptions,glassFrame,glassCapability,createMotionClock} from './glass-motion.js';

export async function mountGlassScene(host,input={}){
 let options=glassOptions(input),disposed=false,frame=0,three,resources,visible=true,userPaused=false,finished=false,samples=0,totalCost=0;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),abort=new AbortController(),{signal}=abort;
 const clock=createMotionClock();let generation=0;
 const canvas=host.querySelector('canvas'),copy=host.querySelector('.glass-copy');
 const status=host.querySelector('[data-glass-status]');
 function state(value){host.dataset.renderer=value;if(status)status.textContent=value==='webgl'?(document.documentElement.lang==='ar'?'زجاج ثلاثي الأبعاد':'Refractive glass'):(document.documentElement.lang==='ar'?'عرض هادئ وخفيف':'Quiet, lightweight view');}
 function drawAt(time,force=false){
  const f=glassFrame(time,options,reduced.matches||options.motion===0);host.dataset.holding=String(f.holding);
  const pose=[f.rotation,f.drift,f.cameraX,f.formRotation,f.reveal].join('|');
  if(resources&&!force&&resources.pose===pose)return f;
  copy?.style.setProperty('--glass-reveal',f.reveal);
  if(resources){const {scene,camera,renderer,slab,forms}=resources;
   slab.rotation.set(-.09*options.motion,f.rotation*.7,f.rotation);slab.position.y=f.drift;
   camera.position.x=f.cameraX;camera.lookAt(0,0,0);
   forms.forEach((form,i)=>{form.rotation.z=f.formRotation*(i%2?1:-1);form.position.y=form.userData.y+f.drift*(i+1);});
   renderer.render(scene,camera);resources.pose=pose;resources.renders=(resources.renders||0)+1;
  }return f;
 }
 function cancel(){cancelAnimationFrame(frame);frame=0;}
 function loop(){
  frame=0;if(disposed||!resources||!visible||document.hidden||userPaused||reduced.matches||options.motion===0)return;
  const time=Math.min(options.duration,Math.floor(clock.time()*options.fps)/options.fps),start=performance.now();
  if(time!==resources.lastTime){drawAt(time);resources.lastTime=time;if(++samples<=25)totalCost+=performance.now()-start;}
  if(samples===25&&totalCost/samples>45){release();state('light');drawAt(options.duration);return;}
  if(time>=options.duration){finished=true;clock.pause();return;}frame=requestAnimationFrame(loop);
 }
 function resume(){if(!userPaused&&!finished&&visible&&!document.hidden){clock.play();if(resources&&!frame&&!reduced.matches)frame=requestAnimationFrame(loop);}}
 function pause(){clock.pause();cancel();}
 function release(){
  cancel();if(!resources)return;const r=resources;resources=null;
  r.scene.traverse(object=>{object.geometry?.dispose();for(const material of [].concat(object.material||[]))material.dispose();});
  r.environment?.dispose();r.renderer.dispose();
 }
 function resize(){if(!resources)return;const {renderer,camera}=resources;const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);if(resources.width===w&&resources.height===h)return;resources.width=w;resources.height=h;renderer.setSize(w,h,false);camera.aspect=w/h;
  const angle=options.fov*Math.PI/360;camera.fov=options.fov;camera.position.z=Math.max(options.height*1.32/(2*Math.tan(angle)),options.width*1.36/(2*Math.tan(angle)*camera.aspect));camera.updateProjectionMatrix();drawAt(Math.min(clock.time(),options.duration),true);
 }
 async function initialize(){
  const ticket=++generation;release();finished=false;samples=0;totalCost=0;
  let capability=glassCapability({reduced:reduced.matches,saveData:navigator.connection?.saveData,memory:navigator.deviceMemory,cores:navigator.hardwareConcurrency,mode:input.mode||'auto'});
  state(capability==='webgl'?'loading':capability);drawAt(options.duration);if(capability!=='webgl')return;
  let context;try{context=canvas.getContext('webgl2',{alpha:false,antialias:true,powerPreference:'low-power'});}catch{state('light');return;}
  if(!context||context.isContextLost()){state('light');return;}
  let pending;
  try{
   three??=await import('./vendor/three/three.module.min.js');if(disposed||ticket!==generation)return;
   const T=three,renderer=new T.WebGLRenderer({canvas,context,alpha:false,antialias:true,powerPreference:'low-power'});
   renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.outputColorSpace=T.SRGBColorSpace;
   const scene=new T.Scene();pending={renderer,scene};scene.background=new T.Color(options.palette.deep);
   const camera=new T.PerspectiveCamera(options.fov,1,.1,60);camera.position.z=9;
   // A procedural lit room supplies real PBR reflections, without remote HDR files.
   const room=new T.Scene();room.background=new T.Color('#665a86');
   const roomMat=new T.MeshBasicMaterial({color:0x171027,side:T.BackSide});room.add(new T.Mesh(new T.BoxGeometry(12,12,12),roomMat));
   for(const [x,y,z,w,h,color]of [[-3,3,2,2,5,0xffffff],[3,2,-1,2,4,0xffc9aa],[0,5,0,5,1,0xe2d5ff]]){
    const light=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color}));light.position.set(x,y,z);light.lookAt(0,0,0);room.add(light);
   }
   const pmrem=new T.PMREMGenerator(renderer),environment=pmrem.fromScene(room,.08);pending.environment=environment;scene.environment=environment.texture;pmrem.dispose();room.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
   scene.add(new T.HemisphereLight(0xfff5f1,0x221b49,2));const key=new T.DirectionalLight(0xffffff,4);key.position.set(-3,5,7);scene.add(key);
   // Extrude a rounded 2D outline: RoundedBoxGeometry clamps radius to depth/2,
   // which cannot express the requested .35 corner on a .24-deep glass slab.
   const bevel=.035,w=options.width-2*bevel,h=options.height-2*bevel,r=Math.min(options.radius-bevel,w/2,h/2),shape=new T.Shape();
   shape.moveTo(-w/2+r,-h/2);shape.lineTo(w/2-r,-h/2);shape.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);shape.lineTo(w/2,h/2-r);shape.quadraticCurveTo(w/2,h/2,w/2-r,h/2);shape.lineTo(-w/2+r,h/2);shape.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);shape.lineTo(-w/2,-h/2+r);shape.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
   const geometry=new T.ExtrudeGeometry(shape,{depth:options.depth-2*bevel,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:3,curveSegments:16,steps:1});geometry.center();geometry.computeVertexNormals();
   const material=new T.MeshPhysicalMaterial({color:options.palette.paper,metalness:0,transmission:options.transmission,ior:options.ior,thickness:options.thickness,roughness:options.roughness,clearcoat:options.clearcoat,clearcoatRoughness:.08,envMapIntensity:1.1,attenuationColor:new T.Color(options.palette.paper),attenuationDistance:4});
   const slab=new T.Mesh(geometry,material);scene.add(slab);
   // Subject-relevant seals, folded ribbon and circular stationery forms sit
   // BEHIND the slab and are refracted by Three's transmission render pass.
   const forms=[];
   const add=(geometry,color,x,y,z,scale=1)=>{const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({color,roughness:.32,metalness:.12}));mesh.position.set(x,y,z);mesh.scale.setScalar(scale);mesh.userData.y=y;forms.push(mesh);scene.add(mesh);return mesh;};
   add(new T.TorusGeometry(.92,.23,20,64),options.palette.violet,-1.6,.6,-1).rotation.x=.35;
   add(new T.CylinderGeometry(.61,.61,.18,64),options.palette.coral,1.7,-.9,-.65).rotation.x=Math.PI/2;
   add(new T.TorusGeometry(.57,.14,16,48),options.palette.amber,1.7,-.9,-.5);
   const ribbon=add(new T.BoxGeometry(2.8,.3,.16),options.palette.coral,.2,-1.5,-.9);ribbon.rotation.z=-.45;
   resources={renderer,scene,camera,slab,forms,environment,lastTime:-1};resize();state('webgl');clock.seek(0);drawAt(0);resume();
  }catch{if(!resources&&pending)resources=pending;release();state('light');drawAt(options.duration);}
 }
 function visibility(){if(document.hidden||!visible)pause();else resume();}
 document.addEventListener('visibilitychange',visibility,{signal});
 reduced.addEventListener('change',()=>{pause();initialize();},{signal});
 canvas?.addEventListener('webglcontextlost',event=>{event.preventDefault();pause();release();state('light');drawAt(options.duration);},{signal});
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;visibility();},{threshold:.05});observer.observe(host);
 const sizeObserver=new ResizeObserver(resize);sizeObserver.observe(host);
 function applyPalette(){for(const[k,v]of Object.entries(options.palette))host.style.setProperty('--glass-'+k,v);host.dataset.aspect=options.aspect;}
 applyPalette();await initialize();
 return {
  get options(){return options;},get time(){return Math.min(clock.time(),options.duration);},
  inspect(){if(!resources)return {renderer:host.dataset.renderer};const {slab,renderer}=resources;slab.geometry.computeBoundingBox();return {renderer:'webgl',engine:three.REVISION,material:slab.material.type,transmission:slab.material.transmission,ior:slab.material.ior,thickness:slab.material.thickness,roughness:slab.material.roughness,clearcoat:slab.material.clearcoat,bounds:slab.geometry.boundingBox.getSize(new three.Vector3()).toArray(),calls:renderer.info.render.calls,renders:resources.renders};},
  replay(){finished=false;userPaused=false;clock.seek(0);drawAt(reduced.matches||!resources?options.duration:0);resume();},
  pause(){userPaused=true;pause();},play(){userPaused=false;resume();},
  seek(seconds){pause();userPaused=true;clock.seek(Math.min(options.duration,Math.max(0,seconds)));drawAt(clock.time());},
  async update(next){options=glassOptions({...options,...next,palette:{...options.palette,...next.palette}});applyPalette();pause();await initialize();},
  dispose(){disposed=true;generation++;abort.abort();observer.disconnect();sizeObserver.disconnect();release();}
 };
}
