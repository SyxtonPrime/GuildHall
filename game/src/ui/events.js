// ---------- Bonus events: after each act's 2nd fight the camp offers two of these (pick one, or skip) ----------
const EVENTS={
 forge:{name:'Gem Forge',sub:'combine two gems',ok:()=>fusableCount()>=2,open:()=>openForge()},
 enchanter:{name:'Enchanter',sub:'swap socket types',ok:()=>run.heroes.length>0,open:()=>openEnchanter()},
 cutter:{name:'Gem Cutter',sub:'reshape two gems',ok:()=>ownedGems().some(it=>!GEMS[it.g].merged),open:()=>openCutter()},
 retire:{name:'Retirement',sub:'pass on a hero\'s strength',ok:()=>run.heroes.length>=2,open:()=>openRetire()},
 scout:{name:"Scout's Camp",sub:'choose the act boss',ok:()=>true,open:()=>openScout()},
};
const rollEvents=()=>shuffle(Object.keys(EVENTS).filter(k=>EVENTS[k].ok())).slice(0,2);
function finishBonus(){ run.bonus=null; sel.gem=null; saveRun(); renderCamp(); }
const lockModal=()=>{ $('#modal').dataset.lock='1'; }, unlockModal=()=>{ $('#sheet').onclick=null; delete $('#modal').dataset.lock; closeModal(); };
const slotName=(h,k)=>(((EQUIP[sprId(h)]||{}).l||[])[k])||['Weapon','Body','Head','Off-hand'][k];
// every gem the guild owns, loose or socketed
function ownedGems(){ const items=[]; run.bag.forEach((g,i)=>items.push({g,where:'bag',i,owner:'loose'})); run.heroes.forEach((h,hi)=>(h.gems||[]).forEach((g,k)=>{ if(g) items.push({g,where:'slot',hi,k,owner:HEROES[h.id].name+' · '+slotName(h,k)}); })); return items; }

// Enchanter: turn up to two sockets into the other kind (weapon ⇄ armor). The gear art stays; only the essence effects change.
const ENCHANTS=2;
function openEnchanter(){
  let hi=0; const done=[]; // [{hi,k}] flips made this visit (tap again to undo)
  const draw=()=>{ const h=run.heroes[hi], left=ENCHANTS-done.length;
    const rows=[0,1,2,3].map(k=>{ const kind=slotKind(k,h), g=(h.gems||[])[k], mine=done.some(x=>x.hi===hi&&x.k===k), open=slotOpen(h,k), can=mine||left>0;
      return `<div class="ench ${mine?'sel':''} ${can?'':'off'}" ${can?`data-en="${k}"`:''}><div class="row" style="gap:6px"><b class="small">${esc(slotName(h,k))}</b><span class="gk ${kind}">${kind==='hand'?'weapon':'armor'}${(h.flip||[]).includes(k)?' ✦':''}</span>${open?'':'<span class="tiny muted">locked</span>'}<span class="grow"></span>${g?ic(g,'g',20,GEMS[g].name):''}</div>${g&&GEMS[g].hand?`<div class="tiny muted" style="margin-top:2px">${esc(GEMS[g][kind])}</div>`:''}</div>`; }).join('');
    modal(`<h2>Enchanter</h2><div class="muted small">Turn a socket into the other kind: weapon sockets power attacks, armor sockets protect and punish attackers. Locked sockets can be enchanted too. <b class="gold">${left} enchantment${left===1?'':'s'} left.</b></div>
     <div class="heronav">${run.heroes.map((x,i)=>`<button class="hn ${i===hi?'on':''}" data-eh="${i}">${hspr(x,32)}</button>`).join('')}</div>
     <div class="stack">${rows}</div>
     <div class="row"><button class="grow ${done.length?'gold':'ghost'}" data-ex="${done.length?'done':'cancel'}">${done.length?'Done':'Not now'}</button></div>`); lockModal(); };
  draw();
  $('#sheet').onclick=e=>{ const n=e.target.closest('[data-eh]'); if(n){ hi=+n.dataset.eh; return draw(); }
    const c=e.target.closest('[data-en]'); if(c){ const k=+c.dataset.en, h=run.heroes[hi]; const fl=(h.flip||[]).includes(k)?h.flip.filter(x=>x!==k):(h.flip||[]).concat(k);
      if(computeStats(Object.assign({},h,{flip:fl}),run.relics).maxHpRaw<1) return toast('That would drop this hero below 1 max HP');
      h.flip=fl; const j=done.findIndex(x=>x.hi===hi&&x.k===k); if(j>=0) done.splice(j,1); else done.push({hi,k}); saveRun(); return draw(); }
    const b=e.target.closest('[data-ex]'); if(!b) return; unlockModal(); if(b.dataset.ex==='done'){ toast('Sockets enchanted'); finishBonus(); } else renderCamp(); };
}

