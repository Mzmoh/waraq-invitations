// Lossless WOFF1 container conversion; no glyph/name modification or subsetting.
// Fetch the pinned upstream files in public/fonts/SOURCES.json into the ignored
// references/font-sources/{family}.ttf directory before regenerating.
import {readFileSync,writeFileSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
const align=n=>(n+3)&~3;
for(const name of ['amiri','notonaskharabic','notokufiarabic']) {
 const source=readFileSync('references/font-sources/'+name+'.ttf'),count=source.readUInt16BE(4),tables=[];
 let offset=44+20*count,total=12+16*count;
 for(let i=0;i<count;i++){
  const p=12+i*16,length=source.readUInt32BE(p+12),start=source.readUInt32BE(p+8);
  if(start+length>source.length)throw Error('Invalid font table');
  const raw=source.subarray(start,start+length),z=deflateSync(raw),data=z.length<raw.length?z:raw;
  tables.push({tag:source.readUInt32BE(p),checksum:source.readUInt32BE(p+4),length,data,offset});offset+=align(data.length);total+=align(length);
 }
 const b=Buffer.alloc(offset);b.write('wOFF');b.writeUInt32BE(source.readUInt32BE(0),4);b.writeUInt32BE(offset,8);b.writeUInt16BE(count,12);b.writeUInt32BE(total,16);b.writeUInt16BE(1,20);
 tables.forEach((t,i)=>{let p=44+i*20;for(const v of [t.tag,t.offset,t.data.length,t.length,t.checksum]){b.writeUInt32BE(v,p);p+=4;}t.data.copy(b,t.offset)});
 writeFileSync('public/fonts/'+name+'.woff',b);console.log(name+': '+b.length+' bytes');
}
