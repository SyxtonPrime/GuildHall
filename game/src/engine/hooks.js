// ---------- Effects (the HOOKS table) ----------
// HOOKS[className].passive and HOOKS[className][skillName] give a class passive or skill its effect: {hooks, mod, apply, flag, flags, gold,
// statusMult, applyBonus, healBonus}. Text comes from the bench (CLASS_DATA); an entry missing here shows its text and does nothing yet.
// Hook signatures, u being the unit the hook belongs to:
//   onStart(u,B) · onSecond(u,B) · onAttack(u,a,B) before targets are chosen · onTarget(u,t,ac,B) and onDefend(t,u,ac,B) per hit, before damage ·
//   onAllyTarget(x,u,t,ac,B) / onAllyDefend(x,t,u,ac,B) on every living unit of the attacker's / defender's side (auras) · onHit(u,t,dealt,B) ·
//   onCrit(u,t,B) · onDodge(t,u,B) · onDamaged(u,src,dmg,info,B) · onShieldAbsorb(u,src,ab,B) · onShieldGain(u,n,B) · onHealing(u,t,h,B) before an
//   ability heal (scale h.n) · onHeal(u,t,healed,over,B) after any heal u performed · onApply(u,k,t,n,B) · onKill(u,t,B) · onDeath(u,B) ·
//   onAllyHit(x,t,B) · onAllyDeath(x,t,B) · onFoeDeath(x,t,B) (t.stAtDeath holds its statuses) · onMove(u,B) · onIntercept(x,t,u,B) → the unit to
//   take the hit · onPoisonDamage/onBurnDamage(x,t,d,B) · onAttackEnd(u,t,B).
// Status an attack applies on hit goes through hitApply (Mage +1, Scald); heals from abilities go through abilityHeal (Mage +1, Healer bonuses);
// area effects and moved stacks use applyStatus. "Every Nth attack" is nthAttack(u,N). Rulings: docs/hero-refactor-plan.md.
function acroRow(u,B){ // Acrobat: the bonus follows the row
  if(u.acro==='front') u.dodge-=0.2; else if(u.acro==='back') u.spd/=1.15;
  u.acro=u.row; if(u.row==='front') u.dodge+=0.2; else u.spd*=1.15; }