// Gem Cutter: up to two cuts; each turns one gem into another with the same number of essences (basic ⇄ basic, 2-essence ⇄ 2-essence, 3 ⇄ 3)
const CUTS=2;
const cutTargets=g=>{ const d=GEMS[g]; if(d.merged) return []; if(!d.rare) return BASIC_GEMS.filter(x=>x!==g); return RARE_GEMS.filter(x=>x!==g&&!GEMS[x].merged&&GEMS[x].ess.length===d.ess.length); };
function openCutter(){
  let cuts=0, selI=null;
  const draw=()=>{ const items=ownedGems(), left=CUTS-cuts, it=selI!==null?items[selI]:null;
    const tg=it?cutTargets(it.g):[];
    modal(`<h2>Gem Cutter</h2><div class="muted small">Pick a gem, then what it becomes. Basic gems become another basic gem; rare gems become another rare with the same number of essences. Composites cannot be cut. <b class="gold">${left} cut${left===1?'':'s'} left.</b></div>
     <div class="forgepick">${items.map((x,i)=>{ const comp=GEMS[x.g].merged; return `<div class="fg ${selI===i?'sel':''} ${comp?'off':''}" ${comp?'':`data-ci="${i}"`}>${ic(x.g,'g',30,GEMS[x.g].name)}<div class="o">${esc(x.owner)}${comp?'<br><span class="acc">composite</span>':''}</div></div>`; }).join('')}</div>
     ${it?`<div class="card" style="border-color:var(--gold)"><div class="tiny muted">${esc(GEMS[it.g].name)} becomes…</div><div class="forgepick" style="margin-top:4px">${tg.map(t=>`<div class="fg" data-ct="${t}">${ic(t,'g',30,GEMS[t].name)}<div class="o">${esc(GEMS[t].name)}</div></div>`).join('')}</div></div>`:''}
     <div class="row"><button class="grow ${cuts?'gold':'ghost'}" data-cx="${cuts?'done':'cancel'}">${cuts?'Done':'Not now'}</button></div>`); lockModal(); };
  draw();
  $('#sheet').onclick=e=>{ const c=e.target.closest('[data-ci]'); if(c){ selI=selI===+c.dataset.ci?null:+c.dataset.ci; return draw(); }
    const t=e.target.closest('[data-ct]'); if(t&&selI!==null){ const it=ownedGems()[selI], to=t.dataset.ct;
      if(it.where==='slot'){ const h=run.heroes[it.hi], gs=h.gems.slice(); gs[it.k]=to; if(hpAfter(h,gs)<1) return toast('That would drop this hero below 1 max HP'); h.gems[it.k]=to; }
      else run.bag[it.i]=to;
      seen('g',to); cuts++; selI=null; saveRun(); toast(`${GEMS[it.g].name} → ${GEMS[to].name}`);
      if(cuts>=CUTS){ unlockModal(); return finishBonus(); } return draw(); }
    const b=e.target.closest('[data-cx]'); if(!b) return; unlockModal(); if(b.dataset.cx==='done') finishBonus(); else renderCamp(); };
}

