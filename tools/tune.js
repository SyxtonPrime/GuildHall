// Tuning harness: runs the greedy bot many times and logs which heroes / skills / gems / relics correlate with wins.
const E=require(process.env.ENGINE||'../game/engine.js');
const ri=n=>Math.floor(Math.random()*n), pick=a=>a[ri(a.length)], shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=ri(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
const nm=id=>E.CLASSES[id]?E.CLASSES[id].name:id; // class ids are opaque; report names
const ALL=E.STARTERS; // the market sells starters; the bot trains them up the tree
const lvCost=h=>h.lv===1?7:h.lv===2?11:null;
const ofTier=(t,own)=>Object.keys(E.RELICS).filter(k=>(E.RELICS[k].tier||'common')===t&&!own.includes(k));
function rollRelic(w,own){ const r=Math.random(); let acc=0,t='common'; for(const k of ['common','rare','legendary']){ acc+=w[k]; if(r<acc){t=k;break;} } const p=ofTier(t,own); if(p.length) return pick(p); const a=Object.keys(E.RELICS).filter(k=>!own.includes(k)); return a.length?pick(a):null; }
function addHero(run,id){ const rc=r=>run.heroes.filter(h=>h.row===r).length; let row=E.defaultRow(id); if(rc(row)>=(E.ROW_MAX||4)) row=row==='front'?'back':'front'; run.heroes.push(E.newHero(id,row)); }
function newSkills(h,g){ const hh=Object.assign({},h,{gems:h.gems.filter(Boolean).concat([g])}); return E.activeSkills(hh).length-E.activeSkills(h).length; }
const nGems=h=>h.gems.filter(Boolean).length;
const openIdx=h=>[0,1,2,3].slice(0,E.SLOTS(h.lv)).filter(k=>!h.gems[k]);
// front-liners put essences in armor sockets (they get hit), back-liners in weapon sockets; Gilt always armor
function slotFor(h,g){ const o=openIdx(h); if(!o.length) return -1; const R=E.GEMS[g].rare; const wantArmor=!R&&(g==='gilt'||(h.row==='front'&&g!=='swift'))||(process.env.ALLHAND?false:false); const pref=o.filter(k=>(E.slotKind(k)==='armor')===wantArmor); return process.env.NAIVE?o[0]:(pref.length?pref[0]:o[0]); }
function placeGems(run){ for(let n=0;n<50&&run.bag.length;n++){ let best=null; run.bag.forEach((g,bi)=>run.heroes.forEach(h=>{ if(!openIdx(h).length) return; const sc=newSkills(h,g)*10+Math.random(); if(!best||sc>best.sc) best={sc,bi,h}; })); if(!best) break; const g=run.bag.splice(best.bi,1)[0]; best.h.gems[slotFor(best.h,g)]=g; } }
function shopPhase(run){
  const heroes=shuffle(ALL.filter(x=>!run.heroes.some(h=>h.id===x))).slice(0,3);
  const gems=[0,1,2].map(()=>Math.random()<0.15+0.02*run.floor?pick(E.RARE_GEMS):pick(E.BASIC_GEMS));
  const relic=(process.env.EVEN&&run.floor%2)?null:rollRelic({common:0.65,rare:0.30,legendary:0.05},run.relics);
  run.pm=run.pm||3; const SC={3:6,4:10}; const cap=run.pm+(run.relics.includes('contract')?1:0);
  for(let k=0;k<2;k++){ if(run.heroes.length>=run.pm&&SC[run.pm]&&run.gold>=SC[run.pm]+5&&(run.floor>=3||Math.random()<0.3)){ run.gold-=SC[run.pm]; run.pm++; } }
  let hired=0; while(run.heroes.length<cap&&run.gold>=5&&hired<heroes.length&&(run.heroes.length<3||run.floor<=6||Math.random()<0.4)){ run.gold-=5; addHero(run,heroes[hired++]); }
  if(relic&&!process.env.FORCE_RELIC&&run.gold>=E.RELICS[relic].cost+3&&Math.random()<0.5){ run.gold-=E.RELICS[relic].cost; run.relics.push(relic); }
  const gcap=run.heroes.reduce((n,h)=>n+openIdx(h).length,0)-run.bag.length;
  const scored=gems.map(g=>({g,sc:run.heroes.reduce((m,h)=>Math.max(m,openIdx(h).length?newSkills(h,g):0),0)})).sort((a,b)=>b.sc-a.sc);
  let bought=0; for(const x of scored){ const c=E.GEMS[x.g].cost; if(run.gold>=c&&bought<Math.max(1,gcap)&&(x.sc>0||Math.random()<0.5)){ run.gold-=c; run.bag.push(x.g); bought++; } }
  placeGems(run);
  // training: only heroes whose gems meet an upgrade can train; several fits pick at random
  for(let k=0;k<2;k++){ const c=shuffle(run.heroes.filter(h=>lvCost(h)&&run.gold>=lvCost(h)&&E.upgradeOptions(h).length)); if(c.length&&(run.heroes.length>=3||run.floor>3)){ const h=c[0]; run.gold-=lvCost(h); E.trainHero(h,undefined,pick); } }
  placeGems(run);
}
// forge: fuse two loose gems if possible, else two gems on the hero holding the most, result back into that socket
function doForge(run){
  const id='m'+(++run.mergeN);
  const h=run.heroes.slice().sort((x,y)=>y.gems.filter(Boolean).length-x.gems.filter(Boolean).length)[0]; const ks=h.gems.map((g,k)=>g&&!E.GEMS[g].merged?k:-1).filter(k=>k>=0); const bi=run.bag.findIndex(g=>!E.GEMS[g].merged);
  if(ks.length&&bi>=0){ const k=ks[0]; const loose=run.bag.splice(bi,1)[0]; E.defineMergedGem(id,[h.gems[k],loose]); h.gems[k]=id; }
  else if(run.bag.length>=2){ const a=run.bag.shift(), b=run.bag.shift(); E.defineMergedGem(id,[a,b]); run.bag.push(id); placeGems(run); return; }
  else if(ks.length>=2){ const [k1,k2]=ks; E.defineMergedGem(id,[h.gems[k1],h.gems[k2]]); h.gems[k1]=id; h.gems[k2]=null; }
  while(h.gems.length&&!h.gems[h.gems.length-1]) h.gems.pop();
}
function sim(depth){
  const run={depth,floor:1,gold:12,heroes:[],bag:[],relics:[]};
  shuffle(ALL).slice(0,2).forEach(id=>addHero(run,id));
  const log={heroes:new Set(),skills:new Set(),gems:new Set(),relics:new Set(),heroFights:{},heroDealt:{},heroTaken:{},fights:0,seenE:{},deathE:{},themes:{},deathThemes:{}};
  run.mergeAct=0; run.mergeN=0; let forges=0, elites=0;
  while(true){
    const owned=run.bag.filter(g=>!E.GEMS[g].merged).length+run.heroes.reduce((n,h)=>n+h.gems.filter(g=>g&&!E.GEMS[g].merged).length,0);
    const ch=E.genChoices(run.floor,depth,{boss:process.env.BOSS&&E.bossPool(run.floor).includes(process.env.BOSS)?process.env.BOSS:undefined});
    if(run.bonus){ run.bonus=false; if(owned>=2&&process.env.NOEVENT===undefined){ forges++; doForge(run); } }
    const bf=[4,8,12].includes(run.floor)?'atBoss'+run.floor:null; if(bf&&!log[bf]) log[bf]={gold:run.gold,earned:run.earned||0}; // what each boss sees: gold in hand before that floor's market, and income so far
    shopPhase(run);
    if(bf&&log[bf].heroes===undefined) Object.assign(log[bf],{after:run.gold,heroes:run.heroes.length,t3:run.heroes.filter(h=>E.CLASSES[h.id].tier===2).length,caps:run.heroes.filter(h=>E.CLASSES[h.id].tier===3).length,gems:run.heroes.reduce((n,h)=>n+h.gems.filter(Boolean).length,0),bag:run.bag.length});
    // path choice: forge when it frees a socket (≥4 gems owned), elite ELITE_P of the time, else fight
    let path=ch.find(c=>c.kind==='fight')||ch[0];
    const fo=ch.find(c=>c.kind==='forge'), el=ch.find(c=>c.kind==='elite');
    const freeSock=run.heroes.reduce((n,h)=>n+openIdx(h).length,0); if(fo&&freeSock===0&&run.bag.length>=1&&Math.random()<(process.env.FORGE_P!==undefined?+process.env.FORGE_P:0.7)) path=fo; else if(el&&Math.random()<(process.env.ELITE_P!==undefined?+process.env.ELITE_P:0.7)) path=el; else if(!ch.find(c=>c.kind==='fight')) path=el||fo||ch[0];
    if(path.kind==='forge'){ forges++; run.mergeAct=E.curAct(run.floor); doForge(run); run.floor++; continue; }
    if(path.kind==='elite') elites++;
    const enc=path.enc;
    const B=E.createBattle(run.heroes,enc,run.relics,run.gold); E.runToEnd(B);
    { const ids=new Set(enc.list.map(x=>x.id)); ids.forEach(id=>{ log.seenE[id]=(log.seenE[id]||0)+1; if(B.winner!=='p') log.deathE[id]=(log.deathE[id]||0)+1; }); if(enc.theme){ log.themes[enc.theme]=(log.themes[enc.theme]||0)+1; if(B.winner!=='p') log.deathThemes[enc.theme]=(log.deathThemes[enc.theme]||0)+1; } }
    run.heroes.forEach(h=>{ log.heroes.add(nm(h.id)); E.activeSkills(h).forEach(sk=>log.skills.add(nm(sk.cls)+'·'+sk.name+'·'+sk.need)); h.gems.forEach(g=>{ if(g) log.gems.add(g); }); });
    run.relics.forEach(r=>log.relics.add(r));
    B.units.filter(u=>u.hero).forEach(u=>{ const id=nm(u.hero.id); log.heroFights[id]=(log.heroFights[id]||0)+1; log.heroDealt[id]=(log.heroDealt[id]||0)+u.stats.dealt; log.heroTaken[id]=(log.heroTaken[id]||0)+u.stats.taken; });
    log.fights++;
    if(B.winner!=='p') return run.endless?Object.assign(log,{won:true,floor:13,endFloor:run.floor,forges,elites}):Object.assign(log,{won:false,floor:run.floor,forges,elites});
    let cap=3,extra=0; run.heroes.forEach(h=>{ const S=E.computeStats(h,run.relics), g=S.gold; cap+=g.interest; const u=B.units.find(x=>x.hero===h), k=u?u.stats.kills:0; extra+=g.win+(g.kill-S.giltHand)*k+S.giltHand*Math.floor(k/E.GILT_PER_KILLS)+((enc.kind!=='fight')?g.elite:0); }); // Gilt weapons pay per 2 kills, as in the camp
    { const inc=3+enc.act+(enc.kind==='elite'?2:enc.kind==='boss'?4:0)+Math.min(cap,Math.floor(run.gold/5))+(run.relics.includes('coinpurse')?2:0)+extra+(B.bounty||0); run.gold+=inc; run.earned=(run.earned||0)+inc; }
    if(enc.kind==='elite') run.bag.push(pick(E.RARE_GEMS));
    if(enc.kind==='boss'){ const pool=[]; const own=()=>run.relics.concat(pool); const L=ofTier('legendary',own()); if(L.length) pool.push(pick(L)); while(pool.length<3){ const r=rollRelic({common:0.45,rare:0.45,legendary:0.10},own()); if(!r) break; pool.push(r); } const FR=process.env.FORCE_RELIC; let r=FR&&!run._forced?(run._forced=1,FR==='none'?null:FR):pick(pool); if(r&&!run.relics.includes(r)) run.relics.push(r); }
    run.floor++; if(run.floor%4===3) run.bonus=true;
    if(run.floor>E.FLOORS&&!run.endless){ run.endless=true; log.won=true; if(!process.env.ENDLESS) break; }
    if(run.endless&&run.floor>60) break;
  }
  return Object.assign(log,{won:true,floor:13,endFloor:run.floor,forges,elites});
}
const N=+process.argv[2]||2000, depth=+process.argv[3]||0;
const runs=[]; for(let i=0;i<N;i++) runs.push(sim(depth));
const base=runs.filter(r=>r.won).length/N, baseFloor=runs.reduce((a,r)=>a+r.floor,0)/N;
for(const f of [4,8,12]){ const ab=runs.map(r=>r['atBoss'+f]).filter(Boolean); if(ab.length){ const av=k=>(ab.reduce((a,x)=>a+x[k],0)/ab.length).toFixed(1); const sorted=ab.map(x=>x.gold).sort((a,b)=>a-b), q=p=>sorted[Math.floor(p*(sorted.length-1))];
  console.log(`at the floor ${f} boss (${ab.length} runs got there): gold in hand ${av('gold')} (quartiles ${q(0.25)}/${q(0.5)}/${q(0.75)}), earned since the start ${av('earned')} (+12 to begin), after that market ${av('after')} · heroes ${av('heroes')}, tier 3 ${av('t3')}, capstones ${av('caps')}, gems socketed ${av('gems')}, in the bag ${av('bag')}`); } }
console.log(`runs ${N} depth ${depth}: win ${(100*base).toFixed(1)}%  avg floor ${baseFloor.toFixed(2)}  forges/run ${(runs.reduce((a,r)=>a+(r.forges||0),0)/N).toFixed(2)}  elites/run ${(runs.reduce((a,r)=>a+(r.elites||0),0)/N).toFixed(2)}  win|forged ${(100*runs.filter(r=>r.forges).filter(r=>r.won).length/Math.max(1,runs.filter(r=>r.forges).length)).toFixed(1)}%  win|no forge ${(100*runs.filter(r=>!r.forges).filter(r=>r.won).length/Math.max(1,runs.filter(r=>!r.forges).length)).toFixed(1)}%`);
function table(title,key,minN,extraCols){
  const st={}; runs.forEach(r=>{ r[key].forEach(k=>{ const o=st[k]=st[k]||{n:0,w:0,f:0}; o.n++; if(r.won) o.w++; o.f+=r.floor; }); });
  const rows=Object.keys(st).filter(k=>st[k].n>=minN).map(k=>({k,n:st[k].n,wr:st[k].w/st[k].n,fl:st[k].f/st[k].n}));
  return rows;
}
function print(title,rows,ref){
  console.log(`\n== ${title} (Δ vs ${ref.label} win ${(100*ref.wr).toFixed(1)}%)`);
  rows.sort((a,b)=>b.wr-a.wr).forEach(r=>console.log(`${(r.k).padEnd(46)} n=${String(r.n).padStart(5)}  win ${(100*r.wr).toFixed(1).padStart(5)}%  Δ${((r.wr-ref.wr)*100).toFixed(1).padStart(6)}  floor ${r.fl.toFixed(2)}${r.extra||''}`));
}
// enemies: how often a fight containing them is lost (lethality)
{ const seen={},dead={},ts={},td={}; runs.forEach(r=>{ for(const k in r.seenE){ seen[k]=(seen[k]||0)+r.seenE[k]; dead[k]=(dead[k]||0)+(r.deathE[k]||0); } for(const k in r.themes){ ts[k]=(ts[k]||0)+r.themes[k]; td[k]=(td[k]||0)+(r.deathThemes[k]||0); } });
  const allF=runs.reduce((a,r)=>a+r.fights,0), allD=runs.filter(r=>!r.won).length;
  console.log(`\n== ENEMIES (fights lost when present; overall ${(100*allD/allF).toFixed(1)}% of fights are lost)`);
  Object.keys(seen).sort((a,b)=>dead[b]/seen[b]-dead[a]/seen[a]).forEach(k=>console.log(`${k.padEnd(16)} fights=${String(seen[k]).padStart(5)}  lost ${(100*dead[k]/seen[k]).toFixed(1).padStart(5)}%`));
  console.log(`\n== ENCOUNTER THEMES`); Object.keys(ts).sort((a,b)=>td[b]/ts[b]-td[a]/ts[a]).forEach(k=>console.log(`${k.padEnd(16)} fights=${String(ts[k]).padStart(5)}  lost ${(100*(td[k]||0)/ts[k]).toFixed(1).padStart(5)}%`)); }
// heroes: win rate when present + per-fight damage share
const hero=table('heroes','heroes',30); const dealt={},taken={},fights={};
runs.forEach(r=>{ for(const id in r.heroFights){ dealt[id]=(dealt[id]||0)+r.heroDealt[id]; taken[id]=(taken[id]||0)+r.heroTaken[id]; fights[id]=(fights[id]||0)+r.heroFights[id]; } });
hero.forEach(r=>{ r.extra=`  dealt/fight ${(dealt[r.k]/fights[r.k]).toFixed(0).padStart(4)}  taken/fight ${(taken[r.k]/fights[r.k]).toFixed(0).padStart(4)}`; });
print('HEROES',hero,{label:'all runs',wr:base});
print('RELICS',table('relics','relics',30),{label:'all runs',wr:base});
print('GEMS',table('gems','gems',30),{label:'all runs',wr:base});
// skills by tier (essence count), compared to the tier average
const sk=table('skills','skills',25);
for(const tier of [1,2,3,4]){ const rows=sk.filter(r=>r.k.split('·')[2].length===tier); if(!rows.length) continue; const avg=rows.reduce((a,r)=>a+r.wr*r.n,0)/rows.reduce((a,r)=>a+r.n,0); print(`SKILLS tier ${tier} (${tier} essence${tier>1?'s':''})`,rows,{label:'tier avg',wr:avg}); }
// death floor histogram (where runs end)
{ const h={}; runs.forEach(r=>{ if(!r.won) h[r.floor]=(h[r.floor]||0)+1; }); const alive=f=>runs.filter(r=>r.won||r.floor>f).length;
  console.log('\n== DEATHS BY FLOOR (lost / reached)'); for(let f=1;f<=12;f++){ const reached=runs.filter(r=>r.won||r.floor>=f).length; console.log(String(f).padStart(2),'lost',String(h[f]||0).padStart(4),'of',String(reached).padStart(4),'reached →',(100*(h[f]||0)/Math.max(1,reached)).toFixed(1).padStart(5)+'%'); } }

if(process.env.ENDLESS){ const w=runs.filter(r=>r.won); const fs=w.map(r=>r.endFloor).sort((a,b)=>a-b); const q=x=>fs[Math.floor(x*(fs.length-1))];
  console.log(`\n== ENDLESS (${w.length} cleared runs): death floor p25 ${q(.25)} · median ${q(.5)} · p75 ${q(.75)} · p90 ${q(.9)} · max ${fs[fs.length-1]}`); }
