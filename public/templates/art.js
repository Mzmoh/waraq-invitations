// Illustration library. Every motif is original vector linework in a centred 100-unit frame.
const stroke = 'currentColor';
const metal = 'var(--metal)';
const paper = 'var(--sheet)';
const shade = 'var(--shade)';
const silk = 'var(--silk)';
const edge = 'var(--edge)';
export const path = (d, fill = 'none', outline = stroke, width = 1.5, extra = '') =>
  `<path d="${d}" fill="${fill}" stroke="${outline}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
const circle = (x, y, r, fill, outline = 'none', width = 1) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${outline}" stroke-width="${width}"/>`;
const ellipse = (x,y,rx,ry,fill,outline='none') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${outline}"/>`;
const rot = (deg, s) => `<g transform="rotate(${deg})">${s}</g>`;
const at = (x, y, scale, s) => `<g transform="translate(${x} ${y}) scale(${scale})">${s}</g>`;
const repeat = (n, f) => Array.from({ length: n }, (_,i) => f(i)).join('');
const rect = (x,y,w,h,fill,outline='none',r=0) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${outline}"/>`;
const spark = path('M0 -9 Q1 -1 8 0 Q1 1 0 9 Q-1 1 -8 0 Q-1 -1 0 -9Z', metal, 'none');
const leaf = path('M0 0 Q-17 -19 -5 -32 Q9 -15 0 0Z', silk, edge, .8)+path('M0 0 Q-4 -12 -5 -29', 'none', edge, .6);
const branch = path('M-24 45 Q-17 0 26 -43','none',edge,1.2)+repeat(6,i=>at(-21+7*i,34-13*i,.72-i*.045,rot(i%2?54:-42,leaf)));
const rose = repeat(7,i=>rot(i*51,ellipse(0,-12,13,18,paper,edge)))+repeat(5,i=>rot(i*72+20,ellipse(0,-6,7,10,silk,edge)))+circle(0,0,4,metal);
const blossom = repeat(5,i=>rot(i*72,ellipse(0,-12,10,13,paper,edge)))+circle(0,0,4.2,metal,edge,.6);
const bead = circle(0,0,13,paper,edge,.7)+ellipse(-3,-4,4,2,'#fff9');
const arch = path('M-36 45V-5Q-36 -23 -20 -31Q-6 -37 0 -49Q6 -37 20 -31Q36 -23 36 -5V45Z',silk,metal,1.2)+path('M-30 44V-4Q-30 -22 -16 -28L0 -42L16 -28Q30 -22 30 -4V44','none',edge,1);
const moon = path('M18 -41A43 43 0 1 0 35 29A36 36 0 0 1 18 -41Z',metal,edge,.75);
const lantern = path('M0 -51V-39M-5 -33Q-7 -48 0 -43Q7 -42 5 -33','none',edge)+path('M-14 -27Q-8 -34 0 -36Q8 -34 14 -27L19 -23H-19Z',metal,edge,1)+path('M-17 -21L-12 18L0 30L12 18L17 -21Z',paper,edge)+path('M-7 -21L-4 18L0 28L4 18L7 -21M-16 -16H16M-13 16H13','none',edge,1.2)+path('M-12 20L0 33L12 20M0 33V39',metal,edge)+circle(0,40,2.3,metal);
const rosette = repeat(8,i=>rot(i*45,path('M0 -46L10 -23L0 -10L-10 -23Z','none',edge,1.2)))+repeat(8,i=>rot(i*45+22.5,path('M0 -36L6 -20L0 -14L-6 -20Z',metal,'none')))+circle(0,0,8,'none',edge)+circle(0,0,3,metal);
const skyline = path('M-55 36V19H-46V6H-42V-27L-40 -36L-38 -27V6H-32V18H-24V6Q-20 -10 -9 -13Q-5 -15 -4 -20Q-1 -15 5 -12Q17 -7 19 6V17H27V1H32V-38L35 -46L38 -38V1H42V12H52V36Z',silk,edge,.8)+path('M-50 29H49M-47 32H45','none',edge,.7);
const stamp = repeat(20,i=>rot(i*18,circle(0,-25,4,metal)))+circle(0,0,26,metal,edge)+circle(0,0,21,'none',shade,.8)+circle(0,0,18,'none',edge,.6)+at(0,2,.5,branch);
const flap = path('M-60 -32H60L6 9Q0 14 -6 9Z',silk,edge,1)+path('M-57 -30L-3 7Q0 9 3 7L57 -30','none',edge,.6);
const pocket = path('M-60 -33H60V34H-60Z',silk,edge,1.3)+path('M-60 34L-12 -5M60 34L12 -5','none',edge,.8)+path('M-59 31L-15 -5M59 31L15 -5','none',metal,.45);
const card = rect(-45,-32,90,64,paper,edge,1)+rect(-42,-29,84,58,'none',edge,1)+path('M-23 15H23M-15 20H15','none',edge,.8)+at(0,-7,.65,spark);
const gate = arch+repeat(8,i=>path(`M${-30+i*8} 35V-7`,'none',edge,.7))+repeat(6,i=>path(`M-28 ${-7+i*8}H28`,'none',edge,.7));
const ridge = path('M-60 26Q-28 8 -7 -11L5 -23L15 -13L23 -10L60 22V45H-60Z',silk,edge,1)+path('M-60 35L5 -20L-4 -2L12 -10L39 22M-26 21L-13 11','none',edge,.7);
const quill = path('M-27 38Q-6 -6 34 -42Q37 -12 7 5L16 -7L0 5L-8 20Z',metal,edge,.8)+path('M-32 44Q-8 7 28 -31','none',edge,1);
const signature = path('M-53 18C-27 15 -4 -35 -12 -36C-24 -36 -32 35 -10 17Q-1 4 4 6Q3 24 12 15Q21 -2 24 8Q23 19 35 13L51 8M-36 29Q-4 19 46 22','none',edge,2,'pathLength="1"');
const starfield = [[-39,-28,1],[-18,-7,.4],[8,-35,.65],[32,-12,.8],[44,21,.4],[18,38,.7],[-30,32,.4],[-50,4,.3],[0,14,.4]].map(([x,y,s])=>at(x,y,s,spark)).join('');
const fan = repeat(13,i=>rot(-72+i*12,path('M0 20L0 -43','none',edge,1)))+path('M-60 0Q0 -63 60 0L0 24Z','none',edge,1.4);
const ticket = path('M-57 -26H57V-8Q43 0 57 8V26H-57V9Q-44 0 -57 -9Z',paper,edge,1.3)+path('M29 -25V25','none',edge,1,'stroke-dasharray="3 3"')+repeat(8,i=>path(`M${-44+i*3} -14V14`,'none',edge,i%3+1))+at(6,0,1.1,spark);
const dome = path('M-39 18Q-19 12 -15 -4Q-12 -19 0 -26Q12 -19 15 -4Q19 12 39 18ZM-40 22H40V28H-40Z',silk,edge)+path('M0 -26V-36M-26 15Q-3 4 0 -21Q3 5 26 15','none',metal,1);
const frame = rect(-41,-44,82,88,paper,edge,1)+rect(-35,-38,70,62,silk,edge)+at(12,-19,.54,moon)+at(0,7,.56,ridge)+path('M-24 33H24','none',edge,.7);
const bow = path('M0 0C-53 -40 -47 16 -14 5L0 0C36 21 56 -32 24 -19Q6 -13 0 0ZM-5 3Q-10 28 -32 39L-18 34L-17 43Q0 28 3 2M5 0Q18 25 39 28L31 21L43 20Q20 11 10 -3',silk,edge,1)+circle(0,0,5,metal,edge);
const scallop = repeat(14,i=>at(-52+i*8,0,1,circle(0,0,5.4,paper,edge,.7)+circle(0,0,2,'none',edge,.65)));
const ring = ellipse(0,0,22,27,'none',metal)+ellipse(0,0,19,24,'none',edge);
const pen = path('M-33 36L-18 6L25 -39L35 -29L-9 16ZM-18 6L-9 16M29 -34L-15 10M-33 36L-25 27','none',edge,1.7);
const cloud = path('M-37 12Q-52 -4 -33 -13Q-30 -31 -10 -28Q7 -46 22 -24Q38 -22 38 -10Q56 -2 42 12Z',paper,edge,1);
const balloon = ellipse(0,-14,19,24,paper,edge)+path('M0 10L-3 15H3ZM0 15C8 28 -9 33 0 46','none',edge,1)+path('M-12 -20Q-10 -29 -4 -30','none',edge,1);
const footprint = ellipse(0,8,7,15,silk,edge)+ellipse(1,-5,10,9,silk,edge)+repeat(5,i=>at(-9+i*4,-14-Math.sin(i*.7)*3,1,circle(0,0,2+i*.16,metal)));
const bear = circle(-21,-16,11,silk,edge)+circle(21,-16,11,silk,edge)+ellipse(0,2,26,25,paper,edge)+circle(-10,-1,2.3,shade)+circle(10,-1,2.3,shade)+ellipse(0,11,10,7,silk)+path('M-3 8Q0 14 3 8Z',shade,shade,1);
const giraffe = path('M-9 39L-4 -10L-14 -17L-10 -23L-4 -22L0 -28L11 -26L15 -19L27 -17L24 -10L8 -9L7 39Z',paper,edge)+path('M-2 -28L-6 -37M8 -28L11 -36','none',edge,2.8)+circle(9,-21,1.5,shade)+repeat(5,i=>at(i%2?2:-2,-3+i*8,.6,ellipse(0,0,4,3,metal)));
const cradle = path('M-36 -13Q-26 29 9 28Q35 27 44 -10Z',paper,edge)+path('M-34 -13Q-36 -47 -8 -43Q-10 -20 -18 -13Z',silk,edge)+path('M-17 27L-24 40M17 27L24 40M-42 32Q0 57 42 32','none',edge,2)+at(10,5,.5,spark);
const cap = path('M-49 -12L0 -33L49 -12L0 9ZM-25 0V18Q0 33 25 18V0',silk,edge,1.5)+path('M1 -13L34 -8V16M34 16L31 30H37Z',metal,edge,1.4)+circle(0,-13,2,metal);
const diploma = rot(-23,rect(-35,-12,68,26,paper,edge,4)+ellipse(33,1,6,13,paper,edge)+ellipse(34,1,2,8,'none',edge)+rect(-4,-13,9,27,metal,edge)+path('M-4 13L-9 29L-2 24L2 32L5 13',silk,edge));
const pillar = path('M-14 -34H14V-29H10V29H16V34H-16V29H-10V-29H-14Z',paper,edge)+path('M-5 -27V26M0 -27V26M5 -27V26','none',edge,.8);
const palms = path('M-7 42Q3 10 0 -12M-1 -10Q-25 -34 -37 -8Q-14 -19 -2 -9Q-22 -15 -27 5Q-11 -8 0 -9Q8 -38 30 -29Q12 -22 2 -9Q31 -24 39 -7Q19 -14 2 -7Q21 -9 25 11Q16 -2 3 -8','none',edge,2.1);
const cup = path('M-17 -17H17L12 16Q0 24 -12 16ZM17 -12Q35 -15 24 -1Q21 4 15 5M-26 24Q0 30 26 24','none',edge,1.8)+path('M-6 -21Q-11 -27 -3 -32M4 -22Q9 -29 5 -34','none',edge,1);
const sun = circle(0,0,18,metal)+repeat(16,i=>rot(i*22.5,path('M0 -24V-36','none',edge,1)));
const map = path('M-48 -28L-18 -37L15 -27L48 -36V27L16 37L-18 28L-48 37Z',paper,edge)+path('M-18 -36V27M15 -26V35M-43 17Q-22 2 -11 12T12 0T39 -13','none',edge,1)+path('M-31 6Q-23 -13 -3 -8T28 -18','none',edge,1.5,'stroke-dasharray="2 4"')+circle(28,-18,3,metal);
const confetti = repeat(19,i=>at(Math.sin(i*7)*47,Math.cos(i*3)*35,1,rot(i*47,i%3?spark:rect(-1,-5,3,10,paper,edge))));
const drop = path('M0 -38Q-34 1 -22 19Q0 49 22 19Q34 1 0 -38Z',paper,edge,1.2)+path('M-12 13Q-17 2 -8 -10','none',edge,1);
const artwork = {spark,leaf,branch,rose,blossom,bead,arch,moon,lantern,rosette,skyline,stamp,flap,pocket,card,gate,ridge,quill,signature,starfield,fan,ticket,dome,frame,bow,scallop,ring,pen,cloud,balloon,footprint,bear,giraffe,cradle,cap,diploma,pillar,palms,cup,sun,map,confetti,
  lines: path('M-47 -10H47M-35 -3H35M-39 4H39M-24 11H24','none',edge,.9),
  orbit: ellipse(0,0,51,26,'none',edge)+rot(-35,ellipse(0,0,49,27,'none',edge))+at(45,-8,.6,spark),
  glass: path('M-48 -28L28 -42L46 25L-31 42Z','#ffffff15',edge,.8)+path('M-46 -26L26 -39L42 23','none','#ffffff70',.6),
  diamond: path('M0 -45L36 0L0 45L-36 0ZM0 -37L29 0L0 37L-29 0Z','none',edge,.9),
  postcard: rect(-52,-34,104,68,paper,edge)+rect(27,-27,16,19,silk,edge)+at(35,-17,.2,sun)+path('M-2 -23V24M8 0H42M8 8H37M8 16H39','none',edge,.8)+at(-28,-1,.42,palms),
  sheet: path('M-54 -35Q-30 -46 0 -26T55 -25V35H-54Z',paper,edge,.7),
  neon: path('M-50 24L-21 -22H24L5 10H50M-44 31L-17 -14H11','none',edge,2.5),
  film: rect(-54,-30,108,60,silk,edge)+rect(-42,-22,84,44,paper,edge)+repeat(9,i=>rect(-50+i*12,-28,6,3,metal)+rect(-50+i*12,25,6,3,metal))+at(0,2,.44,ridge),
  phases: repeat(5,i=>at(-44+i*22,0,.6-i*.05,i===2?circle(0,0,16,metal):i%2?circle(0,0,12,paper,edge):at(0,0,.38,moon))),
  table: ellipse(0,4,50,18,paper,edge)+path('M-40 13L-36 37M40 13L36 37','none',edge,2)+at(-13,-9,.48,cup)+at(17,-5,.36,cup),
  ink: path('M-48 20Q-16 23 -8 -17T-1 13Q5 29 12 -17T17 3Q23 22 33 4M-24 30Q-1 38 36 18','none',edge,2,'pathLength="1"'),
  kaaba: path('M-39 -24L-5 -36L38 -25V31L-5 43L-39 29Z',silk,edge,1.2)+path('M-39 -15L-5 -4L38 -15V-9L-5 3L-39 -8Z',metal,edge,.5)+path('M-5 -4V42M17 5L28 2V20L17 23Z','none',edge,.85),
  kiswah: repeat(5,i=>at(-40+i*20,0,1,path('M-8 32L0 20L8 32M-8 7L0 -5L8 7M-8 -18L0 -30L8 -18','none',edge,1.3)))+path('M-50 41H50M-50 -40H50','none',metal,2),
  drop,
  dune: path('M-70 20Q-30 -14 0 4T70 -13V42H-70Z',silk,edge,1)+path('M-67 29Q-23 2 5 15T65 4','none',edge,.8),
  window: rect(-39,-32,78,63,silk,edge)+repeat(6,i=>path(`M${-34+i*13} -29V27`,'none',edge,.9))+repeat(5,i=>path(`M-38 ${-23+i*11}H38`,'none',edge,.9))+path('M-44 -34L-37 -42H36L44 -34ZM-43 32H43L36 39H-36Z',metal,edge),
  chandelier: path('M0 -48V6M-39 -10Q-33 18 0 12Q33 18 39 -10M-25 -20Q-21 6 0 3Q21 6 25 -20','none',edge,2)+[-39,-25,0,25,39].map((x,i)=>at(x,i%2?-23:-11,.36,drop)).join('')+at(0,24,.35,drop),
  ribbon: path('M-53 -8Q-27 -21 0 -6T52 -10L44 1L54 8Q23 21 -4 8T-53 11Z',silk,edge,.9),
  rainbow: repeat(5,i=>path(`M${-44+i*6} 22A${44-i*6} ${48-i*6} 0 0 1 ${44-i*6} 22`,'none',[edge,silk,metal,paper,edge][i],3)),
  book: path('M0 -21Q-17 -36 -45 -27V28Q-17 18 0 32Q17 18 45 28V-27Q17 -36 0 -21Z',paper,edge)+path('M0 -21V31M5 -14Q20 -22 36 -19M5 -5Q20 -13 36 -10M-5 -14Q-20 -22 -36 -19','none',edge,.9),
  steps: path('M-49 31H-28V14H-7V-3H14V-20H35V-37H48V37H-49Z',silk,edge),
  laurel: branch+rot(100,branch),
  laurelSeal: stamp+at(0,0,.3,cap),
  star: path('M0 -40L9 -13L38 -12L15 6L23 34L0 18L-23 34L-15 6L-38 -12L-9 -13Z',metal,edge,1),
  lattice: repeat(6,i=>rot(i*30,path('M-40 -10L0 -37L40 -10L0 24Z','none',edge,.9))),
  waves: repeat(5,i=>path(`M-48 ${-13+i*7}Q-27 ${-30+i*7} 0 ${-15+i*7}T48 ${-15+i*7}`,'none',edge,.8))
};
export function motif(name) {
  if (!Object.hasOwn(artwork,name)) throw new Error('Unknown illustration: '+name);
  return artwork[name];
}