// Retirement: one hero leaves the guild; another permanently inherits half of their base HP and ATK. The retiree's gems go to loose gems.
const retireGift=h=>{ const d=HEROES[h.id], m=1+0.15*(h.lv-1); return {hp:Math.round(d.hp*m/2),atk:Math.round(d.atk*m/2)}; };
function openRetire(){
  let a=null, b=null;
  const card=(h,i,on,attr,extra)=>`<div class="ench ${on?'sel':''}" ${attr}="${i}"><div class="row" style="gap:8px">${hspr(h,32)}<div class="grow"><b>${esc(HEROES[h.id].name)}</b> <span class="stars gold">${'★'.repeat(h.lv)}</span><div class="tiny muted">${extra}</div></div></div></div>`;
  const draw=()=>{ const g=a!==null?retireGift(run.heroes[a]):null;
    modal(`<h2>Retirement</h2><div class="muted small">A hero hangs up their gear. Another hero permanently gains half of the retiree's base HP and ATK (higher ★ passes on more). The retiree's gems go to your loose gems.</div>
     <div class="eyebrow">Who retires?</div><div class="stack">${run.heroes.map((h,i)=>{ const x=retireGift(h); return card(h,i,a===i,'data-ra',`passes on +${x.hp} HP · +${x.atk} ATK`); }).join('')}</div>
     ${a!==null?`<div class="eyebrow">Who inherits?</div><div class="stack">${run.heroes.map((h,i)=>i===a?'':card(h,i,b===i,'data-rb',(()=>{ const s0=computeStats(h,run.relics); return `HP ${s0.maxHp} → <span class="good">${s0.maxHp+g.hp}</span> · ATK ${s0.atk} → <span class="good">${s0.atk+g.atk}</span>`; })())).join('')}</div>`:''}
     <div class="row"><button class="grow ghost" data-rx="cancel">Not now</button><button class="grow gold" data-rx="go" ${a!==null&&b!==null?'':'disabled'}>Retire</button></div>`); lockModal(); };
  draw();
  $('#sheet').onclick=e=>{ const ra=e.target.closest('[data-ra]'); if(ra){ a=+ra.dataset.ra; if(b===a) b=null; return draw(); }
    const rb=e.target.closest('[data-rb]'); if(rb){ b=+rb.dataset.rb; return draw(); }
    const x=e.target.closest('[data-rx]'); if(!x) return;
    if(x.dataset.rx==='cancel'){ unlockModal(); return renderCamp(); }
    if(a===null||b===null) return;
    const old=run.heroes[a], heir=run.heroes[b], g=retireGift(old);
    heir.giftHp=(heir.giftHp||0)+g.hp; heir.giftAtk=(heir.giftAtk||0)+g.atk;
    gemsOf(old).forEach(gm=>run.bag.push(gm)); run.heroes.splice(a,1); gemIdx=0;
    unlockModal(); toast(`${HEROES[old.id].name} retires · ${HEROES[heir.id].name} +${g.hp} HP +${g.atk} ATK`); finishBonus(); };
}

