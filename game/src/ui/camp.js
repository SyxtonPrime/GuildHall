// ---------- camp ----------
const gemCount=h=>gemsOf(h).length;
const freeSlots=h=>openSlots(h).length;
// first empty slot the hero has unlocked, or -1
function firstFree(h){ for(let k=0;k<4;k++) if(slotOpen(h,k)&&!(h.gems||[])[k]) return k; return -1; }
const openSlots=h=>{ const o=[]; for(let k=0;k<4;k++) if(slotOpen(h,k)&&!(h.gems||[])[k]) o.push(k); return o; };
function putGem(h,k,g){ if(!h.gems) h.gems=[]; while(h.gems.length<k) h.gems.push(null); h.gems[k]=g; }
// a gem change is refused if it would leave the hero with no max HP (Stormheart / Chaos Shard drawbacks, or pulling out a Vital)
function hpAfter(h,gems){ return computeStats(Object.assign({},h,{gems}),run.relics).maxHpRaw; }
function hpBlock(h,gems,verb){ const v=hpAfter(h,gems); if(v>=1) return false; toast(`${HEROES[h.id].name} can't ${verb}: max HP would drop to ${v}`); return true; }
function tryPut(h,k,g){ const gs=(h.gems||[]).slice(); while(gs.length<k) gs.push(null); gs[k]=g; if(hpBlock(h,gs,`hold ${GEMS[g].name}`)) return false; putGem(h,k,g); return true; }
function tryTake(h,k){ const gs=h.gems.slice(); gs[k]=null; if(hpBlock(h,gs,`lose ${GEMS[h.gems[k]].name}`)) return null; return takeGem(h,k); }
function takeGem(h,k){ const g=h.gems[k]; h.gems[k]=null; while(h.gems.length&&!h.gems[h.gems.length-1]) h.gems.pop(); return g; }
function withGem(h,g){ const c=Object.assign({},h,{gems:(h.gems||[]).slice()}); const k=firstFree(c); putGem(c,k<0?c.gems.length:k,g); return c; }
function statLine(h,prev){
  const relics=run.relics; const s=computeStats(h,relics);
  let s2=null; if(prev&&prev.gem&&freeSlots(h)>0){ s2=computeStats(withGem(h,prev.gem),relics); }
  const f=(k,lab,fmt)=>{ const a=s[k], b=s2?s2[k]:a; const v=fmt?fmt(a):a; if(s2&&b!==a){ const w=fmt?fmt(b):b; return `<span>${lab} <b>${v}</b>→<span class="${b>a?'up':'dn'}">${w}</span></span>`; } return `<span>${lab} <b>${v}</b></span>`; };
  const pct=v=>Math.round(v*100)+'%';
  let extra='';
  if(s2){ const adds=[];
    for(const k in s2.apply){ const a=s.apply[k]||0,b=s2.apply[k]; if(b!==a) adds.push(`<span class="pill ${k[0]}">${k} ${a}→${b}</span>`); }
    if(s2.startShield!==s.startShield) adds.push(`<span class="pill s">start Shield ${s.startShield}→${s2.startShield}</span>`);
    if(s2.regen!==s.regen) adds.push(`<span class="pill g">regen ${s.regen}→${s2.regen}</span>`);
    for(const k in s2.retaliate){ const a=s.retaliate[k]||0,b=s2.retaliate[k]; if(b!==a) adds.push(`<span class="pill ${k[0]}">attackers gain ${k} ${a}→${b}</span>`); }
    if(s2.spikes!==s.spikes) adds.push(`<span class="pill">spikes ${s.spikes}→${s2.spikes}</span>`);
    if(s2.lifesteal!==s.lifesteal) adds.push(`<span class="pill g">heal per hit ${s.lifesteal}→${s2.lifesteal}</span>`);
    if(s2.shieldPerAttack!==s.shieldPerAttack) adds.push(`<span class="pill s">Shield per attack ${s.shieldPerAttack}→${s2.shieldPerAttack}</span>`);
    s2.skills.filter(x=>!s.skills.some(y=>y.name===x.name)).forEach(x=>adds.push(`<span class="pill g">+ ${esc(x.name)}</span>`));
    extra=adds.length?`<div class="row wrap" style="gap:3px">${adds.join('')}</div>`:''; }
  const parts=[f('maxHp','HP'),f('atk','ATK'),f('spd','SPD')]; if(s.armor||(s2&&s2.armor)) parts.push(f('armor','ARM')); if(s.crit>0||(s2&&s2.crit>0)) parts.push(f('crit','CRIT',pct)); if(s.dodge>0||(s2&&s2.dodge>0)) parts.push(f('dodge','DGE',pct));
  const ap=Object.keys(s.apply).filter(k=>s.apply[k]>0).map(k=>`<span class="pill ${k[0]}">${k[0].toUpperCase()}${s.apply[k]*s.statusMult}</span>`).join('')
    +Object.keys(s.retaliate).map(k=>`<span class="pill ${k[0]}" title="attackers that hit this hero gain ${k}">↩${k[0].toUpperCase()}${s.retaliate[k]}</span>`).join('')
    +(s.spikes?`<span class="pill" title="attackers take damage">spikes ${s.spikes}</span>`:'')+(s.lifesteal?`<span class="pill g" title="heal per hit">leech ${s.lifesteal}</span>`:'')+(s.shieldPerAttack?`<span class="pill s" title="Shield per attack">+${s.shieldPerAttack}🛡/atk</span>`:'');
  return `<div class="st">${parts.join('')}${ap}</div>${extra}`;
}
function heroCell(h,idx){
  const d=HEROES[h.id]; const canEquip=sel.gem!==null; const prev=canEquip&&freeSlots(h)>0?{gem:run.bag[sel.gem]}:null;
  const chips=[]; for(let k=0;k<4;k++){ if(!slotOpen(h,k)) continue; const g=(h.gems||[])[k]; chips.push(g?ic(g,'g',14,GEMS[g].name):`<span class="ph"></span>`); }
  return `<div class="cell filled compact ${canEquip?'target':''}" data-h="${idx}" title="${esc(d.name)}">
   <div class="top">${hspr(h,36,d.name)}<span class="stars">${'★'.repeat(h.lv)}${'☆'.repeat(3-h.lv)}</span></div>
   <div class="nmc">${esc(d.name)}</div>
   <div class="chips">${chips.join('')}${canEquip?`<span class="good tiny" style="margin-left:auto">${freeSlots(h)>0?'slot':'swap'}</span>`:''}</div>
  </div>`;
}
function renderCamp(){
  if(!run) return renderTitle();
  const enc=run.enc, rows={front:[],back:[]}, act=actOf(run.floor);
  run.heroes.forEach((h,i)=>rows[h.row].push(heroCell(h,i)));
  const freeSlotsN=partyMax()-run.heroes.length;
  const fill=r=>{ while(r.length<ROW_MAX) r.push(`<div class="cell empty"></div>`); return r.join(''); };
  const KL={fight:'Fight',elite:'Elite',boss:'Boss',forge:'Forge'};
  const encHtml=e=>{ const eGroups={}; e.list.forEach(x=>{ const k=x.id+'|'+x.row; eGroups[k]=(eGroups[k]||0)+1; });
    return Object.keys(eGroups).map(k=>{ const [id,row]=k.split('|'); const d=ENEMIES[id]; return `<div class="en">${spr(id,24,d.name)}<span class="n ${d.boss?'acc':d.elite?'gold':''}">${esc(d.name)}${eGroups[k]>1?' ×'+eGroups[k]:''}</span><span class="s">${row} · HP ${Math.round(d.hp*e.mult*ENEMY_HP*(d.boss&&e.norm?e.norm.hp:1))} · ATK ${Math.round(d.atk*e.mult*ENEMY_ATK*(d.boss&&e.norm?e.norm.atk:1))} · SPD ${d.spd}${d.armor?' · ARM '+d.armor:''}</span>${d.ab?`<span class="a">${esc(d.ab)}</span>`:''}</div>`; }).join(''); };
  const kindLabel=KL[run.choices[run.pick].kind];
  const choiceHtml=c=>{ if(c.kind==='forge') return `<div class="t"><span class="gold">Gem Forge</span> <span class="pill g">once per act</span></div><div class="d">Merge two of your gems into one that carries every effect of both and counts as all their essences. Takes the floor instead of a fight.</div>`;
    const e=c.enc; return `<div class="t"><span class="${e.kind==='boss'?'acc':e.kind==='elite'?'gold':''}">${KL[e.kind]}</span>${e.theme?' · '+esc(e.theme):''} · ${e.list.length} enem${e.list.length===1?'y':'ies'} <span class="pill g">+${goldReward(e,true).total}g${e.kind==='elite'?' · free gem':e.kind==='boss'?' · free relic':''}</span></div><div class="enemies">${encHtml(e)}</div>`; };
  const pathChip=(c,i,on)=>{ const k=c.kind; const lab=k==='forge'?'Gem Forge':KL[k]; const sub=k==='forge'?'combine two gems':k==='elite'?`+${goldReward(c.enc,true).total}g · free gem`:k==='boss'?`+${goldReward(c.enc,true).total}g · free relic`:`+${goldReward(c.enc,true).total}g`;
    return `<div class="pchip ${on?'sel':''} k-${k}" ${i===undefined?'':`data-path="${i}"`}><div class="pl">${lab}</div><div class="ps">${sub}</div></div>`; };
  const pathsHtml=run.choices.length===1?`<div class="pathbar"><div class="eyebrow">Next</div>${pathChip(run.choices[0],undefined,true)}</div>`
    :`<div class="pathbar"><div class="eyebrow">Choose</div>${run.choices.map((c,i)=>pathChip(c,i,i===run.pick)).join('')}</div>`;
  const bonusHtml=run.bonus?`<div class="pathbar bonusbar"><div class="eyebrow">Bonus</div>${run.bonus.opts.map(k=>`<div class="pchip k-ev" data-ev="${k}"><div class="pl">${EVENTS[k].name}</div><div class="ps">${EVENTS[k].sub}</div></div>`).join('')}<button class="sm ghost" data-a="skipbonus">Skip</button></div>`:'';
  const goBtn=run.bonus?`<button class="primary" disabled>Choose a bonus first</button>`:run.choices[run.pick].kind==='forge'?`<button class="gold" data-a="forge">Enter the Forge</button>`:`<button class="primary" data-a="fight" ${run.heroes.length?'':'disabled'}>${run.choices[run.pick].kind==='boss'?spr(actBoss(),22,ENEMIES[actBoss()].name)+' ':''}Descend</button>`;
  const sh=run.shop, full=run.heroes.length>=partyMax();
  const tileH=sh.heroes.map((o,i)=>{ const d=HEROES[o.id]; const can=!o.sold&&run.gold>=heroCost()&&!full; return `<div class="tile ${o.sold?'sold':''}" data-oh="${i}">${ic(o.id,'h',32,d.name)}<div class="tl">${d.row} · ${d.hp}/${d.atk}/${d.spd}</div><div class="tc ${can?'gold':'muted'}">${o.sold?'hired':full?'guild full':heroCost()+'g'}</div></div>`; }).join('');
  const wantCount=g=>run.heroes.reduce((n,h)=>n+heroSkills(h.id).filter(sk=>!skillActive(h,sk)&&skillActive(withGem(h,g),sk)).length,0);
  // v33 compact gem strip (icon · +N · price). Previous tall tiles kept for easy revert:
  // const tileI=sh.gems.map((o,i)=>{ const d=GEMS[o.id]; const can=!o.sold&&run.gold>=d.cost; const w=o.sold?0:wantCount(o.id); return `<div class="tile ${o.sold?'sold':''} ${d.rare?'rare':''}" data-oi="${i}">${ic(o.id,'g',36,d.name)}<div class="tl">${esc(d.name)}${w?` <span class="good">+${w}</span>`:''}</div><div class="tc ${can?'gold':'muted'}">${o.sold?'bought':d.cost+'g'}</div></div>`; }).join('');
  const tileI=sh.gems.map((o,i)=>{ const d=GEMS[o.id]; const can=!o.sold&&run.gold>=gemPrice(o.id); const w=o.sold?0:wantCount(o.id); return `<div class="tile gstrip ${o.sold?'sold':''} ${d.rare?'rare':''}" data-oi="${i}" title="${esc(d.name)}">${ic(o.id,'g',28,d.name)}<span class="gcol">${w?`<span class="good">+${w}</span>`:''}<span class="tc ${can?'gold':'muted'}">${o.sold?'—':gemPrice(o.id)+'g'}</span></span></div>`; }).join('');
  const tileR=sh.relic?(()=>{ const o=sh.relic,d=RELICS[o.id]; const can=!o.sold&&run.gold>=d.cost; return `<div class="offer relic tier-${d.tier} ${o.sold?'sold':''}" data-or="1">${ic(o.id,'r',36,d.name)}<div class="body"><div class="t">${esc(d.name)} ${tierPill(o.id)}</div><div class="d">${esc(d.desc)}</div></div><div class="tc ${can?'gold':'muted'}" style="font-weight:700">${o.sold?'taken':d.cost+'g'}</div></div>`; })():'';
  $('#s-camp').innerHTML=`
   <div class="topbar"><div class="grow"><div class="eyebrow">${run.floor>FLOORS?`Floor ${run.floor} · <span class="gold">Endless</span>`:`Floor ${run.floor}/${FLOORS} · Act ${act}`}${run.depth?` · <span title="Depth ${run.depth}">D${run.depth}</span>`:''}</div><div class="row" style="gap:8px"><span class="stat gold">◆ ${run.gold}</span>${enc?`<span class="tiny muted">+${goldReward(enc,true).total} if you win</span>`:''}</div>${run.trial?`<div class="tiny acc">Trial: ${esc(TRIAL_DEBUFFS[run.trial.debuff])} · win for ${esc(TRIAL_PRIZES[run.trial.prize])}</div>`:''}${run.wager?`<div class="tiny gold">Wager: ${run.wager}g on the next fight, doubled if no hero falls</div>`:''}</div><span class="bossprev" data-boss="${actBoss()}" title="${esc(ENEMIES[actBoss()].name)} awaits on floor ${actKey(run.floor)*4}">${spr(actBoss(),26,ENEMIES[actBoss()].name)}</span><button class="sm gold" data-a="equip" ${run.heroes.length?'':'disabled'}>Equip</button><button class="sm" data-a="codex">Codex</button><button class="sm ghost" data-a="quit">Menu</button></div>
   ${bonusHtml}${pathsHtml}
   <div class="shop"><div class="row between"><div class="eyebrow">Market</div><div class="row" style="gap:6px"><button class="sm ${run.frozen?'frz':''}" data-a="freeze" title="Keep this stock for the next floor">${run.frozen?'Unfreeze':'Freeze'}</button><button class="sm" data-a="reroll" ${run.gold<rerollCost()||run.relics.includes('gildedchains')?'disabled':''}>${run.relics.includes('gildedchains')?'No rerolls':`Reroll · ${rerollCost()}g`}</button></div></div><div class="grid3">${tileH}</div><div class="grid3"${sh.gems.length>3?' style="grid-template-columns:repeat(4,minmax(0,1fr))"':''}>${tileI}</div>${tileR}${run.frozen?'<div class="tiny frzt">Frozen: this stock carries over to the next floor.</div>':''}</div>
   <div>
     <div class="row between"><div class="eyebrow">Guild <span class="${freeSlotsN>0?'good':'acc'}" title="${freeSlotsN} slot${freeSlotsN===1?'':'s'} free">${run.heroes.length}/${partyMax()}</span>${sel.gem!==null?' · <span class="good">tap a hero to slot it</span>':''}</div>${sel.gem!==null?`<button class="sm" data-a="unsel">Cancel</button>`:slotCost()?`<button class="sm ${run.gold>=slotCost()?'gold':''}" data-a="expand" ${run.gold<slotCost()?'disabled':''}>+1 slot · ${slotCost()}g</button>`:''}</div>
     <div class="rowlabel">Front</div><div class="grid4">${fill(rows.front)}</div>
     <div class="rowlabel">Back</div><div class="grid4">${fill(rows.back)}</div>
   </div>
   <div><div class="eyebrow">Loose gems${run.bag.length?'':' · none'}${sel.gem!==null?' · <span class="good">'+esc(GEMS[run.bag[sel.gem]].name)+'</span>':''}</div><div class="bag">${run.bag.map((id,i)=>`<div class="bagitem ${sel.gem===i?'sel':''}" data-bag="${i}">${ic(id,'g',28,GEMS[id].name)}</div>`).join('')}</div>${sel.gem!==null?`<div class="tiny good" style="margin-top:4px">${esc(GEMS[run.bag[sel.gem]].desc)} · <button class="sm ghost" data-a="sellbag">sell 1g</button></div>`:''}</div>
   ${run.relics.length?`<div class="relics"><span class="eyebrow">Relics</span>${run.relics.map(r=>`<span class="relicchip tier-${RELICS[r].tier}" data-r="${r}">${ic(r,'r',28,RELICS[r].name)}</span>`).join('')}</div>`:''}
   <div class="fightbar">${goBtn}</div>`;
  show('s-camp'); saveRun();
}
$('#s-camp').addEventListener('click',e=>{
  const el=e.target.closest('[data-a],[data-h],[data-bag],[data-oh],[data-oi],[data-or],[data-r],[data-path],[data-boss],[data-ev]'); if(!el) return;
  const ds=el.dataset; const act=actOf(run.floor);
  if(ds.a==='codex') return showCodex('h');
  if(ds.boss){ const d=ENEMIES[ds.boss]; return modal(`<h2>${spr(ds.boss,32,d.name)}${esc(d.name)} <span class="pill r">boss</span></h2><div class="small muted">Waits on floor ${actKey(run.floor)*4}${run.floor>FLOORS?'':' · Act '+act}</div><div class="small num">${bossLine(ds.boss,actKey(run.floor)*4)}</div><p class="small">${esc(d.ab||'')}</p><button data-x="close">Close</button>`); }
  if(ds.a==='equip'){ if(!run.heroes.length) return; return renderGems(Math.min(gemIdx,run.heroes.length-1)); }
  if(ds.a==='quit') return renderTitle();
  if(ds.a==='unsel'){ sel.gem=null; return renderCamp(); }
  if(ds.a==='reroll'){ rollShop(true); return renderCamp(); }
  if(ds.a==='freeze'){ run.frozen=!run.frozen; toast(run.frozen?'Market frozen — this stock stays for the next floor':'Market unfrozen'); return renderCamp(); }
  if(ds.a==='expand'){ const c=slotCost(); if(!c||run.gold<c) return; spend(c); run.partyMax=(run.partyMax||PARTY_START)+1; toast(`Guild can now hold ${run.partyMax} heroes`); return renderCamp(); }
  if(ds.a==='sellbag'){ run.bag.splice(sel.gem,1); run.gold+=1; sel.gem=null; return renderCamp(); }
  if(ds.a==='fight'){ if(!run.enc) return; return startBattle(); }
  if(ds.a==='forge') return openForge();
  if(ds.ev&&run.bonus){ const ev=EVENTS[ds.ev]; if(!ev.ok()) return toast('Nothing to do there right now'); return ev.open(); }
  if(ds.a==='skipbonus'){ run.bonus=null; return renderCamp(); }
  if(ds.path!==undefined){ pickPath(+ds.path); return renderCamp(); }
  if(ds.r) return modal(`<h2>${ic(ds.r,'r',28)}${esc(RELICS[ds.r].name)}</h2><div>${tierPill(ds.r)}</div><p class="muted">${esc(RELICS[ds.r].desc)}</p><button data-x="close">Close</button>`);
  if(ds.bag!==undefined){ if(longPress.fired){ longPress.fired=false; return; } sel.gem=(sel.gem===+ds.bag)?null:+ds.bag; return renderCamp(); }
  if(ds.oh!==undefined) return offerSheet('h',+ds.oh);
  if(ds.oi!==undefined) return offerSheet('g',+ds.oi);
  if(ds.or!==undefined) return offerSheet('r',0);
  if(ds.h!==undefined){ const i=+ds.h, h=run.heroes[i];
    if(sel.gem!==null){ if(freeSlots(h)<=0){ return renderGems(i); } if(tryPut(h,firstFree(h),run.bag[sel.gem])){ run.bag.splice(sel.gem,1); sel.gem=null; } return renderCamp(); }
    return heroSheet(i); }
});