const HOOKS={
 // roots
 Mage:{passive:{applyBonus:1,healBonus:1}},
 Warrior:{passive:{mod:{armor:1},hooks:{onSecond:(u,B)=>{ if(u.secs%2===0) heal(u,1,B); }}}}, // sourceless: regeneration never fires on-heal effects
 Rogue:{passive:{gold:{win:1}}},
 // starters
 Poisoner:{passive:{apply:{poison:1}},
  'Bitter Harvest':{hooks:{onFoeDeath:(u,t,B)=>{ const p=t.stAtDeath.poison||0; if(!p) return; if(p>=FESTER_AT) alliesOf(u,B).forEach(x=>abilityHeal(u,x,3,B)); else abilityHeal(u,lowestAlly(u,B),3,B); }}},
  'Venom Strike':{hooks:{onCrit:(u,t,B)=>tickPoison(t,B)}},
  'Tainted Coin':{hooks:{onFoeDeath:(u,t,B)=>{ if((t.stAtDeath.poison||0)>=FESTER_AT){ B.bounty+=1; B.fx(t,'+1 gold','buff'); } }}},
  Virulence:{hooks:{onApply:(u,k,t,n,B)=>{ if(k!=='poison'||!u.inHit||t.virulent) return; const now=t.st.poison; if(now-n<8&&now>=8){ t.virulent=1; gainStatus(t,'poison',now,B); B.fx(t,'VIRULENT','poison'); B.logf(`${t.name}'s Poison doubles.`); } }}}},
 'Fire mage':{passive:{apply:{burn:1}},
  'Flame Barrier':{hooks:{onFoeDeath:(u,t,B)=>{ const b=t.stAtDeath.burn||0; if(b>0) addShield(u,b,B); }}},
  Stoke:{hooks:{onTarget:(u,t,ac,B)=>{ if(!(t.st.burn>0)) return; t.stokedBy=t.stokedBy||{}; if(t.stokedBy[u.uid]) return; t.stokedBy[u.uid]=1; u.spd*=1.05; B.fx(u,'STOKE','buff'); }}},
  Scald:{hooks:{onTarget:(u,t,ac,B)=>{ if(t.st.burn>0&&t.st.chill>0) ac.applyBonus=(ac.applyBonus||0)+1; }}},
  'Fan the Flames':{hooks:{onSecond:(u,B)=>{ if(u.secs%2) return; aliveEnemies(u,B).filter(isAblaze).forEach(t=>adjacentOf(t,B).forEach(o=>applyStatus(u,o,'burn',1,B))); }}}},
 'Frost mage':{passive:{apply:{chill:1}},
  'Numbing Cold':{hooks:{onAllyDefend:(x,t,u,ac,B)=>{ if(u.st.chill>0) ac.reduce=(ac.reduce||0)+(isFrozen(u)?2:1); }}},
  Frostburn:{hooks:{onAllyTarget:(x,u,t,ac,B)=>{ if(t.kw.brittle||(isFrozen(t)&&isAblaze(t))) ac.bonus+=8; else if(t.st.burn>0&&t.st.chill>0) ac.bonus+=2; }}},
  'Precise Cut':{hooks:{onTarget:(u,t,ac,B)=>{ if(isFrozen(t)) ac.forceCrit=true; }}},
  'Deep Freeze':{hooks:{onTarget:(u,t,ac,B)=>{ ac.bonus+=Math.min(10,Math.floor((t.st.chill||0)/2)); }}}},
 Acrobat:{passive:{hooks:{onStart:acroRow,onMove:acroRow}},
  'Well Prepared':{hooks:{onStart:(u,B)=>{ u.sureDodge=1; }}},
  'Juggling Torches':{hooks:{onAttack:(u,a,B)=>{ if(nthAttack(u,4)){ a.extraTargets+=1; addApply(a,'burn',2); } }}},
  'Second Breath':{hooks:{onDodge:(u,src,B)=>{ if(u.row==='front') abilityHeal(u,u,2,B); }, onAttack:(u,a,B)=>{ if(u.row==='back'&&nthAttack(u,4)) abilityHeal(u,lowestAlly(u,B),2,B); }}},
  Vault:{hooks:{onDamaged:(u,src,d,info,B)=>{ if(!(u.hp<u.maxHp/2&&u.hp+d>=u.maxHp/2)) return; if(u.row==='front'&&moveUnit(u,'back',B)){ B.logf(`${u.name} vaults to the back row.`); checkVanguard(B); } u.sureDodgeUntil=B.t+2; B.fx(u,'VAULT','buff'); },
    onKill:(u,t,B)=>{ abilityHeal(u,u,Math.round(u.maxHp/4),B); if(u.row==='back'&&moveUnit(u,'front',B)){ B.fx(u,'VAULT','buff'); B.logf(`${u.name} vaults to the front.`); } }}}},
 Swordsman:{passive:{hooks:{onTarget:(u,t,ac,B)=>{ ac.critExtra=(ac.critExtra||0)+0.25*(1+afflictions(t)); }}},
  'Poisoned Blade':{hooks:{onCrit:(u,t,B)=>hitApply(u,t,'poison',5,B)}},
  'Cold Read':{hooks:{onTarget:(u,t,ac,B)=>{ ac.critBonus=(ac.critBonus||0)+0.025*(t.st.chill||0); }}},
  'Pristine Gear':{hooks:{onAttack:(u,a,B)=>{ if(u.attacks===1) a.forceCrit=true; }}},
  Momentum:{hooks:{onTarget:(u,t,ac,B)=>{ ac.critBonus=(ac.critBonus||0)+(u.momentum||0); }, onHit:(u,t,d,B)=>{ u.momentum=u.lastCrit?0:(u.momentum||0)+0.1; }}}},
 Healer:{passive:{hooks:{onSecond:(u,B)=>{ if(u.secs%3===0) abilityHeal(u,lowestAlly(u,B),4,B); }, onHealing:(u,t,h,B)=>{ if(t.hero&&t.hp<t.maxHp/4) h.n*=1.5; }}}, // Mend
  Bandage:{hooks:{onHeal:(u,t,r,over,B)=>addShield(t,2,B)}},
  'Quick Hands':{hooks:{onHeal:(u,t,r,over,B)=>{ if(t!==u&&t.hero) u.sureDodge=1; }}},
  'Side Effects':{hooks:{onTarget:(u,t,ac,B)=>{ if(u.sideFxAt===u.attacks) return; u.sideFxAt=u.attacks; const c=alliesOf(u,B).filter(x=>x.alive&&STATUS_KEYS.some(k=>x.st[k]>0)); if(!c.length) return; const a=pick(c);
    STATUS_KEYS.forEach(k=>{ const m=Math.min(2,a.st[k]||0); if(m>0){ loseStatus(a,k,m,B); applyStatus(u,t,k,m,B); } }); }}},
  Renew:{hooks:{onHealing:(u,t,h,B)=>{ if(t.hero&&t.hp<t.maxHp/2) h.n*=1.5; }}}},
 Thief:{passive:{hooks:{onHit:(u,t,d,B)=>{ if((u.stole||0)>=3) return; t.stolenBy=t.stolenBy||{}; if(t.stolenBy[u.uid]) return; t.stolenBy[u.uid]=1; u.stole=(u.stole||0)+1; B.bounty+=1; B.fx(t,'+1 gold','buff'); }}},
  Finisher:{hooks:{onTarget:(u,t,ac,B)=>{ if(t.hp<t.maxHp/2) addApply(ac,'poison',2); }}},
  Backstab:{hooks:{onTarget:(u,t,ac,B)=>{ u.bs=u.bs||{}; u.lastBackstab=false; if(!u.bs[t.uid]||u.bsNext){ ac.mult*=1.5; u.lastBackstab=true; } u.bs[t.uid]=1; u.bsNext=false; },
    onHit:(u,t,d,B)=>{ if(u.lastBackstab&&u.lastCrit) u.bsNext=true; }}},
  Getaway:{hooks:{onKill:(u,t,B)=>{ u.sureDodge=1; }}},
  'Gilded Knives':{hooks:{onAttack:(u,a,B)=>{ a.bonus+=Math.min(5,Math.floor(bank(B)/3)); }}}},
 Sentinel:{passive:{hooks:{onStart:(u,B)=>addShield(u,8,B)}},
  Backdraft:{hooks:{onShieldAbsorb:(u,src,ab,B)=>{ if(u.shield<=0) applyStatus(u,src,'burn',3,B); }}},
  Protector:{hooks:{onAllyHit:(u,t,B)=>{ if(t!==u) addShield(u,2,B); }}},
  'Cold Iron':{hooks:{onDefend:(u,src,ac,B)=>{ if(u.shield>0&&src.side!==u.side) src.keepChill=u; }}},
  Interpose:{hooks:{onIntercept:(u,t,src,B)=>{ if(src.side===u.side) return null; t.interposedBy=t.interposedBy||{}; if(t.interposedBy[u.uid]) return null; t.interposedBy[u.uid]=1; B.fx(u,'INTERPOSE','buff'); return u; }}}},
};