// Scout's Camp: choose which boss waits at the end of this act — any boss, rescaled to this act's strength
const ALL_BOSSES=[...new Set(Object.values(BOSSES).flat())];
function bossLine(id,floor){ const d=ENEMIES[id], m=enemyMult(floor,run.depth), nz=bossNorm(floor,id)||{hp:1,atk:1}; return `${d.row} · HP ${Math.round(d.hp*m*ENEMY_HP*nz.hp)} · ATK ${Math.round(d.atk*m*ENEMY_ATK*nz.atk)} · SPD ${d.spd}${d.armor?' · ARM '+d.armor:''}`; }
function openScout(){
  const k=actKey(run.floor), floor=k*4, cur=actBoss();
  const opts=[cur].concat(shuffle(bossPool(floor).filter(x=>x!==cur)).slice(0,2)); let ch=cur;
  const draw=()=>{ modal(`<h2>Scout's Camp</h2><div class="muted small">Your scouts found the lairs ahead. Choose which boss you face on floor ${floor}.</div>
     <div class="stack">${opts.map(id=>{ const d=ENEMIES[id]; return `<div class="ench ${ch===id?'sel':''}" data-sb="${id}"><div class="row" style="gap:8px">${spr(id,36,d.name)}<div class="grow"><b>${esc(d.name)}</b>${id===cur?' <span class="pill">current</span>':''}<div class="tiny muted num">${bossLine(id,floor)}</div></div></div><div class="tiny" style="margin-top:3px">${esc(d.ab||'')}</div></div>`; }).join('')}</div>
     <div class="row"><button class="grow ghost" data-sx="cancel">Not now</button><button class="grow gold" data-sx="go">Choose</button></div>`); lockModal(); };
  draw();
  $('#sheet').onclick=e=>{ const c=e.target.closest('[data-sb]'); if(c){ ch=c.dataset.sb; return draw(); }
    const x=e.target.closest('[data-sx]'); if(!x) return; unlockModal();
    if(x.dataset.sx==='cancel') return renderCamp();
    run.bosses[k]=ch; seen('e',ch); toast(`${ENEMIES[ch].name} awaits on floor ${floor}`); finishBonus(); };
}
function recipeHtml(sk,h,size){
  const have=h?gemCounts(h):{}; const used={};
  return `<span class="rc">${[...sk.need].map(ch=>{ const g=GEM_BY_LETTER[ch]; used[g]=(used[g]||0)+1; const lit=(have[g]||0)>=used[g]; return `<span class="${lit?'lit':''}" style="display:inline-flex">${ic(g,'g',size||18,GEMS[g].name)}</span>`; }).join('')}</span>`;
}
function skillRow(sk,h){
  const on=h?skillActive(h,sk):false; const arch=skillArch(sk);
  let miss=''; if(h&&!on){ const have=gemCounts(h), need=needCounts(sk.need); miss=Object.keys(need).filter(g=>(have[g]||0)<need[g]).map(g=>`+${need[g]-(have[g]||0)} ${GEMS[g].name}`).join(', '); }
  return `<div class="skill ${on?'on':''}" style="--c:${ARCH_C[arch]}">${recipeHtml(sk,h)}<div class="b"><div class="n">${esc(sk.name)}${on?'<span class="pill g">active</span>':''}</div><div class="d">${esc(sk.desc)}</div>${miss?`<div class="miss">needs ${esc(miss)}</div>`:''}</div></div>`;
}
function offerSheet(kind,i){
  const o=kind==='h'?run.shop.heroes[i]:kind==='g'?run.shop.gems[i]:run.shop.relic; if(!o) return;
  const d=kind==='h'?HEROES[o.id]:kind==='g'?GEMS[o.id]:RELICS[o.id]; const cost=kind==='h'?heroCost():d.cost;
  const full=kind==='h'&&run.heroes.length>=partyMax(); const can=!o.sold&&run.gold>=cost&&!full;
  let body='';
  if(kind==='h'){
    body=`<div class="small num">${d.row} row · HP ${d.hp} · ATK ${d.atk} · SPD ${d.spd}${d.armor?' · ARM '+d.armor:''}</div><div class="tiny muted">Root: ${CLASSES[o.id].from.map(f=>CLASSES[f].name).join(' or ')} (decided on hire) · trains into ${upgradesOf(o.id).map(u=>CLASSES[u].name).join(', ')}</div><div class="small">${esc(d.ab(1))}</div><div class="eyebrow" style="margin-top:6px">Skills (unlocked by gems)</div><div class="stack" style="gap:4px">${heroSkills(o.id).map(sk=>skillRow(sk,null)).join('')}</div>`; }
  else if(kind==='g'){
    const uses=[]; run.heroes.forEach(h=>heroSkills(h).forEach(sk=>{ if(!skillActive(h,sk)&&skillActive(withGem(h,o.id),sk)) uses.push(`${HEROES[h.id].name}: <b>${esc(sk.name)}</b>`); }));
    body=`${d.rare?`<div class="row" style="gap:4px;margin-bottom:4px"><span class="pill g">rare</span>${d.ess.map(e=>ic(e,'g',18,GEMS[e].name)).join('')}</div>`:''}<div class="small">${d.rare?rareFx(o.id,null):gemFx(o.id)}</div>${uses.length?`<div class="small good" style="margin-top:4px">Would unlock now · ${uses.join(' · ')}</div>`:`<div class="tiny muted" style="margin-top:4px">No skill in your guild is one ${esc(d.name)} away right now, but it still gives its passive.</div>`}`; }
  else body=`<div class="small">${esc(d.desc)}</div>`;
  modal(`<h2>${ic(o.id,kind,28)}${esc(d.name)}${kind==='r'?' '+tierPill(o.id):kind==='g'?' <span class="tiny muted">gem</span>':''}</h2>${body}
   <div class="row sheetfoot"><button class="grow ghost" data-x="close">Close</button><button class="grow ${can?'gold':''}" data-buy="1" ${can?'':'disabled'}>${o.sold?(kind==='h'?'Hired':'Bought'):full?'Guild full':(kind==='h'?'Hire':'Buy')+' · '+cost+'g'}</button></div>`);
  $('#sheet').onclick=e=>{ if(!e.target.closest('button[data-buy]')) return; $('#sheet').onclick=null; closeModal();
    if(!can) return; spend(cost); o.sold=true;
    if(kind==='h') addHero(o.id); else if(kind==='g'){ run.bag.push(o.id); sel.gem=run.bag.length-1; } else run.relics.push(o.id);
    renderCamp(); };
}
// the route so far, and what training could make of the hero next (lit recipes are met by its gems)
function routeLine(h){ const path=heroPath(h).map(id=>esc(CLASSES[id].name)).join(' → '); const ups=upgradesOf(h.id);
  const next=ups.length?`<div class="tiny muted" style="margin-top:2px">Trains into: ${ups.map(id=>`<span class="row" style="display:inline-flex;gap:3px;margin-right:6px">${recipeHtml({need:CLASSES[id].need},h,14)}${esc(CLASSES[id].name)}</span>`).join('')}</div>`:'<div class="tiny muted" style="margin-top:2px">A capstone: trains no further.</div>';
  return `<div class="tiny muted">${path}</div>${next}`; }
