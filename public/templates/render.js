import { motif } from './art.js';
const frames = {
 folio:'M21 32H339V228H21ZM28 38H332V222H28Z',
 oval:'M180 18A93 112 90 1 1 179.9 18ZM180 24A86 105 90 1 1 179.9 24Z',
 diagonal:'M-22 188L220 -30M50 273L382 -19M113 278L384 22',
 steps:'M24 218V50H39V36H54V23H306V36H321V50H336V218ZM30 210V56H45V42H61',
 postal:'M17 30H342V232H17ZM25 38H334V224H25ZM280 42H318V72H280Z',
 contour:'M-15 178Q82 43 183 114T378 26M-19 192Q80 59 182 128T379 40M-19 209Q84 74 189 142T379 58',
 margin:'M54 22V238M60 22V238M306 22V238M300 22V238M43 34H71M289 226H317',
 grid:'M0 50H360M0 100H360M0 150H360M0 200H360M60 0V260M120 0V260M180 0V260M240 0V260M300 0V260',
 theatre:'M24 38H336V222H24ZM36 47H324V213H36Z',
 band:'M0 79L360 43M0 85L360 49M0 211L360 175M0 217L360 181',
 canopy:'M0 0Q92 90 180 22Q268 90 360 0M0 8Q94 98 180 30Q266 98 360 8',
 orbit:'M44 166C18 110 92 60 185 55S333 95 317 147S221 219 129 211S28 172 51 130',
 portal:'M48 242V111Q48 56 108 42Q151 31 180 11Q209 31 252 42Q312 56 312 111V242M56 242V114Q56 62 113 49Q154 38 180 19Q206 38 247 49Q304 62 304 114V242',
 curtain:'M0 10Q81 100 71 240M0 3Q88 95 79 242M360 10Q279 100 289 240M360 3Q272 95 281 242',
 horizon:'M0 167Q65 128 125 146T264 132T360 134M0 183Q65 144 125 162T264 148T360 150',
 tiles:'M0 58L67 0M0 120L129 0M229 260L360 128M285 260L360 185M0 67L71 132L140 65L77 0M222 195L291 128L360 190L291 260Z',
 still:'M28 185Q177 199 330 178M38 190Q184 204 317 188',
 medal:'M180 19L275 63L305 133L267 201L180 241L93 201L55 133L85 63ZM180 25L270 69L298 133L262 196L180 235L98 196L63 133L90 69Z',
 sunburst:'M180 130L10 18M180 130L52 0M180 130L122 0M180 130L180 0M180 130L239 0M180 130L306 0M180 130L350 18',
 halo:'M180 33A98 98 0 1 1 179.9 33ZM180 39A92 92 0 1 1 179.9 39Z',
 air:'M19 211Q73 151 52 78T87 -10M309 270Q290 188 324 143T351 22',
 garden:'M20 225Q38 157 34 115T81 22M25 226Q41 164 42 113M339 28Q316 87 324 120T277 238',
 sky:'M-10 212Q41 191 92 202T188 200T275 193T373 198M-10 222Q41 201 92 212T188 210T275 203T373 208',
 diptych:'M22 28H339V232H22ZM212 28V232M219 28V232'
};
const actions={
 left:'translateX(-34px) rotate(-6deg)',right:'translateX(34px) rotate(7deg)',lift:'translateY(-31px) rotate(-2deg)',
 rise:'translateY(-14px) scale(1.04)',sink:'translateY(22px)',turn:'rotate(24deg)',counter:'rotate(-18deg)',
 fan:'rotate(-13deg) scale(1.09)',bloom:'scale(1.19) rotate(6deg)',sway:'rotate(11deg) translateY(-4px)',
 sweep:'translate(15px,-13px)',glint:'scale(1.32)',unfurl:'scale(1.17,.83) rotate(-3deg)',
 seal:'translate(11px,-30px) rotate(18deg) scale(.8)',hinge:'scaleY(-.9) skewX(4deg)',
 flip:'scaleX(.63) rotate(-10deg)',scatter:'scale(1.37) rotate(12deg)',draw:'translateX(-4px) scale(1.04)'
};
const introStyle=`
.studio-art{display:block;width:100%;height:auto;isolation:isolate;overflow:hidden}
.studio-art .part{transform-box:fill-box;transform-origin:center;transition:transform .94s cubic-bezier(.22,.77,.16,1),opacity .7s;transition-delay:var(--lag)}
.studio-art .act-hinge{transform-origin:center top;transition-delay:.17s}
.studio-art .act-lift{transition-delay:.24s}
.studio-art .act-seal{transition-delay:0s}
.studio-art .arrive{animation:studio-arrive .86s backwards;animation-delay:var(--lag)}
.studio-art .act-sway{transform-origin:50% 10%}
.studio-art .act-draw path[pathLength]{stroke-dasharray:1;animation:studio-ink 1.3s backwards}
.opened .studio-art .part{transform:var(--exit)}
.opened .studio-art .act-seal{opacity:.4}
@keyframes studio-arrive{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
@keyframes studio-ink{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@media(prefers-reduced-motion:reduce){.studio-art *{animation:none!important;transition:none!important}}
.motion-off .studio-art *,.no-motion .studio-art *,[data-motion="off"] .studio-art *{animation:none!important;transition:none!important}
`;
let instance=0;
const mix=(a,b,p)=>{
 const rgb=[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-p)+parseInt(b.slice(i,i+2),16)*p));
 return '#'+rgb.map(n=>n.toString(16).padStart(2,'0')).join('');
};
export function scene(t,{staticCover=false}={}) {
 const p=t.colorTokens;
 const prefix=staticCover?'cover':('studio-'+ ++instance);
 const id=n=>prefix+'-'+n;
 const url=n=>'url(#'+id(n)+')';
 const light=mix(p.accent,'#ffffff',.55),shadow=mix(p.surface,'#33221c',.36);
 const silkHighlight=mix(p.surface,'#ffffff',.12);
 const grad=(key,stops,props='x1="0%" y1="0%" x2="85%" y2="100%"')=>'<linearGradient id="'+id(key)+'" '+props+'>'+stops.map(([offset,color])=>'<stop offset="'+offset+'" stop-color="'+color+'"/>').join('')+'</linearGradient>';
 const defs=grad('foil',[[0,p.accent],['22%',light],['49%',p.accent],['66%',light],['100%',p.accent]])+
   grad('stock',[[0,light],['36%',p.surface],['100%',mix(p.surface,p.accent,.35)]])+grad('silk',[[0,silkHighlight],['43%',p.surface],['100%',shadow]])+
   grad('bg',[[0,mix(p.background,p.surface,.47)],['50%',p.background],['100%',mix(p.background,shadow,.37)]])+
   '<pattern id="'+id('grain')+'" width="7" height="9" patternUnits="userSpaceOnUse"><path d="M1 2h.8m3 4h.65" stroke="'+p.ink+'" stroke-width=".7" opacity=".12"/></pattern>';
 const frame=frames[t.layout];
 if(!frame)throw Error('Unknown layout '+t.layout);
 const layers=t.layers.map(([name,x,y,scale,angle,action],i)=>{
   if(!actions[action])throw Error('Unknown motion '+action);
   const art=motif(name);
   const glyph=staticCover?art:'<g class="arrive"><g class="part act-'+action+'">'+art+'</g></g>';
   return '<g transform="translate('+x+' '+y+') rotate('+angle+') scale('+scale+')" style="--lag:'+i*65+'ms;--exit:'+actions[action]+'">'+glyph+'</g>';
 }).join('');
 const vars='--edge:'+mix(p.accent,p.ink,.34)+';--shade:'+shadow+';--sheet:'+url('stock')+';--silk:'+url('silk')+';--metal:'+url('foil');
 return '<svg xmlns="http://www.w3.org/2000/svg" class="studio-art" viewBox="0 0 360 260" width="360" height="260" aria-hidden="true" focusable="false" style="'+vars+'"><defs>'+defs+'</defs>'+
 (staticCover?'':'<style>'+introStyle+'</style>')+
 '<rect width="360" height="260" fill="'+url('bg')+'"/><rect width="360" height="260" fill="'+url('grain')+'"/>'+
 '<path d="'+frame+'" stroke="'+p.accent+'" stroke-width=".82" opacity=".55" fill="none"/>'+
 '<g color="'+p.accent+'">'+layers+'</g></svg>';
}

