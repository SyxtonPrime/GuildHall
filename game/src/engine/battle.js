// ---------- Battle ----------
function baseUnit(def,side,row,s,B){
  return {uid:B.uid++,def,name:def.name,side,row,alive:true,hp:s.maxHp,maxHp:s.maxHp,maxHp0:s.maxHp,atk:s.atk,spd:s.spd,armor:s.armor,crit:s.crit||0,dodge:s.dodge||0,
    shield:0,st:{},kw:{},ablaze:false,critStreak:0,dodgeStreak:0,flags:{},tmpMult:1,timer:0.35+Math.random()*0.3,stTimer:Math.random()*0.2,secs:0,attacks:0,chain:0,L:1,apply:{},hooks:[],statusMult:1,targetLowest:false,hitAll:false,hitAllMult:1,
    stats:{dealt:0,taken:0,healed:0,kills:0}};
}
function createBattle(heroes,enc,relics){
  const B={units:[],t:0,over:false,winner:null,log:[],relics,fx:()=>{},anim:()=>{},spawn:()=>{},move:()=>{},vanish:()=>{},phoenixUsed:false,uid:0,enc,flags:{},depth:0,bounty:0};
  B.logf=s=>{B.log.push(`${B.t.toFixed(1)}s ${s}`); if(B.log.length>400) B.log.shift();};
  heroes.forEach(h=>{ const d=HEROES[h.id], s=computeStats(h,relics);
    const u=baseUnit(d,'p',h.row,s,B); u.L=h.lv; u.hero=h; u.apply=s.apply; u.statusMult=s.statusMult; u.targetLowest=s.targetLowest; u.hitAll=false; u.hitAllMult=1; u.flags=s.flags;
    const gemHooks={onStart:(u,B)=>{ if(s.startShield) addShield(u,s.startShield,B); }, onSecond:(u,B)=>{ if(s.regen&&u.secs%2===0) heal(u,s.regen,B,u); },
      onAttack:(u,a,B)=>{ if(s.shieldPerAttack) addShield(u,s.shieldPerAttack,B); },
      onHit:(u,t,d,B)=>{ if(s.lifesteal&&d>0) heal(u,s.lifesteal,B,u); },
      onDamaged:(u,src,d,info,B)=>{ if(info.type!=='attack'||!src||!src.alive) return; for(const k in s.retaliate) applyStatus(u,src,k,s.retaliate[k],B); if(s.spikes) dealDamage(u,src,s.spikes,{type:'thorns',ignoreArmor:true},B); }};
    u.hooks=[...s.passives.map(x=>x.hooks||{}), gemHooks, ...s.gemHooks, ...s.skills.map(x=>x.hooks||{}), ...relics.map(r=>RELICS[r].hooks||{})];
    B.units.push(u); });
  enc.list.forEach(e=>makeEnemy(B,e.id,e.row));
  B.flags={}; B.units.forEach(u=>{ for(const f in u.flags) B.flags[f]=1; });
  B.units.forEach(u=>fire(u,'onStart',B));
  checkVanguard(B);
  return B;
}
// a row can hold ROW_MAX living units; movement and summons only happen when the destination has room
const rowRoom=(B,side,row)=>B.units.filter(x=>x.side===side&&x.alive&&x.row===row).length<ROW_MAX;
function moveUnit(u,row,B){ if(u.row===row||!rowRoom(B,u.side,row)) return false; u.row=row; B.move(u); return true; }
// Necromancer's Grimoire: slain enemies rise on the hero side (half an enemy Skeleton of this floor, no relic hooks)
function raiseSkeleton(B){
  if(B.over) return;
  const row=rowRoom(B,'p','front')?'front':rowRoom(B,'p','back')?'back':null; if(!row) return;
  const d=ENEMIES.skeleton, m=B.enc.mult;
  const s={maxHp:Math.round(d.hp*m*ENEMY_HP*0.5),atk:Math.round(d.atk*m*ENEMY_ATK*0.6),spd:d.spd,armor:d.armor||0,crit:0,dodge:0};
  const u=baseUnit({name:'Risen Skeleton'},'p',row,s,B); u.name='Risen Skeleton'; u.eid='skeleton'; u.summon=true; u.timer=0; u.hooks=[];
  B.units.push(u); B.fx(u,'RISE','buff'); B.logf('A Risen Skeleton joins your guild.'); B.move(u);
}
// row movement: 'vanguard' heroes step forward when no ally holds the front; 'retreat' heroes fall back when hurt
function checkVanguard(B){
  const frontHeld=B.units.some(x=>x.side==='p'&&x.alive&&x.row==='front');
  if(frontHeld) return;
  const v=B.units.filter(x=>x.side==='p'&&x.alive&&x.row==='back'&&x.flags.vanguard);
  v.forEach(u=>{ if(!moveUnit(u,'front',B)) return; u.retreated=false; B.fx(u,'VANGUARD','buff'); B.logf(`${u.name} steps up to the front.`); });
}
function checkRetreat(u,B){
  if(!u.flags.retreat||u.side!=='p'||u.row!=='front'||u.retreated||u.hp>=u.maxHp*0.66) return;
  if(!moveUnit(u,'back',B)) return; u.retreated=true; B.fx(u,'RETREAT','buff'); B.logf(`${u.name} slips back to the back row.`);
  checkVanguard(B);
}
// Monk — 'weave' (Serenity): fall back below 33% HP, step forward again above 66%.
// 'meditate' (Inner Peace): heals WEAVE_REGEN of max HP per second whenever he's in the back row (≈7 s from 33% to 66%).
const WEAVE_REGEN=0.05;
function checkWeave(u,B,dt){
  if(u.side!=='p'||!u.alive) return;
  if(u.flags.weave&&u.row==='front'&&u.hp<u.maxHp*0.33){ if(!moveUnit(u,'back',B)) return; B.fx(u,'FALL BACK','buff'); B.logf(`${u.name} falls back to recover.`); checkVanguard(B); }
  else if(u.flags.weave&&u.row==='back'&&u.hp>u.maxHp*0.66){ if(!moveUnit(u,'front',B)) return; B.fx(u,'ADVANCE','buff'); B.logf(`${u.name} steps back into the front.`); }
  else if(u.flags.meditate&&u.row==='back'&&u.hp<u.maxHp){ u.medAcc=(u.medAcc||0)+dt*WEAVE_REGEN*u.maxHp; if(u.medAcc>=1){ const n=Math.floor(u.medAcc); u.medAcc-=n; heal(u,n,B,u); } }
}
const ELITE_BOOST=1.15; // elites are optional (and pay a free gem), so the elite itself hits a little harder
function makeEnemy(B,id,row){
  const d=ENEMIES[id], m=B.enc.mult*(d.elite?ELITE_BOOST:1), nz=(d.boss&&B.enc.norm)||{hp:1,atk:1}; const s={maxHp:Math.round(d.hp*m*ENEMY_HP*nz.hp),atk:Math.round(d.atk*m*ENEMY_ATK*nz.atk),spd:d.spd,armor:d.armor||0,crit:d.crit||0,dodge:d.dodge||0};
  const u=baseUnit(d,'e',row,s,B); u.eid=id; u.apply=Object.assign({},d.apply||{}); u.flags=Object.assign({},d.flags||{}); u.targetLowest=!!d.targetLowest; u.hooks=[d.hooks||{}]; B.units.push(u); return u;
}
// mid-battle reinforcements (Slime splits, Necromancer raises). Capped at 6 living enemies.
function spawnEnemy(B,id,row){
  if(B.over||B.units.filter(x=>x.side==='e'&&x.alive).length>=6) return null;
  // each row shows at most ROW_MAX cards (fallen regular enemies keep theirs; fallen summons vanish), so spawn into the requested row, else the other row, else not at all
  const cells=r=>B.units.filter(x=>x.side==='e'&&x.row===r&&(x.alive||!x.summon)).length;
  if(cells(row)>=ROW_MAX){ row=row==='front'?'back':'front'; if(cells(row)>=ROW_MAX) return null; }
  const u=makeEnemy(B,id,row); u.timer=0; u.summon=true; B.logf(`${u.name} joins the fight.`); fire(u,'onStart',B); B.spawn(u); return u;
}
function fire(u,name,...args){ for(const h of u.hooks){ if(h[name]) h[name](u,...args); } }
function fireOnce(u,name,B,...args){ if(B.depth>0) return; B.depth=1; try{ fire(u,name,...args,B); } finally{ B.depth=0; } }
const alliesOf=(u,B)=>B.units.filter(x=>x.side===u.side);
const aliveEnemies=(u,B)=>B.units.filter(x=>x.side!==u.side&&x.alive);
function lowestAlly(u,B){ const a=alliesOf(u,B).filter(x=>x.alive); if(!a.length) return null; return a.reduce((m,x)=>(x.hp/x.maxHp)<(m.hp/m.maxHp)?x:m); }
function randomEnemy(u,B,not){ const f=aliveEnemies(u,B).filter(x=>x!==not); return f.length?pick(f):null; }
// hard caps so stacking buffs can never run away: attack speed at 3 attacks/s, kill-chains at one per possible kill (crit and dodge use streaks instead, see core)
const SPD_CAP=3, KILL_CHAIN_MAX=ROW_MAX*2;
const effSpd=u=>Math.min(SPD_CAP,u.spd*(1-CHILL_SLOW*Math.min(CHILL_SLOW_MAX,u.st.chill||0))*(u.kw.crippled?0.75:1));
function addShield(u,n,B,echo){ if(!u||!u.alive||n<=0) return; if(isFestering(u)){ B.fx(u,'festering','miss'); return; } if(u.flags.shieldMult2) n*=2; u.shield+=n; B.fx(u,`+${n}`,'shield'); fireOnce(u,'onShieldGain',B,n);
  // Twin Aegis: copy to another random hero (the copy never copies itself)
  if(!echo&&u.hero&&B.relics.includes('twinaegis')){ const o=B.units.filter(x=>x!==u&&x.hero&&x.alive); if(o.length) addShield(pick(o),n,B,true); } }
