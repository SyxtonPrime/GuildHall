// Boss benchmark: can a party of a given shape beat an act's bosses? node/gjs tools/boss-check.js [scenario|all] [comps]
//   final-caps  floor 12 boss vs 4 capstones (2 front, 2 back), each with its requirement and one capstone skill   — should ~always win
//   final-t3    floor 12 boss vs 4 tier 3 heroes (2 front, 2 back) with every tier 3 skill active                  — should ~never win
//   first-mixed floor 4 boss vs 1 tier 3 (lv 2, requirement only) + 3 starters (1 gem each): 5 gems between them    — a decent chance
// Each comp is random (classes, routes, boss) and fights once; the per-hero table is the win rate of comps containing that class.
// Gems are given as a list and may exceed the hero's slots (the engine counts recipes over the whole list; only the first four get
// socket passives), so this measures skills and stats, not gem economy.
const E=require(process.env.ENGINE||'../game/engine.js');
const ri=n=>Math.floor(Math.random()*n), pick=a=>a[ri(a.length)];
const LET={}; for(const k in E.GEMS) if(E.GEMS[k].letter) LET[E.GEMS[k].letter]=k;
const byTier=t=>Object.keys(E.CLASSES).filter(id=>E.CLASSES[id].tier===t);
const routeTo=id=>{ const p=[id]; let c=E.CLASSES[id]; while(c.tier>0){ const f=pick(c.from); p.unshift(f); c=E.CLASSES[f]; } return p; }; // a random valid route
const union=lists=>{ const n={}; lists.forEach(l=>{ const c={}; for(const ch of l) c[ch]=(c[ch]||0)+1; for(const ch in c) n[ch]=Math.max(n[ch]||0,c[ch]); }); const g=[]; for(const ch in n) for(let i=0;i<n[ch];i++) g.push(LET[ch]); return g; };
const need=id=>E.CLASSES[id].need; // the class requirement as letters
function hero(id,lv,gems,row){ const path=routeTo(id); const h=E.newHero(id,row); h.root=path[0]; h.path=path; h.lv=lv; h.gems=gems; h.open=[0,1,2,3].slice(0,lv+1); return h; }
const rowOf=id=>E.CLASSES[id].role==='front'?'front':'back';
const fits=(gems,sk)=>{ const have={}; gems.forEach(g=>have[g]=(have[g]||0)+1); const n={}; for(const ch of sk.need) n[LET[ch]]=(n[LET[ch]]||0)+1; return Object.keys(n).every(g=>(have[g]||0)>=n[g]); };
function bestThird(id){ const base=union([need(id)]); let best=null, bn=-1; for(const l in LET){ const g=base.concat(LET[l]); const n=E.heroSkills(id).filter(sk=>fits(g,sk)).length; if(n>bn){ bn=n; best=g; } } return best; }
const split=(ids,nFront,nBack)=>{ const fr=ids.filter(id=>E.CLASSES[id].role==='front'), bk=ids.filter(id=>E.CLASSES[id].role!=='front'); const out=[]; const take=(pool,n)=>{ const p=pool.slice(); while(out.length<n+out.length&&p.length&&n-->0) out.push(p.splice(ri(p.length),1)[0]); }; take(fr,nFront); take(bk,nBack); return out; };
const SCEN={
  'final-caps':{floor:12,gold:30,spent:60,party:()=>split(byTier(3),2,2).map(id=>{ const c=E.CLASSES[id], sk=c.skills.slice().sort((a,b)=>a.need.length-b.need.length)[0]; return hero(id,3,union([need(id),sk.need]),rowOf(id)); })},
  // a tier 3 hero tops out at ★★ with three slots (every training promotes): its requirement plus the one gem that unlocks the most skills
  'final-t3':{floor:12,gold:30,spent:60,party:()=>split(byTier(2),2,2).map(id=>hero(id,2,bestThird(id),rowOf(id)))},
  'first-mixed':{floor:4,gold:10,spent:15,party:()=>mixed(3)},
  'first-3':{floor:4,gold:10,spent:15,party:()=>mixed(2)}, // the guild holds 3 until a slot is bought: 1 tier 3 + 2 starters, 4 gems
};
function mixed(nStarters){ const t3=pick(byTier(2)); const ss=[]; const pool=byTier(1); while(ss.length<nStarters){ const s=pick(pool); if(!ss.includes(s)) ss.push(s); }
  return [hero(t3,2,union([need(t3)]),rowOf(t3))].concat(ss.map(s=>hero(s,1,union([need(s)]),rowOf(s)))); }
const B1=+process.env.B1||1, DEPTH=+process.env.DEPTH||0; // DEPTH: ascension (every enemy ×(1+0.1·depth)) // sweep: act 1 bosses' HP and ATK multiplied in the fight (bake the answer into data/enemies.js)
const which=process.argv[2]||'all', N=+process.argv[3]||400;
for(const name of (which==='all'?Object.keys(SCEN):[which])){
  const S=SCEN[name]; let wins=0; const byHero={}, byBoss={};
  for(let i=0;i<N;i++){ const party=S.party(); const enc=E.genEncounter(S.floor,DEPTH,'boss'); const B=E.createBattle(party,enc,[],S.gold,{spent:S.spent}); if(S.floor<=4&&B1!==1) B.units.filter(x=>x.side==='e'&&x.def.boss).forEach(x=>{ x.maxHp=x.hp=Math.round(x.hp*B1); x.atk=Math.round(x.atk*B1); }); E.runToEnd(B); const w=B.winner==='p'; if(w) wins++;
    party.forEach(h=>{ const k=E.CLASSES[h.id].name; const o=byHero[k]=byHero[k]||{n:0,w:0}; o.n++; if(w) o.w++; }); const b=enc.list[0].id; const o=byBoss[b]=byBoss[b]||{n:0,w:0}; o.n++; if(w) o.w++; }
  const pct=o=>(100*o.w/o.n).toFixed(0).padStart(3)+'%';
  console.log(`\n== ${name}: floor ${S.floor} boss, ${N} comps, won ${(100*wins/N).toFixed(1)}%`);
  console.log('bosses: '+Object.keys(byBoss).sort().map(k=>`${k} ${pct(byBoss[k])} (n=${byBoss[k].n})`).join(' · '));
  const rows=Object.keys(byHero).sort((a,b)=>byHero[b].w/byHero[b].n-byHero[a].w/byHero[a].n);
  console.log('heroes (win rate of comps containing them, best first):');
  rows.forEach(k=>console.log(`  ${k.padEnd(16)} ${pct(byHero[k])}  n=${String(byHero[k].n).padStart(3)}  ${E.CLASSES[Object.keys(E.CLASSES).find(id=>E.CLASSES[id].name===k)].role}`));
}
