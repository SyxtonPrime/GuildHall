// ---------- run ----------
function newRun(depth){
  meta.runs++; save(KEY_META,meta);
  run={depth,floor:1,gold:12,heroes:[],bag:[],relics:[],shop:null,enc:null,kills:0,fights:0,rerolls:0,startPick:true,merged:[],mergeN:0,mergeAct:0};
  offerPaths();
  rollShop(false);
  saveRun();
  // starting pick: choose 2 of 4 heroes free
  showStartPick();
}
function saveRun(){ save(KEY_RUN,run); }
// paths: run.choices (1–2 options), run.pick (selected index), run.enc (selected encounter or null for the Forge)
const fusableCount=()=>run.bag.filter(g=>!GEMS[g].merged).length+run.heroes.reduce((n,h)=>n+gemsOf(h).filter(g=>!GEMS[g].merged).length,0);
const forgeOpen=()=>run.mergeAct!==curAct(run.floor)&&fusableCount()>=2;
const actKey=f=>Math.ceil(f/4); // act, or endless block
function actBoss(){ run.bosses=run.bosses||{}; const k=actKey(run.floor); if(!run.bosses[k]) run.bosses[k]=rollActBoss(run.floor); return run.bosses[k]; }
function offerPaths(){ run.choices=genChoices(run.floor,run.depth,{boss:actBoss()}); run.pick=run.choices.findIndex(c=>c.enc); if(run.pick<0) run.pick=0; run.enc=run.choices[run.pick].enc||null; }
function pickPath(i){ run.pick=i; run.enc=run.choices[i].enc||null; }
function loadRun(){ const r=load(KEY_RUN,null); if(!r) return null; if(r.heroes.some(h=>!CLASSES[h.id])) return null; /* a save from before the class tree */ restoreMergedGems(r.merged); if(!r.choices){ r.choices=[{kind:r.enc?r.enc.kind:'fight',enc:r.enc}]; r.pick=0; } if(r.mergeAct===undefined){ r.mergeAct=0; r.merged=r.merged||[]; r.mergeN=r.mergeN||0; } if(r.choices.some(c=>c.kind==='forge')){ r.choices=r.choices.filter(c=>c.kind!=='forge'); r.pick=0; r.enc=r.choices[0].enc; } return r; }
const rerollCost=()=>Math.max(0,1+(run.rr||0)-(run.relics.includes('scales')?1:0));
const gemFx=(g,active)=>{ const d=GEMS[g]; if(!d.hand) return esc(d.desc); const row=(k,lab)=>`<div class="gfx ${active&&active!==k?'off':''}"><span class="gk ${k}">${lab}</span> ${esc(d[k])}</div>`; return row('hand','Weapon')+row('armor','Armor'); };
// rare gem body: bonus/drawback, plus (with Prismatic Lens, 3+ essences) every essence's socket effects
const rareFx=(g,activeKind)=>{ const d=GEMS[g], eff=esc(d.desc.replace(/^[^.]*\. ?/,''));
  const prism=run&&run.relics.includes('prism')&&d.ess.length>=3;
  if(!prism) return `<div class="tiny muted">Counts as ${d.ess.map(e=>GEMS[e].name).join(' + ')} for skill recipes, but gives none of their passives.</div><div style="margin-top:4px">${eff}</div>`;
  return `<div class="tiny gold">Prismatic Lens: this gem also grants each of its essences' passives.</div><div style="margin-top:4px">${eff}</div>${d.ess.map(e=>`<div class="row" style="gap:6px;margin-top:4px;align-items:flex-start">${ic(e,'g',16,GEMS[e].name)}<div><b style="color:${ARCH_C[GEMS[e].arch]}">${esc(GEMS[e].name)}</b>${gemFx(e,activeKind)}</div></div>`).join('')}`; };
const tierPill=id=>{ const t=RELICS[id].tier; return `<span class="pill tier-${t}">${TIER_LABEL[t]}</span>`; };
// shop relic rarity: 65% common, 30% rare, 5% legendary (falls back to any unowned relic)
function rollRelic(weights,owned){ const r=Math.random(); let acc=0, t='common'; for(const k of RELIC_TIERS){ acc+=weights[k]; if(r<acc){ t=k; break; } }
  const pool=relicsOfTier(t,owned); if(pool.length) return pick(pool); const any=Object.keys(RELICS).filter(k=>!owned.includes(k)); return any.length?pick(any):null; }