function heal(u,n,B,src){ if(!u||!u.alive||n<=0||u.flags.noHeal) return; if(isFestering(u)){ B.fx(u,'festering','miss'); return; } const r=Math.max(0,Math.min(n,u.maxHp-u.hp)); if(r>0){ u.hp+=r; u.stats.healed+=r; B.fx(u,`+${r}`,'heal'); } if(n-r>0&&u.hero&&B.relics.includes('chalice')) addShield(u,Math.round(n-r),B); if(src&&src.alive) fireOnce(src,'onHeal',B,u,r,n-r); }
function pickTarget(u,foes,a,B){
  if(u.side==='e'&&B&&B.relics.includes('boots')&&!u.targetLowest&&!a.targetLowest&&!a.preferBack) return pick(foes); // Skirmisher's Boots: the back row is exposed
  if(a.preferBack){ const b=foes.filter(f=>f.row==='back'); if(b.length) return pick(b); }
  if(u.targetLowest||a.targetLowest) return foes.reduce((m,x)=>x.hp<m.hp?x:m);
  const fr=foes.filter(f=>f.row==='front'); return pick(fr.length?fr:foes);
}
function attack(u,B,forced){
  if(!u.alive||B.over) return;
  const a={mult:u.tmpMult||1,bonus:0,extraTargets:0,forceCrit:!!u.tmpCrit};
  fire(u,'onAttack',a,B);
  const fz=Math.floor((u.st.chill||0)/FROZEN_AT); if(fz) a.mult/=Math.pow(2,fz); // Frozen: half damage per 20 Chill, consumed after the attack
  let foes=aliveEnemies(u,B).filter(f=>!(f.veilUntil>B.t)); if(!foes.length) return;
  let targets;
  if(forced&&forced.alive) targets=[forced];
  else if(u.hitAll||a.hitAll){ targets=foes.slice(); if(u.hitAll) a.mult*=u.hitAllMult; }
  else if(a.hitRow){ targets=foes.filter(f=>f.row===a.hitRow); if(!targets.length) targets=[pickTarget(u,foes,a,B)]; }
  else { targets=[pickTarget(u,foes,a,B)]; for(let i=0;i<a.extraTargets;i++){ const o=foes.filter(f=>!targets.includes(f)); if(o.length) targets.push(pick(o)); } }
  u.attacks++;
  targets.forEach(t=>hit(u,t,a,B));
  if(fz) u.st.chill-=fz*FROZEN_AT; else if(u.st.chill>0&&CHILL_SHED) u.st.chill=Math.floor(u.st.chill/2); // attacking sheds Chill: the Frozen amount, or half
  fire(u,'onAttackEnd',targets[0],B);
}
function hit(u,t,a,B){
  if(!t.alive||!u.alive) return;
  if(a.forceDodge||streakRoll(t.dodge,t,'dodgeStreak')){ B.anim(u,t,{type:'miss'}); B.fx(t,'miss','miss'); B.logf(`${t.name} dodges ${u.name}.`); fire(t,'onDodge',u,B); return; }
  const ac=Object.assign({mult:1,bonus:0},a);
  fire(u,'onTarget',t,ac,B);
  fire(t,'onDefend',u,ac,B);
  if(t.st.chill>0&&u.side==='p'){ if(B.relics.includes('glacialcore')) ac.bonus+=chill5(t); if(B.flags.wintersgrip) ac.mult*=1.15; if(isFrozen(t)&&B.flags.abszero) ac.mult*=1.5; }
  let dmg=Math.max(1,u.atk+ac.bonus)*ac.mult, crit=false;
  if(ac.forceCrit||streakRoll(u.crit+(ac.critBonus||0),u,'critStreak')){ dmg*=u.flags.crit3?3:2; crit=true; }
  u.lastCrit=crit;
  let dealt;
  u.lastExec=!!ac.execute;
  if(ac.execute) dealt=dealDamage(u,t,t.hp+t.shield,{type:'attack',ignoreArmor:true,ignoreShield:true,crit:true,exec:true},B);
  else dealt=dealDamage(u,t,dmg,{type:'attack',crit,ignoreArmor:!!u.flags.pierce},B);
  for(const k in u.apply){ if(u.apply[k]>0&&t.alive) applyStatus(u,t,k,u.apply[k],B); }
  if(ac.extraApply&&t.alive) for(const k in ac.extraApply) applyStatus(u,t,k,ac.extraApply[k],B);
  if(crit&&t.alive) fireOnce(u,'onCrit',B,t);
  if(crit&&t.alive){ if(u.flags.critPoison) applyStatus(u,t,'poison',2,B); if(u.flags.critPoison3) applyStatus(u,t,'poison',3,B); if(u.flags.critChill) applyStatus(u,t,'chill',2,B); if(u.flags.critBurn) applyStatus(u,t,'burn',3,B); }
  if(crit&&u.side==='p'&&B.relics.includes('luckycoin')) heal(u,3,B);
  if(u.side==='p'&&B.flags.sanguine&&dealt>0) heal(u,Math.ceil(dealt*0.2),B);
  fire(u,'onHit',t,dealt,B);
  alliesOf(t,B).forEach(x=>{ if(x.alive) fire(x,'onAllyHit',t,B); });
}
function applyStatus(src,t,k,n,B){
  if((t.flags.stone&&(k==='poison'||k==='burn'))||(t.flags.fireproof&&k==='burn')||(t.flags.boneproof&&k==='poison')){ B.fx(t,'immune','miss'); return; }
  n=n*(src.statusMult||1);
  if(k==='poison'&&src.side==='p'&&B.relics.includes('plaguebanner')) n+=1;
  if(t.kw.brittle&&(k==='chill'||k==='burn')) n+=1;
  gainStatus(t,k,n,B);
  fireOnce(src,'onApply',B,k,t,n);
  if(k==='poison') t.poisonSrc=src; if(k==='burn') t.burnSrc=src;
  if(k==='poison'&&src.flags.numb&&!B._numb){ B._numb=1; applyStatus(src,t,'chill',1,B); B._numb=0; }
  if(k==='chill'&&src.side==='p'&&B.flags.frozenarmor) B.units.forEach(x=>{ if(x.alive&&x.flags.frozenarmor) addShield(x,2,B); });
  if(k==='poison'&&src.flags.virulent&&!B._vir){ B._vir=1; const o=randomEnemy(src,B,t); if(o) applyStatus(src,o,'poison',n/(src.statusMult||1),B); B._vir=0; }
}
// raw stack gain plus the threshold bookkeeping; applyStatus wraps this with sources, multipliers and hooks
function gainStatus(t,k,n,B){
  const was=t.st[k]||0; t.st[k]=was+n;
  if(k==='burn'&&!t.ablaze&&t.st.burn>=ABLAZE_AT){ t.ablaze=true; B.fx(t,'ABLAZE','burn'); B.logf(`${t.name} is ablaze.`); }
  if(k==='chill'&&was<FROZEN_AT&&t.st.chill>=FROZEN_AT){ B.fx(t,'FROZEN','buff'); B.logf(`${t.name} is frozen.`); }
  if(k==='poison'&&was<FESTER_AT&&t.st.poison>=FESTER_AT){ B.fx(t,'FESTERING','poison'); B.logf(`${t.name} is festering.`); }
  checkMarks(t,B);
}
// two afflictions at once mark the unit for the rest of the fight (see core); Ruined carries all three marks
function checkMarks(t,B){
  const f=isFrozen(t), a=isAblaze(t), p=isFestering(t);
  const mark=(k,label)=>{ if(!t.kw[k]){ t.kw[k]=1; B.fx(t,label,'buff'); B.logf(`${t.name} is ${label.toLowerCase()}.`); } };
  if(f&&a) mark('brittle','BRITTLE'); if(a&&p) mark('blighted','BLIGHTED'); if(f&&p) mark('crippled','CRIPPLED'); if(f&&a&&p) mark('ruined','RUINED');
}
function dealDamage(src,t,amount,info,B){
  if(!t.alive) return 0;
  if(t.kw.ruined) amount*=1.5;
  if(t.kw.blighted&&(info.type==='poison'||info.type==='burn')) amount*=1.25;
  if(info.type==='attack'&&src) B.anim(src,t,info);
  if(t.side==='e'&&B.relics.includes('resonance')&&['poison','burn','chill'].filter(k=>t.st[k]>0).length>=3) amount*=1.3;
  let dmg=Math.max(0,Math.round(amount));
  if(!info.ignoreArmor&&dmg>0&&!isFestering(t)) dmg=Math.max(1,dmg-t.armor); // Festering: Armor counts as 0
  if((!info.ignoreShield||t.flags.shieldAll)&&t.shield>0&&dmg>0){ const ab=Math.min(t.shield,dmg); t.shield-=ab; dmg-=ab; if(ab){ B.fx(t,`-${ab}`,'shield'); if(info.type==='attack'&&src&&src.alive){ fire(t,'onShieldAbsorb',src,ab,B); if(t.side==='p'&&B.relics.includes('mirrorward')) dealDamage(t,src,ab,{type:'thorns',ignoreArmor:true},B); } } }
  t.hp-=dmg; t.stats.taken+=dmg; if(src) src.stats.dealt+=dmg;
  if((dmg>0||!info.ignoreShield)&&!info.silent) B.fx(t,info.exec?'EXECUTE':String(dmg),info.crit?'crit':info.type);
  if(info.type==='attack') B.logf(`${src?src.name:'?'} hits ${t.name} for ${dmg}${info.crit?' (crit)':''}.`);
  if(dmg>0&&src) fire(t,'onDamaged',src,dmg,info,B);
  if(t.hp<=0&&t.hero&&!t.ironUsed&&B.relics.includes('iron')){ t.ironUsed=true; t.hp=1; B.fx(t,'ENDURE','buff'); B.logf(`${t.name} refuses to fall.`); }
  if(t.hp<=0){ if(t.side==='e'&&(info.type==='poison'||info.type==='burn')&&src&&src.side==='p'&&B.relics.includes('tithe')){ B.bounty++; B.fx(t,'+1 gold','buff'); } die(t,src,B); }
  else { checkSmoke(t,B); checkRetreat(t,B); }
  return dmg;
}
// Smoke Bomb: first drop below 50% HP → back row (if room) and untargetable for 3 s
function checkSmoke(u,B){
  if(!u.hero||u.smokeUsed||!B.relics.includes('smoke')||u.hp>=u.maxHp*0.5) return;
  u.smokeUsed=true; u.veilUntil=B.t+3; B.fx(u,'SMOKE','buff'); B.logf(`${u.name} vanishes in a puff of smoke.`);
  if(u.row==='front'&&moveUnit(u,'back',B)) checkVanguard(B);
}
function die(t,killer,B){
  t.alive=false; t.hp=0; t.shield=0; t.st_poisonAtDeath=t.st.poison||0; t.st={}; t.ablaze=false;
  fire(t,'onDeath',B);
  if(t.alive) return;
  B.logf(`${t.name} falls.`);
  if(t.summon) B.vanish(t); // summons leave no card behind
  if(killer&&killer.alive){ killer.stats.kills++; fire(killer,'onKill',t,B); }
  alliesOf(t,B).forEach(x=>{ if(x.alive) fire(x,'onAllyDeath',t,B); });
  if(t.side==='e'&&killer&&killer.side==='p'&&B.relics.includes('grimoire')) raiseSkeleton(B);
  if(t.side==='p'&&t.row==='front'&&B.relics.includes('marching')){ const c=B.units.filter(x=>x.side==='p'&&x.alive&&x.row==='back'&&!x.summon); if(c.length){ const n=c.reduce((m,x)=>x.hp>m.hp?x:m); if(moveUnit(n,'front',B)){ n.retreated=false; n.resting=false; addShield(n,n.maxHp,B); B.fx(n,'STEP UP','buff'); B.logf(`${n.name} steps up to hold the line.`); } } }
  if(t.side==='p') checkVanguard(B);
}
function tickStatus(u,B){
  const st=u.st;
  if(st.poison>0){ const src=u.poisonSrc; const fm=(src&&src.flags.flask&&st.burn>0)?1.5:1; const d=dealDamage(src,u,st.poison*fm,{type:'poison',ignoreArmor:true,ignoreShield:true},B); st.poison-=1;
    if(d>0&&src){ B.units.forEach(x=>{ if(x.side===src.side&&x.alive) fire(x,'onPoisonDamage',u,d,B); }); } }
  if(!u.alive) return;
  if(st.burn>0){ const src=u.burnSrc; let m=(src&&src.side==='p'&&B.relics.includes('kindling'))?2:1; if(src&&src.flags.flask&&st.poison>0) m*=1.5; if(src&&src.side==='p'&&st.chill>0&&B.relics.includes('steam')) m*=2;
    const d=dealDamage(src,u,st.burn*BURN_DMG*m,{type:'burn',ignoreArmor:true},B); st.burn=(src&&src.flags.slowBurn)?st.burn-1:Math.floor(st.burn/2); if(u.ablaze) st.burn=Math.max(ABLAZE_AT,st.burn); // Ablaze holds the floor
    if(d>0&&src){ B.units.forEach(x=>{ if(x.side===src.side&&x.alive) fire(x,'onBurnDamage',u,d,B); }); if(src.side==='p'&&B.relics.includes('wildfire')){ const o=randomEnemy(src,B,u); if(o){ gainStatus(o,'burn',1,B); o.burnSrc=src; } } } }
}
function checkEnd(B){
  if(B.over) return true;
  const p=B.units.some(x=>x.side==='p'&&x.alive), e=B.units.some(x=>x.side==='e'&&x.alive);
  if(!e){B.over=true;B.winner='p';} else if(!p){B.over=true;B.winner='e';}
  return B.over;
}
function stepBattle(B,dt){
  if(B.over) return; B.t+=dt;
  for(const u of B.units){ if(!u.alive) continue;
    if(u.flags.weave||u.flags.meditate) checkWeave(u,B,dt);
    u.stTimer+=dt; if(u.stTimer>=1){ u.stTimer-=1; u.secs++; tickStatus(u,B); if(u.alive) fire(u,'onSecond',B); }
    if(checkEnd(B)) return; if(!u.alive) continue;
    u.timer+=dt*effSpd(u); if(u.timer>=1){ u.timer-=1; attack(u,B); }
    if(checkEnd(B)) return;
  }
  if(B.t>=60){ B.over=true; B.winner='e'; B.logf('Time runs out. Your guild retreats.'); }
}
function runToEnd(B){ let n=0; while(!B.over&&n<4000){ stepBattle(B,0.05); n++; } return B; }
if(typeof module!=='undefined') module.exports={CLASSES,STARTERS,ROOTS,newHero,trainHero,upgradeOptions,upgradesOf,promote,heroSkills,heroPath,HOOKS,rollActBoss,bossPool,bossNorm,BOSSES,enemyMult,gemLeaves,defineMergedGem,restoreMergedGems,genChoices,curAct,slotKind,HAND_SLOTS,HEROES,defaultRow,ROW_MAX,ENCOUNTERS,GEMS,BASIC_GEMS,RARE_GEMS,SLOTS,RELICS,ENEMIES,ARCH_LABEL,heroSkills,activeSkills,skillActive,needCounts,gemCounts,genEncounter,computeStats,createBattle,stepBattle,runToEnd,actOf,kindOf,FLOORS};