// several upgrades fit: the player chooses, and the choice is permanent
function promoModal(){ const p=run.promo; if(!p) return; const h=run.heroes[p.hi];
  modal(`<h2>${esc(HEROES[h.id].name)} is ready to advance</h2><div class="muted small">Choose a class. The choice is permanent, and ${esc(HEROES[h.id].name)}'s skills come along.</div>
   <div class="choice">${p.opts.map(id=>{ const c=CLASSES[id]; return `<button data-promo="${id}"><span class="row">${ic(id,'h',24)} ${esc(c.name)} <span class="tiny muted">${c.role} · ${c.ess.map(e=>GEMS[e].name).join(' + ')}</span></span><span class="d">${esc(c.passive)}</span></button>`; }).join('')}</div>`); lockModal();
  $('#sheet').onclick=e=>{ const b=e.target.closest('button[data-promo]'); if(!b) return; $('#sheet').onclick=null; const was=HEROES[h.id].name; promote(h,b.dataset.promo); delete run.promo; unlockModal(); closeModal(); toast(`${was} becomes ${HEROES[h.id].name}`); saveRun(); renderGems(p.hi); }; }
function heroSheet(i){
  const h=run.heroes[i], d=HEROES[h.id], s=computeStats(h,run.relics), lc=lvCost(h);
  const other=h.row==='front'?'back':'front'; const otherFull=run.heroes.filter(x=>x.row===other).length>=ROW_MAX;
  modal(`<h2>${hspr(h,32,d.name)}${esc(d.name)} <span class="stars gold small">${'★'.repeat(h.lv)}</span></h2>
   <div class="small muted">${esc(d.ab(h.lv))}</div>
   ${routeLine(h)}
   <div class="small num">HP ${s.maxHp} · ATK ${s.atk} · SPD ${s.spd} · ARM ${s.armor}${s.crit?' · CRIT '+Math.round(s.crit*100)+'%':''}${s.dodge?' · DODGE '+Math.round(s.dodge*100)+'%':''} · kills ${h.kills||0}${h.bonusHp?` · <span class="good">+${h.bonusHp} HP from kills</span>`:''}${h.giftHp?` · <span class="good">inherited +${h.giftHp} HP +${h.giftAtk} ATK</span>`:''}</div>
   <div class="row" style="gap:4px">${openSet(h).map(k=>{ const g=(h.gems||[])[k]; return g?ic(g,'g',22,GEMS[g].name):'<span class="ph" style="display:inline-block;width:22px;height:22px;border:1px dashed var(--line2);border-radius:24%"></span>'; }).join('')}<span class="tiny muted" style="margin-left:6px">${s.skills.length?s.skills.map(x=>esc(x.name)).join(', '):'no skills yet'}</span></div>
   <div class="actions">
     <button data-hs="gems" class="gold"><span>Equip${lc?` <span class="tiny">· unlock a slot ${lc}g</span>`:''}</span><span>${gemCount(h)}/${SLOTS(h.lv)} slots</span></button>
     <button data-hs="row" ${otherFull?'disabled':''}><span>Move to ${other} row${otherFull?' (full)':''}</span><span class="muted">free</span></button>
     <button data-hs="sell" ${run.heroes.length<=1?'disabled':''}><span>Dismiss</span><span class="gold">+${2+2*(h.lv-1)}g${gemCount(h)?' · gems kept':''}</span></button>
     <button data-x="close" class="ghost"><span>Close</span></button>
   </div>`);
  $('#sheet').onclick=e=>{ const b=e.target.closest('button[data-hs]'); if(!b) return; const a=b.dataset.hs;
    $('#sheet').onclick=null; closeModal();
    if(a==='gems') return renderGems(i);
    if(a==='row'){ h.row=other; }
    if(a==='sell'){ run.gold+=2+2*(h.lv-1); run.bag.push(...gemsOf(h)); run.heroes.splice(i,1); }
    renderCamp(); };
}

