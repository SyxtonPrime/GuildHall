// ---------- battle ----------
function startBattle(){
  sel.gem=null; closeModal();
  const enc=run.enc; enc.list.forEach(e=>seen('e',e.id));
  const tr=run.trial&&run.trial.debuff; battle=createBattle(run.heroes,enc,tr==='norelic'?[]:run.relics,run.gold,{spent:run.spent||0,trial:tr,trophies:run.elitesWon||0}); // a Proving Grounds trial handicaps this fight
  const flash=(el,cls,ms)=>{ el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(()=>el.classList.remove(cls),ms); };
  battle.fx=(u,txt,cls)=>{ if(speed>=99) return; const el=document.getElementById('u'+u.uid); if(!el) return;
    const go=()=>{ const s=document.createElement('span'); s.className='fx '+cls; s.textContent=txt; s.style.left=(35+Math.random()*30)+'%'; el.appendChild(s); setTimeout(()=>s.remove(),900); if(cls==='heal') flash(el,'healed',350); if(cls==='shield'&&txt[0]==='+') flash(el,'shielded',350); };
    if(cls==='attack'||cls==='crit') setTimeout(go,150); else go(); };
  // attack animation: attacker lunges, a streak flies to the target, target shakes on impact
  battle.anim=(src,t,info)=>{ if(speed>=99) return; const a=document.getElementById('u'+src.uid), b=document.getElementById('u'+t.uid), ar=$('#s-battle .arena'); if(!a||!b||!ar) return;
    flash(a,'atk',220);
    const sa=a.querySelector('.spr')||a, sb=b.querySelector('.spr')||b, R=ar.getBoundingClientRect(), ra=sa.getBoundingClientRect(), rb=sb.getBoundingClientRect();
    const x1=ra.left+ra.width/2-R.left, y1=ra.top+ra.height/2-R.top, x2=rb.left+rb.width/2-R.left, y2=rb.top+rb.height/2-R.top, dx=x2-x1, dy=y2-y1;
    const p=document.createElement('div'); p.className='proj'+(src.side==='e'?' foe':'')+(info.crit?' crit':''); p.style.left=x1+'px'; p.style.top=y1+'px'; p.style.setProperty('--rot',(Math.atan2(dy,dx)*180/Math.PI)+'deg'); p.style.setProperty('--len',(Math.hypot(dx,dy)-14)+'px'); ar.appendChild(p); setTimeout(()=>p.remove(),200);
    setTimeout(()=>{ if(info.type==='miss') flash(b,'dodged',260); else flash(b,'struck',280); },150); };
  battle.spawn=(u)=>rerender('e',null);
  // a fallen summon fades for a moment, then its card is removed and the rest of the row slides together
  battle.vanish=(u)=>{ const el=document.getElementById('u'+u.uid); if(el) el.classList.add('vanishing'); setTimeout(()=>{ if(battle&&battle.units.includes(u)) rerender(u.side,null); },speed>=99?0:450); };
  // row change: re-render the hero side, then slide every card from its old position to its new one (the mover glows)
  battle.move=(u)=>rerender('p',u);
  function rerender(side,u){ const ps=$(side==='p'?'#pside':'#eside'); if(!ps) return;
    const before={}; battle.units.forEach(x=>{ if(x.side!==side) return; const el=document.getElementById('u'+x.uid); if(el) before[x.uid]=el.getBoundingClientRect(); });
    ps.innerHTML=side==='p'?rowHtml('p','front')+rowHtml('p','back'):rowHtml('e','back')+rowHtml('e','front'); renderUnits(); fitNames(ps);
    if(speed>=99||matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    battle.units.forEach(x=>{ if(x.side!==side) return; const el=document.getElementById('u'+x.uid), r0=before[x.uid]; if(!el||!r0) return;
      const r1=el.getBoundingClientRect(), dx=r0.left-r1.left, dy=r0.top-r1.top; if(Math.abs(dx)<1&&Math.abs(dy)<1) return;
      el.style.transition='none'; el.style.transform=`translate(${dx}px,${dy}px)`; if(x===u) el.classList.add('moving');
      requestAnimationFrame(()=>requestAnimationFrame(()=>{ el.style.transition='transform .5s cubic-bezier(.2,.8,.2,1),box-shadow .25s,border-color .25s'; el.style.transform=''; setTimeout(()=>{ el.style.transition=''; el.classList.remove('moving'); },600); })); });
  };
  if(speed>=99) speed=[0.5,1,2,3].includes(meta.speed)?meta.speed:1;
  // names that still overflow their card (long single words) step down in size until they fit
  const fitNames=root=>{ (root||$('#s-battle')).querySelectorAll('.unit .nm').forEach(el=>{ const sp=el.firstElementChild; if(!sp) return; el.style.fontSize=''; let fs=parseFloat(getComputedStyle(el).fontSize), guard=8; const over=()=>[...sp.getClientRects()].some(r=>r.width>el.clientWidth+0.5); while(guard-->0&&over()&&fs>6.5){ fs-=0.5; el.style.fontSize=fs+'px'; } }); };
  const unitHtml=u=>`<div class="unit ${u.side==='e'?'enemy':''} ${u.summon?'summon':''}" id="u${u.uid}"><div class="art">${u.hero?hspr(u.hero,32,u.name):spr(u.eid,36,u.name)}${u.hero?`<span class="lv" title="${u.L} star${u.L>1?'s':''}">${'<span>★</span>'.repeat(u.L)}</span>`:''}</div><div class="nm ${u.name.split(' ').some(w=>w.length>10)?'long':''}" title="${esc(u.name)}"><span>${esc(u.name)}</span></div><div class="hpbar"><div class="f"></div><div class="sh"></div><div class="tx"></div></div><div class="ln"><span class="a"></span><span class="s"></span></div><div class="stt"></div></div>`;
  // a row shows its living units plus fallen ones while there is room (movement and summons can crowd a row)
  const rowHtml=(side,row)=>{ let us=battle.units.filter(u=>u.side===side&&u.row===row&&(u.alive||!u.summon)); let room=ROW_MAX-us.filter(u=>u.alive).length; us=us.filter(u=>u.alive||room-->0); return `<div class="grid4">${us.length?us.map(unitHtml).join(''):GHOST}</div>`; };
  // an empty row keeps its full height so summons or movement never shift the rest of the arena
  const GHOST=`<div class="unit ghost"><div class="art"></div><div class="nm"><span>&nbsp;</span></div><div class="hpbar"></div><div class="ln"><span>&nbsp;</span></div><div class="stt"></div></div>`;
  $('#s-battle').innerHTML=`
   <div class="topbar"><div class="grow"><div class="eyebrow">${enc.prologue?'Prologue':`Floor ${run.floor}${run.floor>FLOORS?' · <span class="gold">Endless</span>':''} · ${{fight:'Fight',elite:'Elite',boss:'Boss'}[enc.kind]}`}</div><div class="row" style="gap:12px"><span class="stat gold">◆ ${run.gold}</span><span class="num small muted" id="btime">0.0s</span></div></div><div class="spd row" style="gap:4px">${[0.5,1,2,3].map(m=>`<button data-s="${m}" class="${speed===m?'on':''}">${m}×</button>`).join('')}<button data-s="99">Skip</button></div></div>
   <div class="arena">
     <div class="side" id="eside">${rowHtml('e','back')}${rowHtml('e','front')}</div>
     <div class="mid"><div class="rift" style="margin:0;width:100%"></div></div>
     <div class="side" id="pside">${rowHtml('p','front')}${rowHtml('p','back')}</div>
   </div>`;
  show('s-battle'); renderUnits(); fitNames();
  if(loop) clearInterval(loop);
  // playback: speed is the real-time multiplier (one 50 ms sim step per 50 ms tick at 1×); 99 = skip
  let acc=0;
  loop=setInterval(()=>{ acc+=speed; while(acc>=1&&!battle.over){ acc-=1; stepBattle(battle,0.05); } renderUnits(); if(battle.over){ clearInterval(loop); loop=null; setTimeout(endBattle,700); } },50);
}
$('#s-battle').addEventListener('click',e=>{ const b=e.target.closest('button[data-s]'); if(!b||!battle) return; const s=+b.dataset.s;
  if(s===99){ if(loop){clearInterval(loop);loop=null;} runToEnd(battle); renderUnits(); endBattle(); return; }
  speed=s; meta.speed=s; save(KEY_META,meta); b.parentElement.querySelectorAll('button').forEach(x=>x.classList.toggle('on',+x.dataset.s===s)); });
function renderUnits(){
  if(!battle) return;
  $('#btime').textContent=battle.t.toFixed(1)+'s'+(battle.t>45?' · time running out':'');
  battle.units.forEach(u=>{ const el=document.getElementById('u'+u.uid); if(!el) return; el.classList.toggle('dead',!u.alive); el.classList.toggle('veiled',u.alive&&u.veilUntil>battle.t);
    const p=clamp(u.hp/u.maxHp,0,1), sp=clamp(u.shield/u.maxHp,0,1);
    el.querySelector('.f').style.width=(p*100)+'%'; el.querySelector('.sh').style.width=(sp*100)+'%'; el.querySelector('.tx').textContent=`${Math.max(0,Math.ceil(u.hp))}${u.maxHp!==u.maxHp0?'/'+u.maxHp:''}${u.shield?' +'+u.shield:''}`;
    el.querySelector('.a').textContent='ATK '+u.atk; el.querySelector('.s').textContent='SPD '+(Math.round(effSpd(u)*100)/100);
    const st=[]; if(u.st.poison>0) st.push(`<span class="stx p" title="Poison ${u.st.poison}">${u.st.poison}</span>`); if(u.st.burn>0) st.push(`<span class="stx b" title="Burn ${u.st.burn}">${u.st.burn}</span>`); if(u.st.chill>0) st.push(`<span class="stx c${isFrozen(u)?' aff':''}" title="Chill ${u.st.chill}${isFrozen(u)?' (Frozen)':''}">${u.st.chill}</span>`);
    if(u.ablaze) st[st.findIndex(x=>x.includes('stx b'))]=`<span class="stx b aff" title="Burn ${u.st.burn} (Ablaze)">${u.st.burn}</span>`; if(isFestering(u)) st[st.findIndex(x=>x.includes('stx p'))]=`<span class="stx p aff" title="Poison ${u.st.poison} (Festering)">${u.st.poison}</span>`;
    for(const k in u.kw) st.push(`<span class="stx k" title="${k[0].toUpperCase()+k.slice(1)}">${k[0].toUpperCase()}</span>`);
    const sh=st.join(''); if(el.querySelector('.stt').innerHTML!==sh) el.querySelector('.stt').innerHTML=sh; });
}
function endBattle(){
  if(!battle||battle._ended) return; battle._ended=true;
  const win=battle.winner==='p', enc=run.enc;
  const heroUnits=battle.units.filter(u=>u.hero); const enemyLeft=battle.units.filter(u=>u.side==='e'&&u.alive).length;
  heroUnits.forEach(u=>{ u.hero.kills=(u.hero.kills||0)+u.stats.kills; run.kills+=u.stats.kills; meta.kills+=u.stats.kills; });
  run.fights++;
  const killsBy={}; heroUnits.forEach(u=>{ killsBy[run.heroes.indexOf(u.hero)]=u.stats.kills; });
  const g=goldReward(enc,win,killsBy); g.bounty=battle.bounty||0; g.total=Math.max(0,g.total+g.bounty); if(win) run.gold+=g.total;
  if(run.wager){ g.wager=win&&heroUnits.every(u=>u.alive)?run.wager*2:-run.wager; if(g.wager>0) run.gold+=g.wager; run.wager=null; } // Gambler's Den: paid when staked, doubled back if no hero fell
  const trial=run.trial; run.trial=null;
  if(win&&enc.kind==='elite') run.elitesWon=(run.elitesWon||0)+1; // Trophy Rack
  if(!enc.prologue) meta.bestFloor=Math.max(meta.bestFloor,run.floor);
  const unlocks=[];
  const tryUnlock=()=>{}; // milestone heroes are gone: every class is reached by training
  const victory=win&&run.floor===FLOORS; const dead=!win;
  if(victory){ run.cleared=true; meta.wins++; meta.maxDepth=Math.max(meta.maxDepth,run.depth+1); }
  if(run.floor>FLOORS) meta.bestEndless=Math.max(meta.bestEndless||0,run.floor);
  { const ds=depthStats(run.depth);
    if(run.floor>FLOORS) ds.bestEndless=Math.max(ds.bestEndless,run.floor);
    if(victory){ ds.streak++; ds.bestStreak=Math.max(ds.bestStreak,ds.streak); }
    else if(dead&&!run.cleared) ds.streak=0; }
  save(KEY_META,meta);
  const rows=heroUnits.slice().sort((a,b)=>b.stats.dealt-a.stats.dealt).map(u=>`<tr><td><span class="row" style="gap:5px">${ic(u.hero.id,'h',18)}${esc(u.name)}</span>${!u.alive?' <span class="tiny acc">fell</span>':''}</td><td>${u.stats.dealt}</td><td>${u.stats.taken}</td><td>${u.stats.healed}</td><td>${u.stats.kills}</td></tr>`).join('');
  const mvp=heroUnits.reduce((m,u)=>u.stats.dealt>m.stats.dealt?u:m,heroUnits[0]);
  modal(`<h2 class="${win?'good':'acc'}">${victory?'Dungeon cleared':win?'Victory':'Defeat'}</h2>
   <div class="small muted">${battle.t.toFixed(1)}s · MVP ${esc(mvp.name)}${dead?` · <span class="acc">${battle.t>=battle.tLimit?'Time ran out.':'Your guild is broken.'}</span> ${enemyLeft} enem${enemyLeft===1?'y':'ies'} left standing.`:''}</div>
   <table class="rep"><tr><th>Hero</th><th>Dealt</th><th>Taken</th><th>Healed</th><th>Kills</th></tr>${rows}</table>
   ${win?`<div class="small"><span class="gold">+${g.total} gold</span> <span class="muted">(win ${g.base}${g.interest?' · interest '+g.interest:''}${g.gems?' · Gilt '+g.gems:''}${g.skills?' · skills '+g.skills:''}${g.purse?' · Deep Purse '+g.purse:''}${g.bounty>0?' · loot '+g.bounty:g.bounty<0?' · stolen '+g.bounty:''})</span>${g.wager>0?` <span class="gold">· wager +${g.wager}</span>`:g.wager<0?' <span class="acc">· wager lost</span>':''}</div>`:''}
   ${unlocks.map(n=>`<div class="pill g">Unlocked hero: ${esc(n)}</div>`).join('')}
   <details class="small muted"><summary>Battle log</summary><div style="max-height:200px;overflow:auto;font-size:11px;margin-top:6px">${battle.log.map(esc).join('<br>')}</div></details>
   <button class="primary" data-next="1">${dead?'See run summary':victory?'Claim your victory':'Continue'}</button>`);
  $('#modal').dataset.lock='1';
  $('#sheet').onclick=e=>{ if(!e.target.closest('button[data-next]')) return; $('#sheet').onclick=null; delete $('#modal').dataset.lock; closeModal();
    if(dead) return runOver(false);
    if(enc.prologue){ run.prologue=false; offerPaths(); rollShop(false); return renderCamp(); } // the prologue isn't a floor: floor 1 comes next
    const after=()=>{ run.floor++; if(run.floor%4===3) run.bonus={opts:rollEvents()}; if(run.bonus&&!run.bonus.opts.length) run.bonus=null; offerPaths(); rollShop(false); renderCamp(); };
    if(victory){ const goOn=()=>{ run.endless=true; toast('Endless: enemies keep growing until you fall'); after(); }; return endlessPrompt(goOn,()=>runOver(true),enc); }
    const queue=[]; if(win&&trial) queue.push('trial'); if(win&&enc.kind==='elite') queue.push('gem'); if(win&&enc.kind==='boss') queue.push('relic');
    const next=()=>{ const k=queue.shift(); if(!k) return after(); if(k==='trial') return trialPrize(trial.prize,next); freePick(k,next); };
    next(); };
}
// mode 'trial' (a Proving Grounds prize): gems are all rares, relics have no guaranteed Legendary and ignore the Cursed Hoard
function freePick(kind,after,mode){
  const src=kind==='gem'?GEMS:RELICS; let pool; const trial=mode==='trial';
  if(kind==='gem') pool=trial?rollRares(3):rollGems(3,true);
  else { pool=[]; const own=()=>run.relics.concat(pool), n=!trial&&run.relics.includes('cursedhoard')?2:3;
    if(!trial){ const L=relicsOfTier('legendary',own()); if(L.length) pool.push(pick(L)); } // boss spoils: one Legendary guaranteed
    while(pool.length<n){ const r=rollRelic(trial?{common:0.5,rare:0.4,legendary:0.1}:{common:0.45,rare:0.45,legendary:0.10},own()); if(!r) break; pool.push(r); } pool=shuffle(pool); }
  // every relic already owned (long endless runs): pay out gold instead of an empty choice
  if(!pool.length){ const g=RELIC_HOARD_GOLD; run.gold+=g;
    modal(`<h2>Relic of the depths</h2><div class="muted small">Your guild already holds every relic in the dungeon. The boss's hoard is yours instead.</div><div class="gold" style="font-size:18px;font-weight:700;margin:8px 0">+${g} gold</div><button class="primary" data-fp-ok="1">Continue</button>`);
    $('#modal').dataset.lock='1';
    $('#sheet').onclick=e=>{ if(!e.target.closest('button[data-fp-ok]')) return; $('#sheet').onclick=null; delete $('#modal').dataset.lock; closeModal(); after(); };
    return; }
  pool.forEach(id=>seen(kind==='gem'?'g':'r',id));
  const uses=id=>{ const u=[]; run.heroes.forEach(h=>heroSkills(h.id).forEach(sk=>{ if(!skillActive(h,sk)&&skillActive(withGem(h,id),sk)) u.push(sk.name); })); return u; };
  modal(`<h2>${trial?'Trial won':kind==='gem'?'Spoils':'Relic of the depths'}</h2><div class="muted small">Choose one. It's free.</div><div class="choice">${pool.map(id=>{ const u=kind==='gem'?uses(id):[]; return `<button data-fp="${id}"><span class="row">${ic(id,kind==='gem'?'g':'r',22)} ${esc(src[id].name)}${kind==='gem'?'':' '+tierPill(id)}</span><span class="d">${esc(src[id].desc)}${u.length?` · <span class="good">unlocks ${u.map(esc).join(', ')}</span>`:''}</span></button>`; }).join('')}</div>`);
  $('#modal').dataset.lock='1';
  $('#sheet').onclick=e=>{ const b=e.target.closest('button[data-fp]'); if(!b) return; $('#sheet').onclick=null; delete $('#modal').dataset.lock; closeModal();
    if(kind==='gem'){ run.bag.push(b.dataset.fp); } else run.relics.push(b.dataset.fp); after(); };
}
function endlessPrompt(goOn,stop,enc){
  const nextMult=enemyMult(run.floor+1,run.depth)/enemyMult(run.floor,run.depth);
  modal(`<h2 class="good">Dungeon cleared</h2>
   <div class="small"><span class="pill g">Depth ${run.depth+1} unlocked</span></div>
   <div class="small muted" style="margin-top:6px">The stairs continue down. In <b class="gold">Endless</b>, every floor is Act 3 strength and enemies grow about ${Math.round((nextMult-1)*100)}% per floor (6 to a fight, elites and bosses cycling). The run ends when your guild falls — your victory here is already counted.${meta.bestEndless?` Best endless floor so far: ${meta.bestEndless}.`:''}</div>
   <div class="row"><button class="grow" data-el="stop">End the run</button><button class="grow gold" data-el="go">Keep descending</button></div>`);
  $('#modal').dataset.lock='1';
  $('#sheet').onclick=e=>{ const b=e.target.closest('button[data-el]'); if(!b) return; $('#sheet').onclick=null; delete $('#modal').dataset.lock; closeModal(); if(b.dataset.el==='go') goOn(); else stop(); };
}
function runOver(victory){
  try{ localStorage.removeItem(KEY_RUN); }catch(e){}
  const r=run; run=null;
  const cleared=victory||r.cleared;
  modal(`<h2 class="${cleared?'good':'acc'}">${victory?'Run complete':cleared?'Fallen in the deep':'Run over'}</h2>
   <div class="small">${r.floor>FLOORS?`Reached <b class="gold">endless floor ${r.floor}</b>`:`Reached floor ${r.floor}`}${r.depth?' at depth '+r.depth:''} · ${r.fights} fights · ${r.kills} enemies slain · ${r.gold} gold unspent</div>
   <div class="small muted">Guild: ${r.heroes.map(h=>HEROES[h.id].name+' '+'★'.repeat(h.lv)).join(', ')}${r.relics.length?' · Relics: '+r.relics.map(x=>RELICS[x].name).join(', '):''}</div>
   ${cleared?`<div class="pill g">Depth ${r.depth+1} unlocked</div>`:''}
   <button class="primary" data-x="close">Back to menu</button>`);
  $('#sheet').onclick=()=>{ $('#sheet').onclick=null; closeModal(); renderTitle(); };
}

