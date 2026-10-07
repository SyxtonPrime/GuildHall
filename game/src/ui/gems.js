// ---------- gem screen (one hero at a time) ----------
let gemIdx=0, gemPick=null; // gemPick: bag index of a loose gem waiting for the player to choose its slot
function renderGems(i,keepPick){
  gemIdx=i; sel.gem=null; if(!keepPick) gemPick=null;
  const h=run.heroes[i], d=HEROES[h.id], lc=lvCost(h);
  const slots=[]; for(let k=0;k<4;k++){
    const lab=`<div class="sl">${esc((EQUIP[h.id]&&EQUIP[h.id].l[k])||['Weapon','Body','Head','Off-hand'][k])}<br><span class="gk ${slotKind(k,h)}">${slotKind(k,h)==='hand'?'weapon':'armor'}${(h.flip||[]).includes(k)?' ✦':''}</span></div>`;
    if(!slotOpen(h,k)){ slots.push(`<div class="slotw"><button class="slot locked unlock" data-unlock="${k}" ${lc&&run.gold>=lc?'':'disabled'}><span class="lk">Unlock<br><b class="gold">${lc}g</b></span></button>${lab}</div>`); continue; }
    if(h.gems[k]) slots.push(`<div class="slotw"><div class="slot filled" data-slot="${k}">${ic(h.gems[k],'g',30,GEMS[h.gems[k]].name)}</div>${lab}</div>`);
    else slots.push(`<div class="slotw"><div class="slot open ${gemPick!==null?'target':''}" data-slot="${k}"><span class="lk">${gemPick!==null?'put here':'open'}</span></div>${lab}</div>`); }
  const skills=heroSkills(h.id);
  const nx=lc?computeStats(Object.assign({},h,{lv:h.lv+1}),run.relics):null, cur=computeStats(h,run.relics);
  $('#s-gems').innerHTML=`
   <div class="topbar"><button class="sm" data-g="back">‹ Camp</button><div class="grow"><span class="stat gold">◆ ${run.gold}</span></div><div class="heronav">${run.heroes.map((hh,k)=>`<button class="hn ${k===i?'on':''}" data-g="hero" data-k="${k}" title="${esc(HEROES[hh.id].name)}">${hspr(hh,32,HEROES[hh.id].name)}</button>`).join('')}</div></div>
   <div class="card">
     <div class="row between"><h2 class="row" style="font-size:18px">${hspr(h,48,d.name)}${esc(d.name)} <span class="stars gold small">${'★'.repeat(h.lv)}${'☆'.repeat(3-h.lv)}</span></h2></div>
     <div class="small muted" style="margin:2px 0 6px">${esc(d.ab(h.lv))}</div>
     ${statLine(h,null)}
   </div>
   <div><div class="eyebrow">${gemPick!==null?`<span class="good">Choose a slot for ${esc(GEMS[run.bag[gemPick]].name)}</span> · tap the gem again to cancel`:'Slots · tap to return · hold for details'}</div><div class="slots" style="margin-top:4px">${slots.join('')}</div>${lc?`<div class="tiny muted" style="margin-top:4px">Unlocking a slot raises ${esc(d.name)} to ${'★'.repeat(h.lv+1)}: HP ${cur.maxHp}→<span class="good">${nx.maxHp}</span> · ATK ${cur.atk}→<span class="good">${nx.atk}</span> · stronger ability.</div>`:''}</div>
   <div><div class="eyebrow">Loose gems · tap to slot · hold for details${run.bag.length?'':' · none'}</div><div class="bag" style="margin-top:4px">${run.bag.map((id,k)=>`<div class="bagitem ${gemPick===k?'sel':''}" data-bag="${k}">${ic(id,'g',28,GEMS[id].name)}</div>`).join('')}</div></div>
   <div><div class="eyebrow">Skills · ${gemCount(h)?computeStats(h,run.relics).skills.length:0}/${skills.length} active</div><div class="stack" style="gap:5px;margin-top:4px">${skills.map(sk=>skillRow(sk,h)).join('')}</div></div>
   <details class="card small"><summary class="muted">What each gem does on its own</summary><div class="gemlegend" style="margin-top:6px">${BASIC_GEMS.map(g=>`<div>${ic(g,'g',18)}<span><b style="color:${ARCH_C[GEMS[g].arch]}">${GEMS[g].name}</b>${gemFx(g)}</span></div>`).join('')}</div></details>
   <div class="fightbar"><button data-g="back">Back to camp</button></div>`;
  show('s-gems'); saveRun();
}
$('#s-gems').addEventListener('click',e=>{
  const el=e.target.closest('[data-g],[data-slot],[data-bag],[data-unlock]'); if(!el||!run) return; const ds=el.dataset; const h=run.heroes[gemIdx];
  if(ds.g==='back') return renderCamp();
  if(ds.g==='hero') return renderGems(+ds.k);
  if(ds.unlock!==undefined){ const k=+ds.unlock, lab=(EQUIP[h.id]&&EQUIP[h.id].l[k])||['Weapon','Body','Head','Off-hand'][k]; if(!unlockSlot(h,k)) return toast(`Need ${lvCost(h)}g to unlock`); toast(`${lab} slot unlocked · ${HEROES[h.id].name} is now ${'★'.repeat(h.lv)}`); return renderGems(gemIdx,gemPick!==null); }
  if(longPress.fired){ longPress.fired=false; return; }
  if(ds.slot!==undefined){ const k=+ds.slot;
    if(h.gems[k]){ const g=tryTake(h,k); if(g) run.bag.push(g); return renderGems(gemIdx,gemPick!==null); } // other gems stay in their slots
    if(gemPick!==null){ if(tryPut(h,k,run.bag[gemPick])) run.bag.splice(gemPick,1); gemPick=null; return renderGems(gemIdx); }
    return toast('Tap a loose gem below to slot it'); }
  if(ds.bag!==undefined){ const b=+ds.bag, o=openSlots(h);
    if(gemPick===b){ gemPick=null; return renderGems(gemIdx); } // tap again to cancel
    if(!o.length) return toast('No free slot · tap a slotted gem to take it out first');
    if(o.length===1){ if(tryPut(h,o[0],run.bag[b])) run.bag.splice(b,1); gemPick=null; return renderGems(gemIdx); }
    gemPick=b; return renderGems(gemIdx,true); } // several free slots: highlight them and let the player choose
});

