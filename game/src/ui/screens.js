// ---------- screens ----------
function show(id){ ['s-title','s-camp','s-battle','s-gems'].forEach(s=>$('#'+s).hidden=(s!==id)); window.scrollTo(0,0); }
function modal(html){ $('#sheet').innerHTML=html; $('#modal').hidden=false; }
function closeModal(){ $('#modal').hidden=true; }
$('#modal').addEventListener('click',e=>{ if(e.target.id==='modal'&&!$('#modal').dataset.lock) closeModal(); });
function toast(msg){ const t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),2600); }

const depthStatsHtml=d=>{ const s=depthStats(d); return `<div class="depthstats"><span>Best endless <b>${s.bestEndless?'floor '+s.bestEndless:'—'}</b></span><span>Best streak <b>${s.bestStreak}</b></span><span>Current streak <b>${s.streak}</b></span></div>`; };
function renderTitle(){
  const saved=load(KEY_RUN,null);
  const depths=[]; for(let d=0;d<=meta.maxDepth;d++) depths.push(d); // no ceiling: each win unlocks the next depth
  $('#s-title').innerHTML=`
   <div class="hero"><div class="eyebrow">A guild autobattler</div><h1>Guildhall</h1><div class="sub">Build a guild. Clear the dungeon. Break the game.</div><div class="rift"></div></div>
   <div class="stack">
     ${saved&&saved.heroes?`<button class="gold" data-a="continue">Continue run · ${saved.floor>FLOORS?'Endless floor '+saved.floor:'Floor '+saved.floor+'/'+FLOORS}</button>`:''}
     <button class="primary" data-a="new">New run</button>
     ${meta.wins>0?`<div class="card"><div class="eyebrow">Dungeon depth (difficulty)</div><div class="depthsel" id="depthsel">${depths.map(d=>`<button data-d="${d}" class="${d===(window._depth||0)?'on':''}">${d}</button>`).join('')}</div><div class="tiny muted" style="margin-top:6px">Each depth: enemies +10% HP and ATK. Win at a depth to unlock the next — there is no ceiling.</div>${depthStatsHtml(window._depth||0)}</div>`:`<div class="card"><div class="eyebrow">Depth 0</div>${depthStatsHtml(0)}</div>`}
     <div class="row"><button class="grow" data-a="codex">Codex</button><button class="grow" data-a="help">How to play</button></div>
     <div class="tiny muted" style="text-align:center">Runs ${meta.runs} · Wins ${meta.wins}${meta.bestEndless?' · Best endless floor '+meta.bestEndless:''} · Enemies slain ${meta.kills} · Heroes unlocked ${unlockedHeroes().length}/${Object.keys(HEROES).length}</div>
   </div>`;
  show('s-title');
}
$('#s-title').addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b) return;
  if(b.dataset.d!==undefined){ window._depth=+b.dataset.d; renderTitle(); return; }
  const a=b.dataset.a;
  if(a==='new'){ if(load(KEY_RUN,null)&&load(KEY_RUN,null).heroes){ modal(`<h2>Abandon current run?</h2><p class="muted">Your saved run on floor ${load(KEY_RUN,null).floor} will be lost.</p><div class="row"><button class="grow" data-x="close">Keep it</button><button class="grow primary" data-x="abandon">Start new</button></div>`); } else newRun(window._depth||0); }
  if(a==='continue'){ run=loadRun(); if(run){ if(run.startPick) showStartPick(); else renderCamp(); } }
  if(a==='codex') showCodex('h');
  if(a==='help') showHelp();
});
$('#sheet').addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b) return; const x=b.dataset.x;
  if(x==='close') closeModal();
  if(x==='abandon'){ closeModal(); const old=load(KEY_RUN,null); if(old&&!old.cleared){ depthStats(old.depth||0).streak=0; save(KEY_META,meta); } newRun(window._depth||0); }
});
function showHelp(){
  modal(`<h2>How to play</h2><div class="help">
  <p><b>Fights are automatic.</b> Everything is decided before the bell: who's in your guild, which row they stand in, which gems they carry.</p>
  <p><b>Front row</b> takes the hits. Enemies only reach the back row once the front has fallen. Same rule applies to them. <b>Mid</b> heroes (Rogue, Duelist) start in the back but their dodge skills let them move during a fight: Duelist's Riposte steps up when the front empties, Rogue's Shadowstep slips back when he is hurt.</p>
  <p><b>Gems</b> are the whole upgrade system. Each hero has slots (2 at ★, 3 at ★★, 4 at ★★★). Every gem you slot gives a small passive on its own — <b>which passive depends on where it sits</b>: in a <span class="gk hand">weapon</span> socket (weapon or off-hand) it boosts attacks, in an <span class="gk armor">armor</span> socket (body or head) it protects or punishes attackers — and <b>combinations of gems unlock that hero's unique skills</b>: Ward + Ward might be one skill, Ward + Venom another, and both stay active at once. Open a hero's <b>Equip</b> screen (Equip button at the top, or tap a hero) to see every skill they can learn and exactly which gems it takes. Tap a gem to slot or return it — the other gems stay where they are, and when several slots are free the open ones light up so you can choose. <b>Press and hold</b> any gem for its details. Gems can be moved between heroes freely at camp. Slotted gems show on the hero's gear. Every hero starts with two open sockets (weapon and body); you choose which of the other two to unlock.</p>
  <div class="gemlegend">${BASIC_GEMS.map(g=>`<div>${ic(g,'g',18)}<span><b style="color:${ARCH_C[GEMS[g].arch]}">${GEMS[g].name}</b>${gemFx(g)}</span></div>`).join('')}</div>
  <p style="margin-top:8px"><b>Rare gems</b> (multi-coloured) carry two or three essences at once: they count as each of them for skill recipes but give <i>none</i> of the essence passives — a two-essence gem brings its own bonus effect instead, and a three-essence gem comes with a drawback. Slot efficiency for skills, at the cost of raw stats. Elite fights always offer one.</p>
  <p><b>Gold:</b> Gilt gems and some heroes' skills (Pickpocket, Busking, Tithe…) earn extra gold; the camp header shows exactly what the next win pays.</p>
  <p><b>Icons:</b> heroes and enemies are pixel portraits, diamonds are gems, hexagons are relics, dashed squares are unlocked skills. Color shows the archetype: <span style="color:#9be15d">poison</span>, <span style="color:#ff5c3a">burn</span>, <span style="color:#8fe3ff">chill</span>, <span style="color:#5b8cff">shield</span>, <span style="color:#f0f0f8">crit</span>, <span style="color:#ff7ab8">healing</span>, <span style="color:#c47bff">tempo/dodge</span>, <span style="color:#ffd166">gold</span>. Tap anything for details.</p>
  <p><b>Statuses</b> work the same on heroes and enemies. <span class="pill p">Poison</span> deals its stacks each second (ignoring Armor and Shield), then loses 1; at 15 a unit is <b>Festering</b>: Armor counts as 0 and it can't be healed or gain Shield. <span class="pill b">Burn</span> deals its stacks each second, then halves; a unit that reaches 10 is <b>Ablaze</b> and its Burn never drops below 10. <span class="pill c">Chill</span> slows 2.5% per stack (up to 20); attacking halves it, but at 20 a unit is <b>Frozen</b>: its next attack deals half damage and spends 20 Chill. Two of these at once mark a unit for the fight: <b>Brittle</b> (Frozen + Ablaze: every Chill or Burn applied is +1), <b>Blighted</b> (Ablaze + Festering: +25% status damage), <b>Crippled</b> (Frozen + Festering: attacks 25% slower). All three: <b>Ruined</b>, +50% damage from everything. <span class="pill s">Shield</span> absorbs damage first. Armor reduces each attack by a flat amount (min 1). <b>Streaks:</b> each crit or dodge halves that chance until the next miss, so stacked chance never guarantees a run; no one attacks more than 3 times a second.</p>
  <p><b>Guild size:</b> you start with room for 3 heroes; a 4th slot costs 6g and a 5th 10g (button above the formation).</p>
  <p><b>Unlocking gear slots:</b> heroes start with their weapon and body sockets open. On the Equip screen, tap <b>Unlock</b> on the locked slot you want (first 5g, second 9g); each unlock also raises the hero a star (HP and ATK +15%, stronger ability).</p>
  <p><b>Gold:</b> win fights, earn interest (1 per 5 gold held, up to 3). Gems cost 3g. Rerolls cost 1g, +1 for each further reroll on the same floor. <b>Freeze</b> keeps the current market stock for the next floor (what you already bought stays gone); it switches itself off once that market opens, and rerolling unfreezes too.</p>
  <p><b>Choose your path.</b> After the first floor, each camp offers a regular fight or an <b>elite</b> fight (harder, free gem on win). Every 4th floor is a boss (mandatory; free relic on win — one of the three is always Legendary).</p>
  <p><b>Bonus events.</b> After the second fight of each act you also get to pick one of two bonuses (or skip): <b>Gem Forge</b> fuses two gems into one <b>composite</b> that keeps every effect of both and counts as all their essences (composites can't be fused again) · <b>Enchanter</b> turns up to two sockets into the other kind (weapon ⇄ armor) · <b>Gem Cutter</b> reshapes up to two gems into others with the same number of essences · <b>Retirement</b> lets a hero leave and pass half their base HP and ATK to another · <b>Scout's Camp</b> lets you choose which of this act's bosses you'll face.</p>
  <p><b>One loss ends the run.</b> If your whole guild falls, or the fight hits the 60-second limit with enemies still standing, it's over. Clearing floor 12 unlocks the next depth and offers <b>Endless</b>: keep descending through ever-stronger Act 3 floors until your guild falls.</p>
  <p><b>Discovery:</b> the Codex fills as you meet heroes, gems, relics and enemies. Four heroes are locked behind milestones.</p>
  </div><button data-x="close" class="primary">Got it</button>`);
}
function showStartPick(){
  const pool=shuffle(unlockedHeroes()).slice(0,4);
  run._pick=pool; run._picked=[];
  const draw=()=>modal(`<h2>Found your guild</h2><div class="muted small">Choose 2 starting heroes (free). ${2-run._picked.length} left.</div>
   <div class="choice">${pool.map(id=>{const d=HEROES[id]; const on=run._picked.includes(id); return `<button data-pick="${id}" ${on?'disabled':''}><span class="row">${ic(id,'h',24)} ${esc(d.name)} <span class="tiny muted">${d.row} · HP ${d.hp} · ATK ${d.atk} · SPD ${d.spd}</span></span><span class="d">${esc(d.ab(1))}</span></button>`;}).join('')}</div>`);
  $('#modal').dataset.lock='1';
  draw();
  $('#sheet').onclick=e=>{ const b=e.target.closest('button[data-pick]'); if(!b) return; run._picked.push(b.dataset.pick); addHero(b.dataset.pick);
    if(run._picked.length>=2){ delete $('#modal').dataset.lock; $('#sheet').onclick=null; closeModal(); run.startPick=false; delete run._pick; delete run._picked; rollShop(false); renderCamp(); } else draw(); };
}

