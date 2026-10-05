const E=require('../game/engine.js');
const team=(g,kind)=>{ const put=(row)=>{ const a=[null,null,null,null]; if(g){ const ks=kind==='hand'?[0,3]:[1,2]; a[ks[0]]=g; a[ks[1]]=g; } return a; };
  return [{id:'knight',lv:3,row:'front',gems:put()},{id:'berserker',lv:3,row:'front',gems:put()},{id:'monk',lv:3,row:'front',gems:put()},{id:'ranger',lv:3,row:'back',gems:put()},{id:'cleric',lv:3,row:'back',gems:put()}].map(h=>Object.assign(h,{bonusHp:0})); };
const N=+process.argv[2]||600, floors=[8,9,10,11];
function wr(g,kind){ let w=0,n=0; for(const f of floors) for(let i=0;i<N;i++){ const B=E.createBattle(team(g,kind),E.genEncounter(f,0),[]); E.runToEnd(B); n++; if(B.winner==='p') w++; } return 100*w/n; }
const base=wr(null); console.log('no gems',base.toFixed(1));
for(const g of ['venom','ember','frost','ward','edge','vital','swift']){ const h=wr(g,'hand'), a=wr(g,'armor'); console.log(g.padEnd(6),'weapon',(h-base).toFixed(1).padStart(5),'  armor',(a-base).toFixed(1).padStart(5)); }