function gemSheet(id,where,k){
  const d=GEMS[id], h=where==='camp'?null:run.heroes[gemIdx];
  const unlocks=!h?[]:heroSkills(h).filter(sk=>!skillActive(h,sk)&&skillActive(withGem(h,id),sk)).map(sk=>sk.name);
  const loses=where==='slot'?heroSkills(h).filter(sk=>skillActive(h,sk)&&!skillActive(Object.assign({},h,{gems:h.gems.map((g,i)=>i===k?null:g)}),sk)).map(sk=>sk.name):[];
  modal(`<h2>${ic(id,'g',30)}${esc(d.name)} ${d.merged?'<span class="pill g">composite</span>':d.rare?'<span class="pill g">rare</span>':'<span class="tiny muted">gem</span>'}</h2>
   <div class="row" style="gap:4px;flex-wrap:wrap"><span class="tiny muted">Essence${d.ess.length>1?'s':''}:</span>${d.ess.map(e=>`<span class="pill" style="color:${ARCH_C[GEMS[e].arch]};border-color:${ARCH_C[GEMS[e].arch]}">${ic(e,'g',12)} ${GEMS[e].name}</span>`).join('')}</div>
   <div class="small">${d.merged?`<div class="tiny muted">Composite gem · counts as every essence above for recipes · cannot be fused again. Parts:</div>${gemLeaves(id).map(l=>`<div class="row" style="gap:6px;margin-top:4px;align-items:flex-start">${ic(l,'g',18,GEMS[l].name)}<div><b>${esc(GEMS[l].name)}</b> ${GEMS[l].rare?rareFx(l,where==='slot'?slotKind(k,h):null):gemFx(l,where==='slot'?slotKind(k,h):null)}</div></div>`).join('')}`:d.rare?rareFx(id,where==='slot'?slotKind(k,h):null):gemFx(id,where==='slot'?slotKind(k,h):null)}</div>
   ${where==='camp'?`<div class="tiny muted">Would unlock: ${run.heroes.map(hh=>{ const u=heroSkills(hh).filter(sk=>!skillActive(hh,sk)&&skillActive(withGem(hh,id),sk)).map(sk=>sk.name); return u.length?esc(HEROES[hh.id].name)+' → '+u.map(esc).join(', '):null; }).filter(Boolean).join(' · ')||'nothing new right now'}</div>`:where==='bag'?(unlocks.length?`<div class="small good">Slotting it on ${esc(HEROES[h.id].name)} unlocks: ${unlocks.map(esc).join(', ')}</div>`:`<div class="tiny muted">Unlocks no new skill on ${esc(HEROES[h.id].name)} right now.</div>`):(loses.length?`<div class="small acc">Removing it deactivates: ${loses.map(esc).join(', ')}</div>`:'')}
   <div class="row"><button class="grow ghost" data-x="close">Close</button>${where==='camp'?'':where==='bag'?`<button class="grow gold" data-gs="slot" ${freeSlots(h)>0?'':'disabled'}>${freeSlots(h)>0?'Slot it':'No free slot'}</button>`:`<button class="grow" data-gs="unslot">Return to loose gems</button>`}</div>`);
  $('#sheet').onclick=e=>{ const b=e.target.closest('button[data-gs]'); if(!b) return; $('#sheet').onclick=null; closeModal();
    if(b.dataset.gs==='slot'){ const o=openSlots(h); if(o.length>1){ gemPick=k; return renderGems(gemIdx,true); } if(tryPut(h,o[0],run.bag[k])) run.bag.splice(k,1); } else { const g=tryTake(h,k); if(g) run.bag.push(g); } gemPick=null;
    renderGems(gemIdx); };
}
// long press (≈450 ms) on any gem opens its info sheet; a normal tap keeps its quick action
const longPress={timer:null,fired:false};
function bindLongPress(root,resolve){
  const clear=()=>{ if(longPress.timer){ clearTimeout(longPress.timer); longPress.timer=null; } };
  root.addEventListener('touchstart',e=>{ const el=e.target.closest('[data-slot],[data-bag]'); if(el){ e.preventDefault(); longPress.touchEl=el; } },{passive:false});
  root.addEventListener('touchend',e=>{ const el=longPress.touchEl; longPress.touchEl=null; if(!el) return; e.preventDefault(); clear(); if(longPress.fired){ longPress.fired=false; return; } el.click(); });
  root.addEventListener('pointerdown',e=>{ const el=e.target.closest('[data-slot],[data-bag]'); if(!el) return; const info=resolve(el.dataset); if(!info) return; clear(); longPress.fired=false;
    longPress.timer=setTimeout(()=>{ longPress.timer=null; longPress.fired=true; if(navigator.vibrate) navigator.vibrate(15); gemSheet(info.id,info.where,info.k); },450); });
  ['pointerup','pointercancel','pointerleave'].forEach(ev=>root.addEventListener(ev,clear));
  root.addEventListener('pointermove',e=>{ if(longPress.timer&&(Math.abs(e.movementX)>3||Math.abs(e.movementY)>3)) clear(); });
  root.addEventListener('contextmenu',e=>{ if(e.target.closest('[data-slot],[data-bag]')) e.preventDefault(); });
  root.addEventListener('selectstart',e=>{ if(longPress.timer||longPress.fired) e.preventDefault(); });
}
bindLongPress($('#s-gems'),ds=>{ const h=run&&run.heroes[gemIdx]; if(!h) return null; if(ds.slot!==undefined){ const k=+ds.slot; return h.gems[k]?{id:h.gems[k],where:'slot',k}:null; } if(ds.bag!==undefined) return {id:run.bag[+ds.bag],where:'bag',k:+ds.bag}; return null; });
bindLongPress($('#s-camp'),ds=>{ if(!run||ds.bag===undefined) return null; return {id:run.bag[+ds.bag],where:'camp',k:+ds.bag}; });
