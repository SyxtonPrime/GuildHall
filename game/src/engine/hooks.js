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
 // tier 3
 Windrunner:{passive:{hooks:{onAllyCrit:(u,a,t,B)=>{ if(a===u||u.inFollow||!t.alive) return; if(a.row!==u.row&&!u.flags.gale) return; u.inFollow=true; try{ attack(u,B,t,{mult:u.flags.gale?1:0.5,followUp:true}); } finally{ u.inFollow=false; } }}}, // a follow-up never triggers another
  'Piercing Hits':{flag:'pierce'},
  'Cutting Wind':{hooks:{onAttack:(u,a,B)=>{ if(a.followUp) addApply(a,'chill',3); }}},
  Firewind:{hooks:{onAttack:(u,a,B)=>{ if(a.followUp){ a.adjacent=true; addApply(a,'burn',2); } }}},
  Gale:{flag:'gale'}},
 Mercenary:{passive:{hooks:{onAttack:(u,a,B)=>{ a.mult*=1+0.2*(u.merKills||0); }, onKill:(u,t,B)=>{ u.merKills=(u.merKills||0)+1; }}},
  'Shared Contract':{hooks:{onAllyKill:(u,killer,t,B)=>fire(u,'onKill',t,B)}},
  Eager:{hooks:{onStart:(u,B)=>addBuff(u,'eager','spd',0.2,Infinity,B), onKill:(u,t,B)=>dropBuff(u,'eager')}},
  'Second Wind':{hooks:{onKill:(u,t,B)=>abilityHeal(u,u,Math.round((u.maxHp-u.hp)/4),B)}},
  'Mark for Death':{hooks:{onTarget:(u,t,ac,B)=>{ if(t.hp<t.maxHp/4) ac.mult*=1.5; }}}},
 'Blood mage':{passive:{hooks:{onHit:(u,t,d,B)=>{ if(d>0) abilityHeal(u,lowestAlly(u,B),d*(u.flags.sanguine&&isFestering(t)?2:1),B); },
    onAttackEnd:(u,t,B)=>{ if(!(t&&u.flags.sanguine&&isFestering(t))) dealDamage(null,u,2,{type:'cost',ignoreArmor:true,ignoreShield:true},B); }}},
  Sanguine:{flag:'sanguine'},
  Hemorrhage:{hooks:{onTarget:(u,t,ac,B)=>{ ac.critBonus=(ac.critBonus||0)+0.1*afflictions(t); }, onCrit:(u,t,B)=>{ const d=u.lastDealt||0; if(d>0) alliesOf(u,B).forEach(x=>abilityHeal(u,x,d,B)); }}},
  Stockpile:{hooks:{onStart:(u,B)=>{ u.reserve=Math.floor(bank(B)/2); }, onAttack:(u,a,B)=>{ if(u.reserve>=2){ u.reserve-=2; a.mult*=1.5; } }}},
  'Crimson Tide':{hooks:{onHeal:(u,t,r,over,B)=>{ if(over>0&&u.lastTarget&&u.lastTarget.alive) dealDamage(u,u.lastTarget,over,{type:'bleed'},B); }}}},
 'Glacier Warden':{passive:{hooks:{onDamaged:(u,src,d,info,B)=>{ if(info.type==='attack'&&src&&src.alive&&src.side!==u.side) applyStatus(u,src,'chill',2,B); },
    onDefend:(u,src,ac,B)=>{ if(src.side!==u.side) src.keepChill={by:u,gain:(src.keepChill||{}).gain||0}; }}},
  Avalanche:{hooks:{onAffliction:(u,t,kind,B)=>{ if(kind!=='frozen'||t.side===u.side) return; aliveEnemies(u,B).forEach(o=>{ if(o!==t) applyStatus(u,o,'chill',3,B); }); }}},
  'Branding Blow':{hooks:{onAttack:(u,a,B)=>{ if(nthAttack(u,4)){ addApply(a,'burn',4); a.brand=true; } }, onTarget:(u,t,ac,B)=>{ if(ac.brand){ B.brand={t,until:B.t+2}; B.fx(t,'BRANDED','burn'); } }}},
  Glacier:{hooks:{onDefend:(u,src,ac,B)=>{ ac.reduce=(ac.reduce||0)+Math.min(5,Math.floor((src.st.chill||0)/4)); }}},
  'Rime Rot':{hooks:{onDamaged:(u,src,d,info,B)=>{ if(info.type==='attack'&&src&&src.alive&&isFrozen(src)) applyStatus(u,src,'poison',5,B); }}}},
 Frostblade:{passive:{hooks:{onCrit:(u,t,B)=>hitApply(u,t,'chill',4,B), onAffliction:(u,t,kind,B)=>{ if(kind==='frozen'&&t.side!==u.side) u.nextTarget=t; }}},
  'Rime Edge':{hooks:{onTarget:(u,t,ac,B)=>{ if(isFrozen(t)) ac.critExtra=(ac.critExtra||0)+1; }}}, // ×3 instead of ×2
  'Cold Blood':{hooks:{onTarget:(u,t,ac,B)=>{ if(t.kw.crippled) ac.mult*=2; }, onHit:(u,t,d,B)=>{ if(d>0) abilityHeal(u,u,Math.round(d/4),B); }}},
  Whetstone:{hooks:{onCrit:(u,t,B)=>{ if(!u.whet){ u.whet=1; hitApply(u,t,'chill',20,B); } }}},
  'Glacial Rush':{hooks:{onAttack:(u,a,B)=>{ let n=0; aliveEnemies(u,B).forEach(e=>{ if(isFrozen(e)) n+=0.1; else if(e.st.chill>0) n+=0.05; }); addBuff(u,'rush','spd',Math.min(0.3,n),Infinity,B); }}}},
 Monk:{passive:{mod:{dodge:0.15},hooks:{onDodge:(u,src,B)=>{ if(src.alive&&!u.inCounter){ u.inCounter=true; try{ attack(u,B,src,{counter:true}); } finally{ u.inCounter=false; } } }}},
  Flow:{hooks:{onIncoming:(u,src,ac,B)=>{ ac.dodgeBonus=(ac.dodgeBonus||0)+0.1*(u.flow||0); }, onDodge:(u,src,B)=>{ u.flow=0; abilityHeal(u,u,Math.round(u.maxHp/10),B); }, onDamaged:(u,src,d,info,B)=>{ if(info.type==='attack') u.flow=(u.flow||0)+1; }}},
  'Pressure Point':{hooks:{onAttack:(u,a,B)=>{ if(a.counter) a.forceCrit=true; }}},
  Deflect:{hooks:{onDodge:(u,src,B)=>{ const adj=adjacentOf(src,B).filter(x=>x.alive); if(adj.length) splash(u,pick(adj),Math.round(src.atk/2),B); }}},
  Composure:{hooks:{onStart:(u,B)=>{ u.composure=0.2; }, onIncoming:(u,src,ac,B)=>{ ac.dodgeBonus=(ac.dodgeBonus||0)+(u.composure||0); }, onDamaged:(u,src,d,info,B)=>{ if(info.type==='attack') u.composure=Math.max(0,(u.composure||0)-0.05); }}}},
 Merchant:{passive:{gold:{win:1},hooks:{onAllyTarget:(u,a,t,ac,B)=>{ ac.mult*=1+Math.min(u.flags.deeppockets?0.5:0.25,0.05*Math.floor(bank(B)/10)); }}},
  'Hired Guards':{hooks:{onStart:(u,B)=>{ const n=Math.min(10,Math.floor(bank(B)/4)); if(n>0) alliesOf(u,B).forEach(x=>addShield(x,n,B)); }}},
  'Fast Talker':{flag:'fasttalker'}, // read by the camp's reroll price
  'Danger Money':{hooks:{onAllyTarget:(u,a,t,ac,B)=>{ if(t.def.elite||t.def.boss) ac.mult*=1.25; }}},
  'Deep Pockets':{flag:'deeppockets',gold:{interest:1}}},
 Flamecaller:{passive:{hooks:{onAttack:(u,a,B)=>{ if(nthAttack(u,4)) aliveEnemies(u,B).forEach(t=>applyStatus(u,t,'burn',3,B)); }}},
  Stoked:{hooks:{onSecond:(u,B)=>stoked(u,B), onAttack:(u,a,B)=>stoked(u,B)}},
  'Ashen Guard':{flag:'ashen'}, // dealDamage: Burn doubles against Shield and she gains what it absorbs
  Cauterize:{hooks:{onAffliction:(u,t,kind,B)=>{ if(kind==='ablaze'&&t.side!==u.side) alliesOf(u,B).forEach(x=>abilityHeal(u,x,3,B)); }}},
  Wildfire:{hooks:{onApply:(u,k,t,n,B)=>{ if(k!=='burn'||!isAblaze(t)||t.side===u.side) return; const h=Math.round(n/2); if(h>0) adjacentOf(t,B).forEach(o=>{ if(o.alive) applyStatus(u,o,'burn',h,B); }); }}}},
 Plaguecaller:{passive:{hooks:{onFoeDeath:(u,t,B)=>{ const p=t.stAtDeath.poison||0, es=aliveEnemies(u,B); if(!p||!es.length) return; const low=es.reduce((m,x)=>x.hp<m.hp?x:m), g=u.flags.pandemic?1.25:1;
    applyStatus(u,low,'poison',Math.round(p*g),B); if(u.flags.pyre&&t.stAtDeath.burn>0) applyStatus(u,low,'burn',Math.round(t.stAtDeath.burn*g),B); B.fx(low,'INHERITED','poison'); }}},
  'Funeral Pyre':{flag:'pyre'},
  'Grave Tonic':{hooks:{onStart:(u,B)=>{ u.targetRule=(u,foes)=>{ const f=foes.filter(isFestering); return f.length?pick(f):null; }; },
    onFoeDeath:(u,t,B)=>{ const p=t.stAtDeath.poison||0; if(p<FESTER_AT) return; const al=alliesOf(u,B).filter(x=>x.alive), n=Math.floor(p/al.length); if(n>0) al.forEach(x=>abilityHeal(u,x,n,B)); }}},
  Pandemic:{flag:'pandemic'},
  'Pre-dosed':{hooks:{onStart:(u,B)=>{ const n=Math.min(6,Math.floor(bank(B)/3)), es=aliveEnemies(u,B); if(n>0&&es.length) applyStatus(u,es.reduce((m,x)=>x.hp<m.hp?x:m),'poison',n,B); }}}},
 Elementalist:{passive:{flag:'mirror'}, // hitApply copies each on-hit Burn as Chill and vice versa
  'Flash Point':{hooks:{onAffliction:(u,t,kind,B)=>{ if(t.side===u.side) return; if(kind==='frozen') applyStatus(u,t,'burn',5,B); if(kind==='ablaze') applyStatus(u,t,'chill',10,B); }}},
  'Give and Take':{hooks:{onCrit:(u,t,B)=>aliveEnemies(u,B).forEach(e=>applyStatus(u,e,'burn',2,B)), onDodge:(u,src,B)=>applyStatus(u,src,'chill',2,B)}},
  Conduction:{hooks:{onApply:(u,k,t,n,B)=>{ if(k!=='burn'&&k!=='chill') return; u.conduct=(u.conduct||0)+n; const s=Math.floor(u.conduct/5); if(s>0){ u.conduct-=s*5; addShield(u,s,B); } }}},
  'Triple Point':{hooks:{onTarget:(u,t,ac,B)=>{ if(t.st.burn>0&&t.st.chill>0) addApply(ac,'poison',2); }}}},
 Cutthroat:{passive:{hooks:{onStart:(u,B)=>{ u.veilUntil=B.t+2; }, onKill:(u,t,B)=>{ u.veilUntil=B.t+2; B.fx(u,'VANISH','buff'); }}},
  Ambush:{hooks:{onAttack:(u,a,B)=>{ if(u.veilUntil>B.t) a.forceCrit=true; }}},
  'Slip Away':{hooks:{onAffliction:(u,t,kind,B)=>{ if(t.side!==u.side&&(kind==='frozen'||kind==='festering')){ u.veilUntil=B.t+2; B.fx(u,'VANISH','buff'); } }, onTarget:(u,t,ac,B)=>{ if(t.kw.crippled) ac.mult*=1.5; }}},
  'Caustic Flare':{hooks:{onCrit:(u,t,B)=>{ const n=Math.floor((t.st.poison||0)/4); if(n>0) hitApply(u,t,'burn',n,B); }}},
  'Bounty Blade':{hooks:{onTarget:(u,t,ac,B)=>{ ac.critFlat=(ac.critFlat||0)+Math.floor((t.st.poison||0)/2); }}}},
 Cleric:{passive:{hooks:{onAllyShieldBreak:(u,t,src,B)=>abilityHeal(u,t,5,B), onHeal:(u,t,r,over,B)=>{ if(over>0) addShield(t,over,B); }}},
  Consecrate:{hooks:{onStart:(u,B)=>alliesOf(u,B).forEach(x=>addShield(x,Math.floor(x.maxHp/10),B))}},
  Rally:{hooks:{onHeal:(u,t,r,over,B)=>{ if(t!==u&&r>0) addBuff(t,'rally','spd',0.15,3,B,true); }}}, // lands = healed something
  'Holy Shield':{hooks:{onAttackEnd:(u,t,B)=>{ if(t&&t.alive){ u.cursed=t; B.fx(t,'CURSED','buff'); } },
    onAllyDefend:(u,t,src,ac,B)=>{ const c=u.cursed; if(c&&c.alive&&!ac.divert){ ac.mult*=0.8; ac.divert={t:c,frac:0.25,src:u}; u.cursed=null; } }}}, // a fifth of the blow, as a quarter of the reduced hit
  'Holy Fire':{hooks:{onAllyShieldBreak:(u,t,src,B)=>{ if(src&&src.alive&&src.side!==u.side) applyStatus(u,src,'burn',3,B); }}}},
 Berserker:{passive:{hooks:{onHit:(u,t,d,B)=>rage(u,B), onAttack:(u,a,B)=>{ if((u.rage||0)>=10) addApply(a,'burn',u.trance?4:2); }}},
  Bloodrush:{hooks:{onDamaged:(u,src,d,info,B)=>{ if(info.type==='attack') rage(u,B); }}},
  Reckless:{hooks:{onTarget:(u,t,ac,B)=>{ ac.critBonus=(ac.critBonus||0)+Math.min(0.2,0.02*(u.rage||0))*(u.trance?2:1); }}},
  'Battle Trance':{hooks:{onSecond:(u,B)=>trance(u,B), onDamaged:(u,src,d,info,B)=>trance(u,B), onHit:(u,t,d,B)=>{ if(u.trance&&d>0) abilityHeal(u,u,Math.round(d/5),B); }}},
  Unstoppable:{hooks:{onDefend:(u,src,ac,B)=>{ if((u.rage||0)>=10) ac.mult*=0.8; }}}},
 Shieldmaiden:{passive:{hooks:{onTarget:(u,t,ac,B)=>{ ac.bonus+=Math.floor(u.shield/4)*(ac.slam?2:1); }}},
  'Spiked Shield':{hooks:{onShieldAbsorb:(u,src,ab,B)=>{ const n=Math.round(ab/4); if(n>0) dealDamage(u,src,n,{type:'thorns',ignoreArmor:true},B); }}},
  'Frost Rim':{hooks:{onShieldAbsorb:(u,src,ab,B)=>{ if(u.shield<=0) applyStatus(u,src,'chill',5,B); }}},
  Phalanx:{hooks:{onShieldGain:(u,n,B)=>adjacentOf(u,B).forEach(x=>addShield(x,1,B))}}, // onShieldGain can't re-enter, so neighbours don't echo
  'Shield Slam':{hooks:{onAttack:(u,a,B)=>{ if(nthAttack(u,4)){ a.slam=true; a.hitTargetRow=true; } }}}},
 'Plague doctor':{passive:{hooks:{onSecond:(u,B)=>{ let n=0; aliveEnemies(u,B).forEach(e=>{ if(isFestering(e)) n+=2; else if(e.st.poison>0) n+=1; }); if(n>0) abilityHeal(u,lowestAlly(u,B),n,B); }}},
  Quarantine:{flag:'quarantine'}, // heal(): Poisoned enemies get half
  Rounds:{hooks:{onTarget:(u,t,ac,B)=>{ if(u.roundsAt===u.attacks) return; u.roundsAt=u.attacks; const tot=x=>STATUS_KEYS.reduce((s,k)=>s+(x.st[k]||0),0), al=alliesOf(u,B).filter(x=>x.alive&&tot(x)>0); if(!al.length) return;
    const a=al.reduce((m,x)=>tot(x)>tot(m)?x:m); STATUS_KEYS.forEach(k=>{ const m=a.st[k]||0; if(m>0){ loseStatus(a,k,m,B); applyStatus(u,t,k,m,B); } }); }}},
  Miasma:{hooks:{onSecond:(u,B)=>{ if(u.secs%4===0) aliveEnemies(u,B).forEach(e=>applyStatus(u,e,'poison',1,B)); }}},
  Sickbed:{hooks:{onAllyDefend:(u,t,src,ac,B)=>{ if(isFestering(src)) ac.mult*=0.8; }}}},
 Duelist:{passive:{hooks:{onStart:(u,B)=>startDuel(u,opposite(u,B),B), onFoeDeath:(u,t,B)=>{ if(t===u.duel&&!u.duelWon){ u.duelWon=true; B.logf(`${u.name} wins the duel.`); fire(u,'onDuelWon',t,B); } }}},
  Footwork:{hooks:{onIncoming:(u,src,ac,B)=>{ if(src===u.duel) ac.dodgeBonus=(ac.dodgeBonus||0)+0.25; }, onDodge:(u,src,B)=>{ if(src===u.duel) u.footwork=Math.min(0.3,(u.footwork||0)+0.05); }, onTarget:(u,t,ac,B)=>{ ac.critBonus=(ac.critBonus||0)+(u.footwork||0); }}},
  Parry:{hooks:{onHit:(u,t,d,B)=>addShield(u,2,B), onDamaged:(u,src,d,info,B)=>{ if(info.type==='attack'&&(u.parry||0)<10){ u.parry=(u.parry||0)+2; u.atk+=2; } }}},
  Wager:{hooks:{onStart:(u,B)=>{ const s=Math.min(5,bank(B)); if(s>0){ u.stake=s; B.bounty-=s; B.logf(`${u.name} stakes ${s} gold.`); } }, onDuelWon:(u,t,B)=>{ if(u.stake&&!u.paid){ u.paid=1; B.bounty+=u.stake*2; B.fx(u,`+${u.stake*2} gold`,'buff'); } }}},
  'Finishing Lunge':{hooks:{onTarget:(u,t,ac,B)=>{ if((t===u.duel||t.def.elite||t.def.boss)&&t.hp<t.maxHp/4) ac.forceCrit=true; }}}},
 Apothecary:{passive:{hooks:{onStart:(u,B)=>{ const al=alliesOf(u,B).filter(x=>x.alive&&x!==u).sort((a,b)=>effSpd(b)-effSpd(a)), n=2+(u.flags.reagents?1+Math.min(5,Math.floor(bank(B)/10)):0);
    const give=x=>{ x.elixir=u; x.apply.poison=(x.apply.poison||0)+n; B.fx(x,'ELIXIR','poison'); if(u.flags.oil){ x.crit+=0.15; x.spd*=1.25; } if(u.flags.reagents) x.hooks.push({onHit:(x,t,d,B)=>{ if(isFestering(t)) abilityHeal(u,x,2,B); }}); };
    if(al.length) give(al[0]); if(u.flags.seconddose) give(u); }}},
  'Second Dose':{flag:'seconddose'},
  'Whetting Oil':{flag:'oil'},
  Concentrate:{hooks:{onTarget:(u,t,ac,B)=>{ if(t.st.poison>0) addApply(ac,'poison',3); }}},
  'Rare Reagents':{flag:'reagents'}},
 Bard:{passive:{hooks:{onStart:(u,B)=>alliesOf(u,B).forEach(x=>addBuff(x,'bard'+u.uid,'spd',0.1,Infinity,B))}},
  Overture:{hooks:{onStart:(u,B)=>alliesOf(u,B).forEach(x=>addBuff(x,'overture','spd',0.25,3,B)), onFoeDeath:(u,t,B)=>{ if(B.t<3){ B.bounty+=2; B.fx(t,'+2 gold','buff'); } }}},
  'Two Step':{hooks:{onAllyCrit:(u,a,t,B)=>alliesOf(u,B).forEach(x=>addBuff(x,'twostep-d','dodge',0.15,2,B)), onAllyDodge:(u,a,src,B)=>alliesOf(u,B).forEach(x=>addBuff(x,'twostep-c','crit',0.15,2,B))}},
  Crescendo:{hooks:{onFoeDeath:(u,t,B)=>alliesOf(u,B).forEach(x=>addBuff(x,'crescendo','spd',0.2,3,B))}},
  Ballad:{hooks:{onAllyCrit:(u,a,t,B)=>abilityHeal(u,a,2,B), onAllyDodge:(u,a,src,B)=>abilityHeal(u,a,2,B)}}},
 Rimecaller:{passive:{hooks:{onStart:(u,B)=>{ u.targetRule=(u,foes)=>{ const m=foes.reduce((m,x)=>(x.st.chill||0)>(m.st.chill||0)?x:m); return (m.st.chill||0)>0?m:null; }; }, onAttack:(u,a,B)=>{ if(nthAttack(u,4)) addApply(a,'chill',5); }}},
  Frostguard:{hooks:{onAffliction:(u,t,kind,B)=>{ if(kind==='frozen'&&t.side!==u.side) addShield(u,6,B); }}},
  Shatter:{hooks:{onHit:(u,t,d,B)=>{ if(d>0&&wasFrozen(t)) adjacentOf(t,B).forEach(o=>{ if(o.alive) splash(u,o,Math.round(d/2),B); }); }}},
  'Deep Winter':{hooks:{onFrozenAttack:(u,att,n,B)=>{ if(att.side===u.side) return; const o=aliveEnemies(u,B).filter(x=>x!==att).sort((a,b)=>(b.st.chill||0)-(a.st.chill||0))[0]; if(o) applyStatus(u,o,'chill',Math.floor(n/2),B); }}},
  Splinter:{hooks:{onTarget:(u,t,ac,B)=>{ u.splinter=t.st.chill>0; }, onHit:(u,t,d,B)=>{ if(!u.splinter) return; const n=u.lastCrit?2:1; aliveEnemies(u,B).forEach(o=>{ if(o!==t) applyStatus(u,o,'chill',n,B); }); }}}},
 Hearthguard:{passive:{hooks:{onDamaged:(u,src,d,info,B)=>{ if(info.type==='attack'&&src&&src.alive&&src.side!==u.side) applyStatus(u,src,'burn',2,B); },
    onBurnDamage:(u,t,d,B)=>{ if(u.hgSec!==u.secs){ u.hgSec=u.secs; u.hgN=0; } if(u.hgN<5){ u.hgN++; addShield(u,1,B); } }}},
  Hearthfire:{hooks:{onShieldAbsorb:(u,src,ab,B)=>{ if(u.shield<=0) applyStatus(u,src,'burn',5,B); }}},
  'Hot Feet':{hooks:{onIncoming:(u,src,ac,B)=>{ ac.dodgeBonus=(ac.dodgeBonus||0)+Math.min(0.3,0.05*aliveEnemies(u,B).filter(e=>e.st.burn>0).length); }}},
  Kiln:{hooks:{onHit:(u,t,d,B)=>{ t.noBurnDecay=true; }}},
  Ashes:{hooks:{onShieldAbsorb:(u,src,ab,B)=>{ if(u.shield<=0){ const n=aliveEnemies(u,B).filter(e=>e.st.burn>0).length; if(n) abilityHeal(u,u,n,B); } }}}},
};
// Berserker's stacks: +5% attack speed each (10 at most), doubled in Battle Trance below a quarter HP
function rage(u,B){ u.rage=Math.min(10,(u.rage||0)+1); rageBuff(u,B); }
function rageBuff(u,B){ addBuff(u,'rage','spd',0.05*(u.rage||0)*(u.trance?2:1),Infinity,B); }
function trance(u,B){ const t=u.hp<u.maxHp/4; if(t!==!!u.trance){ u.trance=t; rageBuff(u,B); if(t) B.fx(u,'TRANCE','buff'); } }
// Flamecaller's Stoked: +25% attack speed while every enemy burns, +50% while every enemy is Ablaze
function stoked(u,B){ const es=aliveEnemies(u,B); let n=0; if(es.length&&es.every(e=>e.st.burn>0)) n=es.every(isAblaze)?0.5:0.25; addBuff(u,'stoked','spd',n,Infinity,B); }
