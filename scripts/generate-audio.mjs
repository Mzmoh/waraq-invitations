// Original synthesized compositions, no samples or third-party music.
import {mkdirSync,writeFileSync} from 'node:fs';
mkdirSync('public/audio',{recursive:true});
for(const [name,notes] of [['celebration',[523.25,659.25,783.99,1046.5]],['serenity',[392,440,523.25,659.25]]]){
 const rate=16000,seconds=5,samples=rate*seconds,b=Buffer.alloc(44+samples*2);
 b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples*2,40);
 for(let i=0;i<samples;i++){
   const t=i/rate;let value=0;
   notes.forEach((f,j)=>{const x=t-j*.65;if(x>=0)value+=(Math.sin(2*Math.PI*f*x)+.2*Math.sin(2*Math.PI*f*2*x))*Math.exp(-2*x)*Math.min(1,x*70)*.16;});
   value*=Math.min(1,(seconds-t)*3);b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,value))*32767),44+i*2);
 }
 writeFileSync('public/audio/'+name+'.wav',b);
}
console.log('Generated two original five-second audio tracks.');