const SHOP_RELIC_W={common:0.65,rare:0.30,legendary:0.05};
const RELIC_HOARD_GOLD=10; // boss reward when no relics are left
function rollShop(charge){
  if(charge){ const c=rerollCost(); if(run.gold<c) return; run.gold-=c; run.rerolls++; run.rr=(run.rr||0)+1; if(run.frozen){ run.frozen=false; toast('Market unfrozen'); } }
  else { run.rr=0; if(run.frozen&&run.shop){ run.frozen=false; saveRun(); return; } } // frozen: carry the same stock over once (bought slots stay empty), then unfreeze
  const owned=run.heroes.map(h=>h.id);
  const hpool=shuffle(unlockedHeroes().filter(h=>!owned.includes(h)));
  const heroes=hpool.slice(0,3).map(id=>({id,sold:false}));
  const gems=rollGems(3).map(id=>({id,sold:false}));
  const rid=rollRelic(SHOP_RELIC_W,run.relics); // one relic offer every floor
  const relic=rid?{id:rid,sold:false}:null;
  run.shop={heroes,gems,relic};
  heroes.forEach(h=>seen('h',h.id)); gems.forEach(g=>seen('g',g.id)); if(relic) seen('r',relic.id);
  saveRun();
}
const heroCost=3, lvCost=h=>h.lv===1?5:h.lv===2?9:null; // cost to unlock the next gear slot (also raises the hero's ★)
const openSet=h=>h.open||Array.from({length:SLOTS(h.lv)},(_,k)=>k); // unlocked gear slots; older saves: the first lv+1
const slotOpen=(h,k)=>openSet(h).includes(k);
// Training: pays, opens the slot and promotes. 'noupgrade' when the hero's gems meet none of its upgrades; several fits leave run.promo for the UI to resolve.
function unlockSlot(h,k){ const c=lvCost(h); if(!c||run.gold<c||slotOpen(h,k)) return false; if(!upgradeOptions(h).length) return 'noupgrade'; run.gold-=c; h.open=openSet(h); const opts=trainHero(h,k); if(opts.length>1) run.promo={hi:run.heroes.indexOf(h),opts}; return true; }
function rollGems(n,forceRare){
  const basics=shuffle(BASIC_GEMS), rares=shuffle(RARE_GEMS.filter(k=>GEMS[k].rare===1).concat(shuffle(RARE_GEMS.filter(k=>GEMS[k].rare===2)).slice(0,2)));
  const out=[]; for(let i=0;i<n;i++){ const rare=(forceRare&&i===n-1)||(Math.random()<0.15+0.02*run.floor); out.push(rare&&rares.length?rares.shift():basics.shift()); }
  return shuffle(out);
}
const PARTY_START=3, SLOT_COST={3:6,4:10};
const partyMax=()=>(run.partyMax||PARTY_START)+(run.relics.includes('contract')?1:0);
const slotCost=()=>SLOT_COST[run.partyMax||PARTY_START]||null; // purchases ignore the Contract's bonus slot
function addHero(id){
  const rowCount=r=>run.heroes.filter(h=>h.row===r).length;
  let row=defaultRow(id); if(rowCount(row)>=ROW_MAX) row=row==='front'?'back':'front';
  run.heroes.push(newHero(id,row));
}
function goldReward(enc,win,killsBy){
  const base=3+enc.act+(enc.kind==='elite'?2:enc.kind==='boss'?4:0);
  let cap=3, gems=0, skills=0;
  run.heroes.forEach((h,i)=>{ const S=computeStats(h,run.relics), g=S.gold, kk=(killsBy&&killsBy[i])||0, gg=S.giltArmor+S.giltHand*kk; cap+=g.interest; gems+=gg; skills+=-gg+g.win+g.kill*((killsBy&&killsBy[i])||0)+((enc.kind==='elite'||enc.kind==='boss')?g.elite:0); });
  const interest=Math.min(cap,Math.floor(run.gold/5));
  const purse=run.relics.includes('coinpurse')?2:0;
  return {base,interest,purse,gems,skills,total:base+interest+purse+gems+skills};
}

