// Arena: isolates one hero with exactly one recipe's gems, in a fixed party, at a floor matching the recipe tier.
const E=require(process.env.ENGINE||'../game/engine.js');
const L2G={V:'venom',E:'ember',F:'frost',W:'ward',K:'edge',H:'vital',S:'swift',G:'gilt'};
const TIER={1:{lv:1,floor:3},2:{lv:2,floor:5},3:{lv:2,floor:6},4:{lv:3,floor:9}};
const N=+process.argv[2]||300;
function winRate(hero,floor,n){ let w=0,dealt=0; for(let i=0;i<n;i++){ const party=[JSON.parse(JSON.stringify(hero)),{id:'knight',lv:hero.lv,row:'front',gems:[]},{id:'ranger',lv:hero.lv,row:'back',gems:[]}]; if(hero.id==='knight') party[1].id='shieldmaiden'; if(hero.id==='ranger') party[2].id='sniper'; const B=E.createBattle(party,E.genEncounter(floor,0),[]); E.runToEnd(B); if(B.winner==='p') w++; dealt+=B.units[0].stats.dealt; } return {wr:w/n,dealt:dealt/n}; }
const mode=process.argv[3]||'skills';
if(mode==='heroes'){
  console.log('== HERO BASELINE (no gems, ★★, floor 5; party: hero + knight + ranger)');
  const rows=Object.keys(E.HEROES).map(id=>{ const r=winRate({id,lv:2,row:E.defaultRow(id),gems:[]},5,N); return {id,...r}; });
  const avg=rows.reduce((a,r)=>a+r.wr,0)/rows.length;
  rows.sort((a,b)=>b.wr-a.wr).forEach(r=>console.log(`${r.id.padEnd(13)} win ${(100*r.wr).toFixed(1).padStart(5)}%  Δ${((r.wr-avg)*100).toFixed(1).padStart(6)}  dealt ${r.dealt.toFixed(0)}`));
} else {
  const out={1:[],2:[],3:[],4:[]};
  for(const id in E.HEROES){ for(const sk0 of E.SKILLS[id]){ const t=sk0.need.length; const cfg=TIER[t]; const gems=[...sk0.need].map(c=>L2G[c]); const hero={id,lv:cfg.lv,row:E.defaultRow(id),gems}; const r=winRate(hero,cfg.floor,N); const nm=(sk0.name||(E.TRAITS[sk0.ref]||E.FUSIONS[sk0.ref]).name); out[t].push({k:`${id}·${nm}·${sk0.need}`,...r,id}); } }
  for(const t of [1,2,3,4]){ const rows=out[t]; const avg=rows.reduce((a,r)=>a+r.wr,0)/rows.length; console.log(`\n== TIER ${t} skills (hero ★${'★'.repeat(TIER[t].lv-1)}, floor ${TIER[t].floor}, N=${N}) avg ${(100*avg).toFixed(1)}%`);
    rows.sort((a,b)=>b.wr-a.wr).forEach(r=>console.log(`${r.k.padEnd(48)} win ${(100*r.wr).toFixed(1).padStart(5)}%  Δ${((r.wr-avg)*100).toFixed(1).padStart(6)}  dealt ${r.dealt.toFixed(0)}`)); }
}
