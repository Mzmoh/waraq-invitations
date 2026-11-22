import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateData,raster} from '../server/validation.mjs';
test('custom styling/media reject injection, invalid numbers and unlicensed uploads',()=>{
 for(const appearance of [{typeface:'url(https://attacker.test)'},{titleColor:'red;display:none'},{titleSize:Infinity},{align:'unsafe'},{bodySize:2}])assert.throws(()=>validateData({appearance}));
 for(const audio of [{track:'upload',volume:.5,loop:false,src:'data:audio/mpeg;base64,SUQz',rightsConfirmed:false},{track:'serenity',volume:2,loop:false},{track:'unknown',volume:.5,loop:false}])assert.throws(()=>validateData({audio}));
 const audio={track:'upload',volume:.5,loop:true,rightsConfirmed:true,src:'data:audio/wav;base64,'+readFileSync('public/audio/serenity.wav').toString('base64')};
 assert.equal(validateData({audio}).audio.src,audio.src);
});
test('fabricated header-only PNG is rejected before storage',()=>{
 const b=Buffer.alloc(33);Buffer.from('89504e470d0a1a0a','hex').copy(b);b.writeUInt32BE(13,8);b.write('IHDR',12);b.writeUInt32BE(1,16);b.writeUInt32BE(1,20);
 assert.throws(()=>raster('data:image/png;base64,'+b.toString('base64')),/Incomplete PNG/);
});
