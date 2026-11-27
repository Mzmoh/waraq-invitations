// Independent WebGL2 proof. Pass A renders a procedural grid into an FBO;
// pass B samples it using bevel normals, IOR/thickness and RGB dispersion.
export function mountOpticalProof(canvas,cssBackground){
 const gl=canvas.getContext('webgl2',{antialias:false,alpha:false});
 if(!gl)return {update(){},dispose(){},inspect:()=>({renderer:'fallback'})};
 const vertex=`#version 300 es
 in vec2 position;out vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0,1);}`;
 const background=`#version 300 es
 precision highp float;in vec2 uv;out vec4 color;uniform float time;
 void main(){vec2 p=uv*vec2(12.,8.)+vec2(time*.5,0.);vec2 line=smoothstep(vec2(.05),vec2(.09),abs(fract(p)-.5));float grid=1.-min(line.x,line.y);vec3 base=mix(vec3(.08,.06,.19),vec3(.45,.28,.65),uv.y);base=mix(base,vec3(.99,.72,.42),grid*.85);float disc=1.-smoothstep(.11,.115,length(uv-vec2(.5+.23*sin(time*.3),.53)));color=vec4(mix(base,vec3(1.,.3,.25),disc),1.);}`;
 const optical=`#version 300 es
 precision highp float;in vec2 uv;out vec4 color;uniform sampler2D backdrop;uniform float ior,thickness,refraction,roughness,dispersion,light;
 float sdf(vec2 p){vec2 q=abs(p)-vec2(.31,.28);return length(max(q,0.))+min(max(q.x,q.y),0.)-.075;}
 void main(){float d=sdf(uv-.5);vec3 base=texture(backdrop,uv).rgb;if(d>0.){color=vec4(base,1.);return;}
 float edge=1.-smoothstep(0.,.11,-d);vec2 gradient=vec2(sdf(uv-.5+vec2(.001,0.))-sdf(uv-.5-vec2(.001,0.)),sdf(uv-.5+vec2(0.,.001))-sdf(uv-.5-vec2(0.,.001)));vec3 normal=normalize(vec3(gradient*edge*350.,1.));
 vec3 ray=refract(vec3(0.,0.,-1.),normal,1./ior);vec2 offset=ray.xy*thickness*.2*refraction;vec2 sampleUV=clamp(uv+offset,vec2(.001),vec2(.999));
 vec3 glass=vec3(texture(backdrop,clamp(sampleUV+offset*dispersion,vec2(.001),vec2(.999))).r,texture(backdrop,sampleUV).g,texture(backdrop,clamp(sampleUV-offset*dispersion,vec2(.001),vec2(.999))).b);
 vec3 blur=(texture(backdrop,clamp(sampleUV+vec2(.007),vec2(.001),vec2(.999))).rgb+texture(backdrop,clamp(sampleUV-vec2(.007),vec2(.001),vec2(.999))).rgb)*.5;glass=mix(glass,blur,roughness);
 float f0=pow((ior-1.)/(ior+1.),2.);float fresnel=f0+(1.-f0)*pow(1.-normal.z,5.);float spec=pow(max(dot(normal,normalize(vec3(-.6,.8,1.))),0.),38.);glass+=vec3(.9,.8,1.)*(fresnel*.4+spec*.23)*light;glass+=edge*.025;
 color=vec4(mix(base,glass,smoothstep(0.,.003,-d)),1.);}`;
 const objects=[];
 function program(fragment){const p=gl.createProgram();for(const[type,source]of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);objects.push(()=>gl.deleteShader(s));}gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));objects.push(()=>gl.deleteProgram(p));return p;}
 const a=program(background),b=program(optical),buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
 const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
 let width=0,height=0,frame,disposed=false,visible=true,frames=[],previous=0,time=0,frozen=null;
 const options={ior:1.46,thickness:.65,refraction:1,roughness:.16,dispersion:.04,light:1};
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function drawProgram(p){gl.useProgram(p);const attr=gl.getAttribLocation(p,'position');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);return name=>gl.getUniformLocation(p,name);}
 function draw(){const w=Math.max(1,Math.round(canvas.clientWidth*Math.min(devicePixelRatio,1.5))),h=Math.max(1,Math.round(canvas.clientHeight*Math.min(devicePixelRatio,1.5)));if(w!==width||h!==height){width=canvas.width=w;height=canvas.height=h;gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);}gl.viewport(0,0,w,h);
  const now=frozen??time;if(cssBackground){cssBackground.style.setProperty('--grid-x',(-now*.5*100/12)+'%');cssBackground.style.setProperty('--disc-x',((.5+.23*Math.sin(now*.3))*100)+'%');}
  gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);let uniform=drawProgram(a);gl.uniform1f(uniform('time'),now);gl.drawArrays(gl.TRIANGLES,0,6);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);uniform=drawProgram(b);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(uniform('backdrop'),0);for(const[k,v]of Object.entries(options))gl.uniform1f(uniform(k),v);gl.drawArrays(gl.TRIANGLES,0,6);
 }
 function loop(now){frame=0;if(disposed||document.hidden||!visible)return;if(previous){const delta=now-previous;if(delta<1000){frames.push(delta);if(frames.length>120)frames.shift();time+=delta/1000;}}previous=now;draw();if(!reduced.matches&&frozen===null)frame=requestAnimationFrame(loop);}
 function resume(){previous=0;if(!frame&&!disposed)frame=requestAnimationFrame(loop);}
 const observer=new IntersectionObserver(e=>{visible=e[0].isIntersecting;if(visible)resume();else{cancelAnimationFrame(frame);frame=0;} });observer.observe(canvas);
 const visibility=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else resume();};document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',resume);
 const resize=new ResizeObserver(()=>{if(!disposed)draw();});resize.observe(canvas);
 const lost=e=>{e.preventDefault();cancelAnimationFrame(frame);canvas.dataset.renderer='fallback';};canvas.addEventListener('webglcontextlost',lost);
 canvas.dataset.renderer='webgl2';resume();
 return {update(next){for(const[k,min,max]of [['ior',1,2.33],['thickness',.1,2],['refraction',0,2],['roughness',0,1],['dispersion',0,.2],['light',0,3]])if(Number.isFinite(next[k]))options[k]=Math.min(max,Math.max(min,next[k]));draw();},seek(seconds){frozen=seconds;cancelAnimationFrame(frame);frame=0;draw();},pause(){frozen=time;cancelAnimationFrame(frame);frame=0;},play(){frozen=null;resume();},inspect(){return {renderer:canvas.dataset.renderer,options:{...options},fps:frames.length?1000/(frames.reduce((a,b)=>a+b,0)/frames.length):null,frameSamples:frames.length};},dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();resize.disconnect();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',resume);canvas.removeEventListener('webglcontextlost',lost);objects.forEach(fn=>fn());gl.deleteFramebuffer(fbo);gl.deleteTexture(texture);gl.deleteBuffer(buffer);}};
}
