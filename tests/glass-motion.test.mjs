import test from 'node:test';
import assert from 'node:assert/strict';
import {glassDefaults,glassOptions,glassFrame,glassCapability,createMotionClock} from '../public/glass-motion.js';
test('cinematic optical defaults and final 25 percent readable hold',()=>{
 assert.deepEqual([glassDefaults.width,glassDefaults.height,glassDefaults.depth,glassDefaults.radius],[4.9,3.6,.24,.35]);
 assert.deepEqual([glassDefaults.transmission,glassDefaults.ior,glassDefaults.thickness,glassDefaults.roughness,glassDefaults.clearcoat,glassDefaults.fov],[1,1.46,.65,.16,1,33]);
 assert.deepEqual([glassDefaults.duration,glassDefaults.fps,glassDefaults.aspect],[6,30,'16:9']);
 assert.equal(glassFrame(0).rotation,-.22);
 const at=glassFrame(4.5),last=glassFrame(6);for(const k of ['rotation','drift','cameraX','formRotation','reveal'])assert.equal(at[k],last[k],k+' must stop during reading hold');
 assert.equal(at.holding,true);assert.equal(glassFrame(4.49).holding,false);
 for(let time=0;time<=30;time+=.017){const f=glassFrame(time,{duration:30});assert.ok(Math.abs(f.drift)<=.035);assert.ok(Math.abs(f.cameraX)<=4.9*.05);}
 const initial=glassFrame(.001);assert.ok(Math.abs(initial.cameraX/.001-.1)<.00001);
});
test('reduced motion, lightweight device gates and deterministic capture',()=>{
 const a=glassFrame(0,{},true),b=glassFrame(6,{},true);for(const k of ['rotation','drift','cameraX','formRotation','reveal'])assert.equal(a[k],b[k]);assert.equal(a.reveal,1);
 assert.equal(glassCapability({reduced:true}),'reduced');assert.equal(glassCapability({saveData:true}),'light');assert.equal(glassCapability({memory:4}),'light');assert.equal(glassCapability({cores:2}),'light');assert.equal(glassCapability({webgl:false}),'light');assert.equal(glassCapability({mode:'light'}),'light');assert.equal(glassCapability({cores:8,memory:16}),'webgl');
 assert.deepEqual(glassFrame(3),glassFrame(90/30));assert.equal(glassOptions({aspect:'9:16'}).aspect,'9:16');
 const o=glassOptions({duration:Infinity,motion:999,palette:{deep:'url(javascript:bad)',coral:'#112233'}});assert.equal(o.duration,6);assert.equal(o.motion,1);assert.equal(o.palette.deep,'#221b49');assert.equal(o.palette.coral,'#112233');
});
test('one clock preserves phase across pause, offscreen resume and seek',()=>{
 let time=1000;const clock=createMotionClock(()=>time);time=3000;assert.equal(clock.time(),2);clock.pause();time=20000;assert.equal(clock.time(),2);clock.play();time=21000;assert.equal(clock.time(),3);clock.seek(1.5);assert.equal(clock.time(),1.5);clock.pause();time=30000;assert.equal(clock.time(),1.5);
});
