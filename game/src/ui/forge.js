// ---------- the Forge: merge two owned gems (loose or slotted) into one ----------
function openForge(){
  const items=[]; run.bag.forEach((g,i)=>items.push({g,where:'bag',i,owner:'loose'}));
  run.heroes.forEach((h,hi)=>(h.gems||[]).forEach((g,k)=>{ if(g) items.push({g,where:'slot',hi,k,owner:HEROES[h.id].name+' · '+(((EQUIP[sprId(h)]||{}).l||[])[k]||['Weapon','Body','Head','Off-hand'][k])}); }));
  const fusable=items.filter(it=>!GEMS[it.g].merged); // composites cannot be fused again
  if(fusable.length<2) return toast('You need two gems that are not already composites');
  let chosen=[];
  const draw=()=>{ const a=chosen[0]!==undefined?items[chosen[0]]:null, b=chosen[1]!==undefined?items[chosen[1]]:null;
    let preview='';
    if(a&&b){ const leaves=[a.g,b.g].flatMap(gemLeaves); const ess=[a.g,b.g].flatMap(gemEss);
      preview=`<div class="card" style="border-color:var(--gold)"><div class="row" style="gap:6px"><span class="tiny muted">Result</span>${ess.map(e=>ic(e,'g',16,GEMS[e].name)).join('')}</div><div class="small" style="margin-top:4px"><b>${esc(leaves.map(l=>GEMS[l].name).join(' · '))}</b> — counts as ${esc(ess.map(e=>GEMS[e].name).join(' + '))} for recipes; keeps every part's effect (basic parts still depend on the socket, rare parts keep their bonus or drawback).</div></div>`; }
    modal(`<h2>Gem Forge</h2><div class="muted small">Pick two gems to fuse into one composite gem. The composite takes one socket and does everything both did. Composite gems cannot be fused with any gem. ${chosen.length<2?`<b class="gold">${2-chosen.length} more to pick.</b>`:''}</div>
     <div class="forgepick">${items.map((it,i)=>{ const comp=GEMS[it.g].merged; return `<div class="fg ${chosen.includes(i)?'sel':''} ${comp?'off':''}" ${comp?'':`data-fg="${i}"`} title="${comp?'Composite — cannot be fused':''}">${ic(it.g,'g',30,GEMS[it.g].name)}<div class="o">${esc(it.owner)}${comp?'<br><span class="acc">composite</span>':''}</div></div>`; }).join('')}</div>
     ${preview}
     <div class="row"><button class="grow ghost" data-fz="cancel">Not now</button><button class="grow gold" data-fz="merge" ${chosen.length===2?'':'disabled'}>Forge</button></div>`);
    $('#modal').dataset.lock='1'; };
  draw();
  $('#sheet').onclick=e=>{ const f=e.target.closest('[data-fg]'); if(f){ const i=+f.dataset.fg; if(chosen.includes(i)) chosen=chosen.filter(x=>x!==i); else if(chosen.length<2) chosen.push(i); return draw(); }
    const b=e.target.closest('button[data-fz]'); if(!b) return;
    if(b.dataset.fz==='cancel'){ $('#sheet').onclick=null; delete $('#modal').dataset.lock; closeModal(); return; }
    if(chosen.length!==2) return;
    const [A,B]=chosen.map(i=>items[i]);
    // a hero must keep at least 1 max HP after its gems are pulled out; check the two sources
    const id='m'+(++run.mergeN), parts=[A.g,B.g]; defineMergedGem(id,parts); run.merged.push({id,parts});
    const take=it=>{ if(it.where==='bag') return; run.heroes[it.hi].gems[it.k]=null; };
    // remove bag items by index descending so indices stay valid
    [A,B].filter(it=>it.where==='bag').map(it=>it.i).sort((x,y)=>y-x).forEach(i=>run.bag.splice(i,1));
    take(A); take(B); run.heroes.forEach(h=>{ while(h.gems.length&&!h.gems[h.gems.length-1]) h.gems.pop(); });
    // put the result back into a socket one of the parts came from (if the hero can hold it); else it goes loose
    let placed=false; for(const it of [A,B]){ if(placed||it.where!=='slot') continue; const h=run.heroes[it.hi]; const gs=(h.gems||[]).slice(); while(gs.length<=it.k) gs.push(null); gs[it.k]=id; if(hpAfter(h,gs)>=1){ putGem(h,it.k,id); placed=true; } }
    if(!placed) run.bag.push(id);
    run.mergeAct=curAct(run.floor);
    $('#sheet').onclick=null; delete $('#modal').dataset.lock; closeModal();
    toast(`Composite: ${GEMS[id].name}${placed?'':' · in loose gems'}`);
    finishBonus(); };
}
