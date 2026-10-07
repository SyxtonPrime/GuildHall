// Isolates the engine from the bot: fixed-size random parties against generated encounters on one floor. node/gjs tools/floor-check.js [floor] [trials]
const E=require(process.env.ENGINE||'../game/engine.js');
const ri=n=>Math.floor(Math.random()*n), pick=a=>a[ri(a.length)];
const floor=+process.argv[2]||2, N=+process.argv[3]||2000, ALL=Object.keys(E.HEROES);
const gemsFor=()=>process.env.GEMS?process.env.GEMS.split(','):[];
let wins=0, byHero={}, byEnemy={};
for(let i=0;i<N;i++){
  const ids=[]; while(ids.length<(+process.env.PARTY||2)){ const h=pick(ALL); if(!ids.includes(h)) ids.push(h); }
  const heroes=ids.map(id=>({id,lv:1,gems:gemsFor(),open:[0,1],row:E.defaultRow(id),kills:0}));
  const enc=E.genEncounter(floor,0); const B=E.createBattle(heroes,enc,[]); E.runToEnd(B);
  const w=B.winner==='p'; if(w) wins++;
  ids.forEach(id=>{ const o=byHero[id]=byHero[id]||{n:0,w:0}; o.n++; if(w) o.w++; });
  new Set(enc.list.map(x=>x.id)).forEach(id=>{ const o=byEnemy[id]=byEnemy[id]||{n:0,w:0}; o.n++; if(w) o.w++; });
}
console.log(`floor ${floor}: ${N} fights, won ${(100*wins/N).toFixed(1)}%`);
const row=(k,o)=>`${k.padEnd(14)} n=${String(o.n).padStart(4)} won ${(100*o.w/o.n).toFixed(0).padStart(3)}%`;
console.log('heroes: '+Object.keys(byHero).sort().map(k=>row(k,byHero[k])).join(' | '));
console.log('enemies: '+Object.keys(byEnemy).sort().map(k=>row(k,byEnemy[k])).join(' | '));
