// Paper, secondary stock, foil, lettering and rule colours.
const recipes = {
  ivory: ['#f1ebdf','#fffbf0','#ad8247','#392e28','#766859'],
  claret: ['#3a1b29','#692c41','#e4bd84','#fff1d7','#cab39e'],
  navy: ['#101d34','#263c5c','#d9be89','#fff4da','#b4c3cd'],
  onyx: ['#1c1e20','#353632','#c5a168','#faf0d9','#c8b89c'],
  sepia: ['#5d4236','#8a6551','#e1bd8d','#fff0d1','#dec4af'],
  peach: ['#ecbfa9','#f6d9ce','#a76350','#472e2b','#7f574b'],
  sage: ['#dde2d3','#eef0db','#7d956c','#263f32','#56674f'],
  violet: ['#201d38','#363552','#a6e4e7','#f3ebff','#bdb4d7'],
  inkblue: ['#213e52','#466779','#e2be8c','#fcf4db','#c2d0cb'],
  terracotta: ['#ad573f','#c97e59','#ffe0a4','#fff8de','#ffdfc0'],
  midgreen: ['#183e3d','#315958','#e4c185','#f5efd3','#c4d2bc'],
  indigo: ['#27283e','#454566','#ebc588','#fff0d8','#c5c0d7'],
  walnut: ['#5d3b2e','#7e523e','#e1b687','#fff0ce','#dbc4ab'],
  emerald: ['#173c33','#2c5544','#cba862','#fff4cd','#bdd0b2'],
  slate: ['#394759','#586779','#ddc299','#f5edda','#c6d0d4'],
  cobalt: ['#234667','#3e6482','#ead09d','#fff7df','#bfd0d4'],
  copper: ['#986243','#b5845c','#f2d9a7','#fff6dc','#efddc9'],
  pearl: ['#ede5dc','#fbf6ec','#bb9b84','#493a38','#796457'],
  sand: ['#e8d9bc','#f4e9d2','#a5804f','#473a2f','#77654c'],
  gold: ['#4b3925','#735838','#f1ca83','#fff4cf','#dfcaaa'],
  mint: ['#d3e5d8','#eff2df','#809e82','#263e37','#526e60'],
  ochre: ['#d1a168','#ecc18d','#80512e','#392921','#6d4b33'],
  blush: ['#dfbbb9','#f0d9d3','#a16e65','#50393b','#775758'],
  apricot: ['#eec69e','#f1d4af','#ab7757','#503d32','#795b43'],
  lilac: ['#dfd4e3','#eee8ee','#a28b9c','#493e50','#736378'],
  coral: ['#dba495','#f4c8b4','#965f48','#4b302b','#744c42'],
  mist: ['#d4e1ec','#edf3ee','#879cae','#344755','#5e7482']
};
export function paletteFor(name) {
  const [background,surface,accent,ink,muted] = recipes[name];
  return {background,surface,accent,ink,muted};
}

