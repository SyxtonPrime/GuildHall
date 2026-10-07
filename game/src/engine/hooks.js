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
 Merchant:{passive:{gold:{win:1},hooks:{onAllyTarget:(u,a,t,ac,B)=>{ ac.mult*=1+Math.min(u.flags.nocap?1e9:u.flags.deeppockets?0.5:0.25,0.05*Math.floor(bank(B)/10)); }}}, // Guildmaster lifts the cap
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
 Duelist:{passive:{hooks:{onStart:(u,B)=>startDuel(u,opposite(u,B),B)}}, // die() fires onDuelWon when the opponent falls
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
 // capstones
 Nightblade:{passive:{hooks:{onStart:(u,B)=>{ u.veilUntil=Math.max(u.veilUntil||0,B.t)+3; }, onKill:(u,t,B)=>{ u.veilUntil=Math.max(u.veilUntil||0,B.t)+3; B.fx(u,'VANISH','buff'); }, onAttack:(u,a,B)=>{ if(u.veilUntil>B.t){ addApply(a,'poison',3); addApply(a,'chill',3); } }}},
  'Venom Step':{hooks:{onKill:(u,t,B)=>aliveEnemies(u,B).forEach(e=>applyStatus(u,e,'poison',3,B))}},
  'Frost Shadow':{flag:'frostshadow'}, // attack(): a Frozen attacker can't pick her
  Cripple:{hooks:{onCrit:(u,t,B)=>{ if(isFestering(t)) hitApply(u,t,'chill',10,B); }, onTarget:(u,t,ac,B)=>{ if(t.kw.crippled) ac.critExtra=(ac.critExtra||0)+1; }}},
  Phantom:{hooks:{onCrit:(u,t,B)=>{ if(!(u.veilUntil>B.t)) u.veilUntil=B.t+1; }}}},
 Guildmaster:{passive:{flags:['guildslot','nocap']}, // the camp reads guildslot; Merchant's hoard bonus reads nocap
  'Many Hands':{hooks:{onStart:(u,B)=>manyHands(u,B),onSecond:(u,B)=>manyHands(u,B)}},
  'Master Jeweller':{flag:'jeweller'}, // createBattle doubles basic gem effects for everyone
  'War Bonds':{hooks:{onAllyTarget:(u,a,t,ac,B)=>{ ac.mult*=1+Math.min(0.5,0.01*Math.floor(B.spent/10)); }}},
  'Golden Age':{flag:'goldenage'}}, // bank() doubles
 Blademaster:{passive:{flag:'crit3',hooks:{onKill:(u,t,B)=>{ addBuff(u,'bm'+(u.bmN=(u.bmN||0)+1),'spd',0.15,Infinity,B); if(!u.inChain){ u.inChain=true; try{ attack(u,B,null,{followUp:true}); } finally{ u.inChain=false; } } }}},
  Riposte:{hooks:{onIncoming:(u,src,ac,B)=>{ if(src===u.duel&&!u.inCounter&&Math.random()<0.25){ u.inCounter=true; try{ attack(u,B,src,{counter:true}); } finally{ u.inCounter=false; } addShield(u,Math.round((u.lastDealt||0)/4),B); } }}},
  Flurry:{hooks:{onCrit:(u,t,B)=>{ u.flurry=true; }, onAttackEnd:(u,t,B)=>{ if(u.flurry){ u.flurry=false; u.timer+=0.5; } }}},
  "Reaper's Toll":{hooks:{onKill:(u,t,B)=>{ B.bounty+=2; B.fx(t,'+2 gold','buff'); u.tollCrit=true; }, onAttack:(u,a,B)=>{ if(u.tollCrit){ u.tollCrit=false; a.forceCrit=true; } }}},
  'Perfect Form':{hooks:{onAttack:(u,a,B)=>{ a.forceCrit=true; }}}},
 Vampire:{passive:{hooks:{onHit:(u,t,d,B)=>{ if(d>0) abilityHeal(u,u,Math.round(d*(u.flags.bloodmoon?1:0.5)),B); }}},
  'Blood Shield':{hooks:{onHeal:(u,t,r,over,B)=>{ if(t===u&&over>0) addShield(u,over,B); }}},
  Exsanguinate:{hooks:{onCrit:(u,t,B)=>{ if(!u.flags.bloodmoon&&u.lastDealt>0) abilityHeal(u,u,Math.round(u.lastDealt/2),B); }}}, // the other half
  'Bat Swarm':{hooks:{onSecond:(u,B)=>bat(u,B), onHit:(u,t,d,B)=>bat(u,B)}},
  'Blood Moon':{flag:'bloodmoon',hooks:{onHeal:(u,t,r,over,B)=>{ if(t===u&&over>0){ u.maxHp+=over; u.hp+=over; B.fx(u,`+${over} max`,'buff'); } }}}},
 'Lava strider':{passive:{hooks:{onDamaged:(u,src,d,info,B)=>{ if(info.type==='attack'&&src&&src.alive&&src.side!==u.side) applyStatus(u,src,'burn',2,B); }, onBurnDamage:(u,t,d,B)=>addShield(u,1,B)}},
  'Magma Skin':{hooks:{onDamaged:(u,src,d,info,B)=>{ if(info.type==='attack'&&src&&src.st.burn>0) abilityHeal(u,u,isAblaze(src)?2:1,B); }}},
  'Cooling Crust':{hooks:{onShieldAbsorb:(u,src,ab,B)=>{ if(u.shield<=0) aliveEnemies(u,B).forEach(e=>applyStatus(u,e,'burn',3,B)); }}},
  Obsidian:{flag:'obsidian'}, // applyStatus: immune to Chill and Poison at 10+ Shield
  'The Floor Is Lava':{hooks:{onSecond:(u,B)=>{ const es=aliveEnemies(u,B); let n=0; es.forEach(e=>{ if(isAblaze(e)) n+=2; else if(e.st.burn>0) n+=1; }); if(n>0) es.filter(e=>e.row==='front').forEach(e=>dealDamage(u,e,n,{type:'burn',ignoreArmor:true},B)); }}}},
 Alchemist:{passive:{hooks:{onFoeDeath:(u,t,B)=>{ if(t.stAtDeath.poison>0){ B.bounty+=2; B.fx(t,'+2 gold','buff'); } },
    onAttackEnd:(u,t,B)=>{ if(!t||!nthAttack(u,4)) return; const ts=u.flags.grandvial?aliveEnemies(u,B):[t,...adjacentOf(t,B)].filter(x=>x.alive); B.fx(u,'VIAL','poison');
      ts.forEach(e=>{ applyStatus(u,e,'poison',5*(u.flags.concentrated&&isFestering(e)?2:1),B); if(u.flags.volatile) applyStatus(u,e,'burn',5,B); }); }}},
  'Volatile Brew':{flag:'volatile'}, Concentrated:{flag:'concentrated'}, 'Caustic Crit':{flag:'caustic'}, 'Grand Vial':{flag:'grandvial'}}, // caustic: tickPoison rolls her crit
 Paladin:{passive:{hooks:{onAllyShieldBreak:(u,t,src,B)=>abilityHeal(u,t,Math.round(t.maxHp/10),B), onHeal:(u,t,r,over,B)=>{ const n=Math.round((r+over)/4); if(n>0) addShield(t,n,B); }}},
  Smite:{hooks:{onCrit:(u,t,B)=>{ if(u.lastDealt>0) abilityHeal(u,lowestAlly(u,B),u.lastDealt,B); }}},
  Aegis:{hooks:{onAllyDefend:(u,t,src,ac,B)=>{ if(t.shield<=0) ac.mult*=0.8; }}},
  'Lay on Hands':{hooks:{onAllyDamaged:(u,t,src,d,info,B)=>{ if(t.hp<t.maxHp/4&&t.hp+d>=t.maxHp/4){ u.loh=u.loh||{}; if(u.loh[t.uid]) return; u.loh[t.uid]=1; abilityHeal(u,t,Math.round(t.maxHp/2),B); } }}},
  'Divine Light':{hooks:{onHeal:(u,t,r,over,B)=>{ const n=Math.round((r+over)/2); if(n>0) alliesOf(u,B).forEach(x=>{ if(x!==t) abilityHeal(u,x,n,B); }); }}}}, // onHeal can't re-enter, so the echoes don't echo
 Herald:{passive:{hooks:{onAllyTarget:(u,a,t,ac,B)=>{ ac.mult*=1.1*(1+0.1*(u.triumph||0)); }, onAllyDamaged:(u,t,src,d,info,B)=>{ if(t.hp<t.maxHp/2&&t.hp+d>=t.maxHp/2) alliesOf(u,B).forEach(x=>addBuff(x,'herald','spd',0.2,3,B)); }}},
  'Standard Bearer':{hooks:{onStart:(u,B)=>alliesOf(u,B).forEach(x=>{ if(x.row==='front') x.armor+=2; })}},
  Fanfare:{hooks:{onFoeDeath:(u,t,B)=>alliesOf(u,B).forEach(x=>abilityHeal(u,x,Math.round(x.maxHp*0.05),B))}},
  'War Chest':{hooks:{onAllyTarget:(u,a,t,ac,B)=>{ ac.mult*=1+Math.min(0.2,0.01*bank(B)); }}},
  Triumph:{hooks:{onAllyKill:(u,k,t,B)=>{ u.triumph=(u.triumph||0)+1; }, onKill:(u,t,B)=>{ u.triumph=(u.triumph||0)+1; }}}},
 Cryomancer:{passive:{hooks:{onAttackEnd:(u,t,B)=>aliveEnemies(u,B).forEach(e=>{ if(e!==t) applyStatus(u,e,'chill',2,B); }), onTarget:(u,t,ac,B)=>{ if(isFrozen(t)) ac.mult*=2; }}},
  'Cold Reception':{hooks:{onStart:(u,B)=>aliveEnemies(u,B).forEach(e=>applyStatus(u,e,'chill',10,B))}},
  Frostfire:{hooks:{onApply:(u,k,t,n,B)=>{ if(k==='chill'&&t.st.burn>0) applyStatus(u,t,'chill',n,B); }}}, // onApply can't re-enter, so this is once
  Shardstorm:{hooks:{onHit:(u,t,d,B)=>{ if(d>0&&wasFrozen(t)) aliveEnemies(u,B).forEach(o=>{ if(o!==t&&isFrozen(o)) splash(u,o,Math.round(d/2),B); }); }}},
  Frostbite:{hooks:{onEnemyAttack:(u,att,a,B)=>{ const c=att.st.chill||0; if(c>0) dealDamage(u,att,c,{type:'chill',ignoreArmor:true},B); }}}},
 'Prismatic magus':{passive:{apply:{poison:1,burn:1,chill:1},hooks:{onAllyTarget:(u,a,t,ac,B)=>{ if(allThree(t)) ac.mult*=1.25; }}},
  Panacea:{hooks:{onSecond:(u,B)=>{ let n=0; aliveEnemies(u,B).forEach(e=>n+=afflictions(e)); if(n>0) alliesOf(u,B).forEach(x=>abilityHeal(u,x,n,B)); }}},
  'Leeching Poison':{hooks:{onChillLost:(u,att,n,B)=>{ if(att.side!==u.side) applyStatus(u,att,'poison',n,B); }}},
  Detonate:{hooks:{onAttackEnd:(u,t,B)=>{ if(!t||!t.alive||!nthAttack(u,4)) return; const af=afflictions(t); let n=0; STATUS_KEYS.forEach(k=>{ n+=t.st[k]||0; t.st[k]=0; }); t.ablaze=false; if(n>0){ B.fx(t,'DETONATE','burn'); dealDamage(u,t,n*Math.pow(2,af),{type:'attack',splash:true,ignoreArmor:true},B); } }}},
  Convergence:{hooks:{onApply:(u,k,t,n,B)=>{ if(allThree(t)&&!t.kw.ruined){ ['brittle','blighted','crippled','ruined'].forEach(m=>t.kw[m]=1); B.fx(t,'RUINED','buff'); B.logf(`${t.name} is ruined.`); } }}}},
 'Frost Stalker':{passive:{apply:{poison:1,chill:1},hooks:{onStart:(u,B)=>{ u.targetRule=(u,foes)=>{ const b=foes.filter(f=>f.row==='back'); return b.length?pick(b):null; }; }}},
  'Cold Hide':{hooks:{onSecond:(u,B)=>{ if(u.secs%3===0){ const n=aliveEnemies(u,B).filter(e=>e.st.chill>0).length; if(n) addShield(u,n,B); } }}},
  'Frostbite Venom':{flag:'frostbitevenom'}, // tickPoison: ×1.5 on Chilled enemies
  "Hunter's Mark":{hooks:{onAllyTarget:(u,a,t,ac,B)=>{ if(t.row==='back') ac.mult*=1.2; }}},
  Stalk:{hooks:{onTarget:(u,t,ac,B)=>{ if(!u.lock||!u.lock.alive){ u.lock=t; u.stalkN=0; B.fx(t,'STALKED','buff'); } if(t!==u.lock) return; const n=++u.stalkN; addApply(ac,'chill',Math.ceil(n/2)); if(n>1) addApply(ac,'poison',Math.floor(n/2)); }}}}, // +1/+0, +1/+1, +2/+1, +2/+2 …
 'Blade dancer':{passive:{mod:{dodge:0.15},hooks:{onDodge:(u,src,B)=>{ u.bdCrit=Math.min(10,(u.bdCrit||0)+1); }, onCrit:(u,t,B)=>{ u.bdDodge=Math.min(10,(u.bdDodge||0)+1); },
    onIncoming:(u,src,ac,B)=>{ ac.dodgeBonus=(ac.dodgeBonus||0)+0.05*(u.bdDodge||0); }, onTarget:(u,t,ac,B)=>{ ac.critBonus=(ac.critBonus||0)+0.05*(u.bdCrit||0); }}}, // stacks cap at 10 (+50%)
  Hamstring:{hooks:{onDodge:(u,src,B)=>{ applyStatus(u,src,'chill',20,B); applyStatus(u,src,'poison',15,B); }}},
  'Razor Waltz':{hooks:{onHit:(u,t,d,B)=>{ if(!u.lastCrit||u.inSecond||!u.lastA||!t.alive) return; u.inSecond=true; try{ hit(u,t,Object.assign({},u.lastA,{mult:(u.lastA.mult||1)*0.5,second:true}),B); } finally{ u.inSecond=false; } }}},
  Untouchable:{hooks:{onDodge:(u,src,B)=>{ if((u.bdDodge||0)>=10) u.untouch=true; }, onHit:(u,t,d,B)=>{ if(u.untouch){ u.untouch=false; if(d>0) addShield(u,d,B); } }}},
  'Dance of Death':{hooks:{onDodge:(u,src,B)=>{ if(src.alive&&!u.inCounter){ u.inCounter=true; try{ attack(u,B,src,{counter:true,forceCrit:true}); } finally{ u.inCounter=false; } } }}}},
 Pyromancer:{passive:{hooks:{onStart:(u,B)=>{ u.hitAll=true; u.hitAllMult=0.6; }}},
  Flashover:{hooks:{onSecond:(u,B)=>flash(u,B), onAttack:(u,a,B)=>flash(u,B), onFoeDeath:(u,t,B)=>{ if(t.ablazeAtDeath) u.flashPerm=(u.flashPerm||0)+0.1; }}},
  'Heat Shield':{hooks:{onSecond:(u,B)=>{ const n=aliveEnemies(u,B).filter(isAblaze).length; if(n) addShield(u,n,B); }}},
  Firestorm:{flag:'firestorm'}, // tickStatus: the Ablaze floor is 20 on enemies
  Supernova:{hooks:{onStart:(u,B)=>aliveEnemies(u,B).forEach(e=>{ gainStatus(e,'burn',Math.max(0,ABLAZE_AT-(e.st.burn||0)),B); e.burnSrc=u; })}}},
 Venomancer:{passive:{flag:'nodecay',hooks:{onStart:(u,B)=>{ const es=aliveEnemies(u,B); if(!es.length) return; (u.flags.plague?es:[es.reduce((m,x)=>x.hp<m.hp?x:m)]).forEach(e=>applyStatus(u,e,'poison',20,B)); }}},
  Fixation:{hooks:{onStart:(u,B)=>{ u.targetRule=(u,foes)=>{ const m=foes.reduce((m,x)=>(x.st.poison||0)>(m.st.poison||0)?x:m); return (m.st.poison||0)>0?m:null; }; }}},
  Rigor:{hooks:{onSecond:(u,B)=>aliveEnemies(u,B).forEach(e=>{ if(isFestering(e)) applyStatus(u,e,'chill',2,B); })}},
  Overdose:{hooks:{onCrit:(u,t,B)=>{ if(isFestering(t)) hitApply(u,t,'poison',Math.floor(t.st.poison/2),B); }}},
  Plague:{flag:'plague'}},
 'Flame dancer':{passive:{mod:{dodge:0.15},hooks:{onDodge:(u,src,B)=>{ if(u.flags.inferno) aliveEnemies(u,B).forEach(e=>applyStatus(u,e,'burn',3,B)); else applyStatus(u,src,'burn',3,B); },
    onAttack:(u,a,B)=>{ const n=Math.floor((u.dodge+buffSum(u,'dodge'))*10); if(n>0) addApply(a,'burn',n); }}},
  'Cinder Step':{hooks:{onDodge:(u,src,B)=>{ if(isAblaze(src)) abilityHeal(u,u,5,B); }}},
  'Fire Whirl':{hooks:{onCrit:(u,t,B)=>{ const n=(u.apply.burn||0)+(u.hitBonus||0); if(n>0) aliveEnemies(u,B).forEach(o=>{ if(o!==t&&o.row===t.row) applyStatus(u,o,'burn',n,B); }); }}},
  'Heat Haze':{hooks:{onIncoming:(u,src,ac,B)=>{ if(isAblaze(src)) ac.dodgeBonus=(ac.dodgeBonus||0)+0.3; else if(src.st.burn>0) ac.dodgeBonus=(ac.dodgeBonus||0)+0.15; }}},
  'Inferno Dance':{flag:'inferno'}},
 Firebomber:{passive:{hooks:{onAttackEnd:(u,t,B)=>{ if(!nthAttack(u,u.flags.shortfuse?3:4)) return; B.fx(u,'BOMB','burn'); const crit=!!u.flags.shrapnel&&streakRoll(u.crit,u,'critStreak');
    aliveEnemies(u,B).forEach(e=>{ if(u.flags.shrapnel) dealDamage(u,e,Math.round(u.atk/2)*(crit?2:1),{type:'attack',splash:true,crit},B); if(!e.alive) return; applyStatus(u,e,'poison',3,B); applyStatus(u,e,'burn',3*(u.flags.napalm&&isAblaze(e)?2:1),B); }); }}},
  Napalm:{flag:'napalm'}, Shrapnel:{flag:'shrapnel'}, 'Short Fuse':{flag:'shortfuse'},
  'Chain Reaction':{hooks:{onFoeDeath:(u,t,B)=>{ if(t.kw.blighted) adjacentOf(t,B).forEach(o=>{ if(o.alive){ applyStatus(u,o,'poison',5,B); applyStatus(u,o,'burn',5,B); } }); }}}},
 'Witch Doctor':{passive:{hooks:{onAttackEnd:(u,t,B)=>{ if(t&&t.alive){ t.hexUntil=u.flags.grandhex?Infinity:B.t+3; t.hexBy=u; B.fx(t,'HEX','buff'); } },
    onAllyDefend:(u,t,src,ac,B)=>{ if(hexed(src,B)){ ac.mult*=0.8; if(u.flags.spiritward){ ac.noCrit=true; ac.noApply=true; } } },
    onAllyTarget:(u,a,t,ac,B)=>{ if(hexed(t,B)) abilityHeal(u,a,2,B); ac.mult*=1+0.05*(u.shrunk||0); }}},
  'Shrunken Head':{hooks:{onFoeDeath:(u,t,B)=>{ if(hexed(t,B)) u.shrunk=(u.shrunk||0)+1; }}},
  'Spirit Ward':{flag:'spiritward'},
  'Voodoo Doll':{hooks:{onFoeDamaged:(u,t,src,d,info,B)=>{ if(info.voodoo||!hexed(t,B)) return; const o=aliveEnemies(u,B).filter(x=>x!==t&&hexed(x,B)); if(o.length) dealDamage(u,pick(o),Math.round(d/2),Object.assign({},info,{voodoo:true,crit:false,exec:false}),B); }}},
  'Grand Hex':{flag:'grandhex'}},
 'Silver tongue':{passive:{flag:'silver',hooks:{onStart:(u,B)=>{ const es=aliveEnemies(u,B).filter(e=>!stalwart(e)); if(!es.length) return; const t=es.reduce((m,x)=>x.atk>m.atk?x:m), dur=u.flags.silverwords?10:5;
      t.charmUntil=B.t+dur; addBuff(t,'charm','spd',-0.25,dur,B); u.charmed=t; B.fx(t,'CHARMED','buff'); B.logf(`${t.name} is charmed.`);
      if(u.flags.turncoat){ t.side='p'; t.turned=true; B.logf(`${t.name} turns on its allies.`); B.move(t); B.spawn(t); } },
    onAllyDefend:(u,t,src,ac,B)=>{ if(src.charmUntil>B.t) ac.mult*=0.75; }, onAllyTarget:(u,a,t,ac,B)=>{ if(a.charmUntil>B.t) ac.mult*=0.75; if(t.charmUntil>B.t&&u.flags.smoothtalk) ac.mult*=1.25; },
    onSecond:(u,B)=>{ const t=u.charmed; if(!t||u.charmDone||(t.alive&&t.charmUntil>B.t)) return; u.charmDone=true; if(t.turned&&t.alive){ t.side='e'; t.turned=false; B.logf(`${t.name} comes to its senses.`); B.move(t); B.spawn(t); }
      if(u.flags.ovation) alliesOf(u,B).forEach(x=>{ addBuff(x,'ovation-s','spd',0.15,Infinity,B); addBuff(x,'ovation-c','crit',0.15,Infinity,B); }); }}}, // the camp reads 'silver' for the hero discount
  'Smooth Talk':{flag:'smoothtalk'}, 'Silver Words':{flag:'silverwords'}, 'Standing Ovation':{flag:'ovation'}, Turncoat:{flag:'turncoat'}},
 Reaper:{passive:{hooks:{onKill:(u,t,B)=>{ if(u.hero){ u.hero.souls=(u.hero.souls||0)+1; u.maxHp+=1; } B.fx(u,'SOUL','buff'); const s=souls(u); if(s>0) abilityHeal(u,u,s,B); }}},
  'Chill of the Grave':{hooks:{onKill:(u,t,B)=>{ const adj=adjacentOf(t,B).filter(x=>x.alive); if(adj.length) applyStatus(u,pick(adj),'chill',10,B); }}},
  'Soul Rend':{hooks:{onTarget:(u,t,ac,B)=>{ ac.critExtra=(ac.critExtra||0)+0.02*souls(u); }}}, // +1% of the ×2
  "Death's Door":{hooks:{onStart:(u,B)=>{ u.targetRule=(u,foes)=>{ const f=foes.filter(e=>atDoor(u,e)); return f.length?pick(f):null; }; }, onTarget:(u,t,ac,B)=>{ if(atDoor(u,t)) ac.execute=true; }}},
  'Grim Harvest':{hooks:{onStart:(u,B)=>{ const p=Math.min(0.25,0.005*souls(u)); if(p>0) aliveEnemies(u,B).forEach(e=>dealDamage(u,e,Math.round(e.maxHp*p),{type:'thorns',ignoreArmor:true,ignoreShield:true},B)); }}}},
 Icemaiden:{passive:{hooks:{onStart:(u,B)=>alliesOf(u,B).forEach(x=>addShield(x,Math.floor(x.maxHp/10),B)), onAllyShieldBreak:(u,t,src,B)=>{ if(src&&src.alive&&src.side!==u.side) applyStatus(u,src,'chill',5,B); }}},
  'Snow Wall':{hooks:{onAllyShieldBreak:(u,t,src,B)=>abilityHeal(u,t,5,B)}},
  "Winter's Grace":{hooks:{onSecond:(u,B)=>{ if(u.secs%4) return; let c=0; aliveEnemies(u,B).forEach(e=>c+=e.st.chill||0); const n=Math.floor(c/5); if(n>0) addShield(lowestAlly(u,B),n,B); }}},
  'Frozen Bastion':{hooks:{onShieldAbsorb:(u,src,ab,B)=>{ if(u.shield<=0) applyStatus(u,src,'chill',20,B); }}},
  'Ice Queen':{flag:'icequeen',hooks:{onTarget:(u,t,ac,B)=>{ ac.bonus+=t.st.chill||0; }}}}, // applyStatus: shielded allies immune to Chill and Burn
 Bulwark:{passive:{hooks:{onStart:(u,B)=>{ u.startShield=Math.round(u.maxHp/2); addShield(u,u.startShield,B); }, onAllyHit:(u,t,B)=>{ if(t!==u) addShield(u,1,B); }}},
  Fortress:{hooks:{onAllyDefend:(u,t,src,ac,B)=>{ if(t.row===u.row) ac.reduce=(ac.reduce||0)+Math.min(3,Math.floor(u.shield/10)); }}},
  'Spiked Wall':{hooks:{onShieldAbsorb:(u,src,ab,B)=>{ const n=Math.round(ab/2); if(n>0) dealDamage(u,src,n,{type:'thorns',ignoreArmor:true},B); }}},
  Immovable:{hooks:{onDefend:(u,src,ac,B)=>{ ac.noCrit=true; }, onDeath:(u,B)=>{ if(u.immovableUsed) return; u.immovableUsed=true; u.alive=true; u.hp=1; B.fx(u,'IMMOVABLE','buff'); B.logf(`${u.name} will not fall.`); addShield(u,u.startShield||Math.round(u.maxHp/2),B); }}},
  Rampart:{hooks:{onShieldGain:(u,n,B)=>{ const q=Math.floor(n/4); if(q>0) alliesOf(u,B).forEach(x=>{ if(x!==u) addShield(x,q,B); }); }}}},
 Champion:{passive:{hooks:{onCrit:(u,t,B)=>{ if(u.lastDealt>0) addShield(u,Math.round(u.lastDealt/4),B); }, onStart:(u,B)=>challenge(u,B,closest), onSecond:(u,B)=>challenge(u,B,closest)}},
  Challenge:{hooks:{onDefend:(u,src,ac,B)=>{ if(src.duel===u) ac.mult*=0.85; }}},
  'Counter Guard':{hooks:{onShieldAbsorb:(u,src,ab,B)=>{ if(src.alive&&!u.inCounter&&Math.random()<0.25){ u.inCounter=true; try{ attack(u,B,src,{counter:true}); } finally{ u.inCounter=false; } } }}},
  Indomitable:{hooks:{onDefend:(u,src,ac,B)=>{ ac.reduce=(ac.reduce||0)+Math.min(3,Math.floor(u.shield/10)); }}},
  'Desperate Strike':{hooks:{onDamaged:(u,src,d,info,B)=>{ const t=u.duel; if(!t||!t.alive||u.dsDuel===t||u.hp>=u.maxHp/4) return; u.dsDuel=t; B.fx(u,'DESPERATE','buff'); attack(u,B,t,{mult:2,critBonus:0.5}); if(t.alive&&!isAblaze(t)) applyStatus(u,t,'burn',Math.max(1,ABLAZE_AT-(t.st.burn||0)),B); },
    onDuelWon:(u,t,B)=>abilityHeal(u,u,Math.round(u.maxHp/4),B)}}},
 Spellblade:{passive:{hooks:{onCrit:(u,t,B)=>STATUS_KEYS.forEach(k=>{ if(t.st[k]>0) hitApply(u,t,k,2,B); })}},
  "Executioner's Eye":{hooks:{onTarget:(u,t,ac,B)=>{ ac.critBonus=(ac.critBonus||0)+0.15*afflictions(t); }}},
  Siphon:{hooks:{onCrit:(u,t,B)=>{ const n=STATUS_KEYS.filter(k=>t.st[k]>0).length; if(n) abilityHeal(u,u,2*n,B); }}},
  'Elemental Rush':{hooks:{onHit:(u,t,d,B)=>{ if(!u.lastCrit||!t.alive||!allThree(t)) return; const depth=(u.rushDepth||0)+1; if(depth>6) return; u.rushDepth=depth; try{ attack(u,B,t,{followUp:true,rush:depth}); } finally{ u.rushDepth=depth-1; } },
    onAttack:(u,a,B)=>{ if(a.rush){ a.critScale=Math.pow(0.5,a.rush); a.noForce=true; } }}}, // each extra attack halves the crit chance; a guarantee counts as 100%
  'Trinity Strike':{hooks:{onTarget:(u,t,ac,B)=>{ if(t.kw.ruined) ac.critExtra=(ac.critExtra||0)+1; }}}},
 'Bounty hunter':{passive:{hooks:{onStart:(u,B)=>challenge(u,B,highestHp), onSecond:(u,B)=>challenge(u,B,highestHp), onDuelWon:(u,t,B)=>{ u.duelsWon=(u.duelsWon||0)+1; u.atk+=1; if(u.hero) u.hero.permAtk=(u.hero.permAtk||0)+1; B.fx(u,'+1 ATK','buff'); }}},
  Bodyguard:{hooks:{onDuelStart:(u,t,B)=>addShield(u,u.atk,B)}},
  Headhunter:{hooks:{onTarget:(u,t,ac,B)=>{ if(t===u.duel) ac.mult*=1+0.25*(u.duelsWon||0); }}},
  Cheat:{hooks:{onDuelStart:(u,t,B)=>{ applyStatus(u,t,'chill',20,B); applyStatus(u,t,'poison',15,B); }}},
  Wanted:{hooks:{onTarget:(u,t,ac,B)=>{ if(stalwart(t)) ac.mult*=1.5; }, onKill:(u,t,B)=>{ if(stalwart(t)){ B.bounty+=10; B.fx(t,'+10 gold','buff'); } }}}},
 Necrodancer:{passive:{hooks:{onStart:(u,B)=>{ const s=u.s, st={maxHp:s.maxHp,atk:s.atk,spd:s.spd,armor:s.armor,crit:s.crit,dodge:s.dodge}; if(u.flags.fatwallet){ const n=Math.floor(bank(B)/2); st.maxHp+=n; st.atk+=n; }
      const w=summonAlly(B,'Wilfred',st,'front',{eid:'skeleton',hooks:u.flags.partners?[u.gemHooks]:[],apply:u.flags.partners?Object.assign({},s.apply):{},fx:'WILFRED'}); if(w){ w.wilfredOf=u; u.wilfred=w; } }}},
  'Soul Link':{hooks:{onHit:(u,t,d,B)=>{ if(u.wilfred&&u.wilfred.alive&&d>0) abilityHeal(u,u.wilfred,Math.round(d/2),B); }}},
  Quickstep:{hooks:{onAllyDamaged:(u,t,src,d,info,B)=>{ if(t!==u.wilfred) return; const f=t.hp/t.maxHp, was=(t.hp+d)/t.maxHp;
      if(f<0.25&&was>=0.25&&!u.qsBack){ u.qsBack=true; moveUnit(u,'back',B); addBuff(u,'quickstep','spd',0.25,Infinity,B); B.fx(u,'QUICKSTEP','buff'); }
      else if(f<0.75&&was>=0.75&&!u.qsFront){ u.qsFront=true; moveUnit(u,'front',B); u.dodge+=0.25; B.fx(u,'QUICKSTEP','buff'); } }}},
  'Fat Wallet':{flag:'fatwallet'}, 'Perfect Partners':{flag:'partners'}},
 Runeguard:{passive:{hooks:{onShieldAbsorb:(u,src,ab,B)=>STATUS_KEYS.forEach(k=>applyStatus(u,src,k,1,B))}},
  'Rune of Binding':{hooks:{onDefend:(u,src,ac,B)=>{ if(src.kw.ruined) ac.mult*=0.6; else if(allThree(src)) ac.mult*=0.8; }}},
  'Runic Shell':{hooks:{onPoisonDamage:(u,t,d,B)=>shell(u,B), onBurnDamage:(u,t,d,B)=>shell(u,B)}},
  'Rune of Return':{hooks:{onAllyShieldBreak:(u,t,src,B)=>{ if(t!==u||!src) return; let n=0; STATUS_KEYS.forEach(k=>n+=src.st[k]||0); n=Math.min(10,n); if(n>0) addShield(u,n,B); }}}, // after the break hooks, so Glyph Wall still sees it broken
  'Glyph Wall':{hooks:{onShieldAbsorb:(u,src,ab,B)=>{ if(u.shield<=0) aliveEnemies(u,B).forEach(e=>STATUS_KEYS.forEach(k=>applyStatus(u,e,k,3,B))); }}}},
 Assassin:{passive:{targetLowest:true,hooks:{onTarget:(u,t,ac,B)=>{ const thr=0.05+(u.flags.deadoralive?0.1:0)+(u.flags.needle?0.01*Math.floor((t.st.poison||0)/4):0); if(t.hp<t.maxHp*thr) ac.execute=true; },
    onKill:(u,t,B)=>{ if(u.lastExec&&u.flags.deadoralive){ B.bounty+=3; B.fx(t,'+3 gold','buff'); } }}},
  'Quick Kill':{hooks:{onAttackEnd:(u,t,B)=>addBuff(u,'quickkill','spd',(t&&t.alive&&t.hp<t.maxHp/2)?0.2:0,Infinity,B)}},
  'Poisoned Needle':{flag:'needle'},
  'Double Tap':{hooks:{onAttackEnd:(u,t,B)=>{ if(!t||!t.alive||!u.lastA||u.lastA.second||u.inSecond) return; u.inSecond=true; try{ hit(u,t,Object.assign({},u.lastA,{mult:(u.lastA.mult||1)*0.5,second:true}),B); } finally{ u.inSecond=false; } }}},
  'Dead or Alive':{flag:'deadoralive'}},
 Necromancer:{passive:{hooks:{onFoeDeath:(u,t,B)=>{ if((u.risen||0)>=2&&!u.flags.legion) return; raise(u,t,B); }, onAllyDeath:(u,t,B)=>{ if(u.flags.legion&&!t.summon) raise(u,t,B); }}},
  'Grave Chill':{flag:'gravechill'}, 'Hasty Burial':{flag:'hasty'}, 'Grave Robber':{flag:'graverobber'}, Legion:{flag:'legion'}},
 Heretic:{passive:{flags:['pierce','ghost'],hooks:{onCrit:(u,t,B)=>{ const n=Math.round(u.maxHp*0.05); abilityHeal(u,u,n,B); if(u.flags.zealot) abilityHeal(u,lowestAlly(u,B),n,B); }}},
  Blasphemy:{hooks:{onCrit:(u,t,B)=>{ if(t.shield>0) t.shield=Math.max(0,t.shield-2); else if(t.armor>0) t.armor-=1; }}},
  Zealot:{flag:'zealot'},
  Heresy:{hooks:{onIncoming:(u,src,ac,B)=>{ if(allThree(src)) ac.dodgeBonus=(ac.dodgeBonus||0)+0.4; }, onTarget:(u,t,ac,B)=>{ if(allThree(t)) ac.critBonus=(ac.critBonus||0)+0.4; }}},
  Apostate:{hooks:{onAttack:(u,a,B)=>{ if(B.t<5) a.forceCrit=true; }, onIncoming:(u,src,ac,B)=>{ if(B.t<5) ac.forceDodge=true; }}}},
 'Storm dancer':{passive:{hooks:{onAttack:(u,a,B)=>{ if(nthAttack(u,u.flags.lightning?3:4)){ a.hitAll=true; a.storm=true; const n=u.flags.thunderhead?4:2; addApply(a,'burn',n); addApply(a,'chill',n); } },
    onAttackEnd:(u,t,B)=>{ if(u.lastA&&u.lastA.storm&&u.flags.lightning){ if(moveUnit(u,u.row==='front'?'back':'front',B)) B.fx(u,'LEAP','buff'); checkVanguard(B); } }}},
  'Eye of the Storm':{hooks:{onHit:(u,t,d,B)=>{ if(u.lastA&&u.lastA.storm) addShield(u,t.kw.brittle?4:(isAblaze(t)||isFrozen(t))?2:1,B); }}},
  'Lightning Step':{flag:'lightning'}, Thunderhead:{flag:'thunderhead'},
  Maelstrom:{hooks:{onHit:(u,t,d,B)=>{ if(u.lastA&&u.lastA.storm&&t.alive&&t.st.burn>0&&t.st.chill>0&&!t.kw.brittle){ t.kw.brittle=1; B.fx(t,'BRITTLE','buff'); } }}}},
 Phoenix:{passive:{hooks:{onDeath:(u,B)=>{ const max=u.flags.eternal?2:1; if((u.revived||0)>=max) return; u.revived=(u.revived||0)+1; u.alive=true; u.hp=u.flags.rebirth?u.maxHp:Math.round(u.maxHp/2); B.fx(u,'REBORN','buff'); B.logf(`${u.name} rises from the ashes.`);
    if(u.flags.rebirth) addShield(u,Math.round(u.maxHp/4),B); aliveEnemies(u,B).forEach(e=>applyStatus(u,e,'burn',5,B)); if(u.flags.risingflame){ addBuff(u,'rising','spd',0.5,Infinity,B); u.apply.burn=(u.apply.burn||0)+3; } }}},
  'Cinder Wings':{hooks:{onSecond:(u,B)=>{ let n=0; aliveEnemies(u,B).forEach(e=>{ if(isAblaze(e)) n+=2; else if(e.st.burn>0) n+=1; }); if(n) abilityHeal(u,u,n,B); }}},
  Rebirth:{flag:'rebirth'}, 'Rising Flame':{flag:'risingflame'}, 'Eternal Flame':{flag:'eternal'}},
 Bladestorm:{passive:{hooks:{onCrit:(u,t,B)=>{ const d=u.lastDealt||0, row=aliveEnemies(u,B).filter(o=>o!==t&&o.row===t.row); u.bsHit=1+row.length; if(d>0) row.forEach(o=>splash(u,o,Math.round(d/2),B)); }}},
  'Ice Guard':{hooks:{onCrit:(u,t,B)=>addShield(u,2*(u.bsHit||1),B)}},
  Cascade:{hooks:{onAffliction:(u,t,kind,B)=>{ if(kind!=='frozen'||t.side===u.side||(u.cascade||0)>=3) return; u.cascade=(u.cascade||0)+1; try{ attack(u,B,null,{followUp:true}); } finally{ u.cascade--; } }}}, // chains at most three deep
  'Blizzard Step':{hooks:{onAttack:(u,a,B)=>addBuff(u,'blizzard','spd',0.1*aliveEnemies(u,B).filter(isFrozen).length,Infinity,B)}},
  Whiteout:{hooks:{onCrit:(u,t,B)=>{ if(isFrozen(t)) aliveEnemies(u,B).forEach(o=>{ if(o!==t&&o.row===t.row) applyStatus(u,o,'chill',20,B); }); }}}},
 'Shadow Archer':{passive:{hooks:{onStart:(u,B)=>{ u.targetRule=(u,foes)=>foes.reduce((m,x)=>x.atk>m.atk?x:m); }, onAttack:(u,a,B)=>{ if(nthAttack(u,u.flags.eclipse?3:4)) a.blindShot=true; },
    onTarget:(u,t,ac,B)=>{ if(t.blind&&u.flags.headshot) ac.forceCrit=true; if(t.blind&&u.flags.eclipse) ac.mult*=1.5; },
    onHit:(u,t,d,B)=>{ if(u.lastA&&u.lastA.blindShot&&t.alive&&!u.lastA.second){ t.blind=true; B.fx(t,'BLINDED','miss'); if(u.flags.pinning) applyStatus(u,t,'chill',10,B); } }}},
  'Pinning Shot':{flag:'pinning'}, Headshot:{flag:'headshot'},
  Volley:{hooks:{onHit:(u,t,d,B)=>{ if(!u.lastA||!u.lastA.blindShot||u.lastA.volleyed) return; u.lastA.volleyed=true; aliveEnemies(u,B).forEach(o=>{ if(o!==t&&o.row===t.row){ splash(u,o,Math.round(d/2),B); if(o.alive) applyStatus(u,o,'burn',2,B); } }); if(t.alive) applyStatus(u,t,'burn',2,B); }}},
  Eclipse:{flag:'eclipse'}},
};
// shared by the capstones
const allThree=t=>STATUS_KEYS.every(k=>t.st[k]>0), hexed=(t,B)=>t.hexUntil>B.t, stalwart=e=>!!(e.def&&(e.def.elite||e.def.boss)), souls=u=>(u.hero&&u.hero.souls)||0, atDoor=(u,e)=>e.hp<e.maxHp*0.1+souls(u);
function manyHands(u,B){ const n=Math.max(0,B.units.filter(x=>x.hero&&x.alive).length-1); alliesOf(u,B).forEach(x=>addBuff(x,'manyhands','spd',0.05*n,Infinity,B)); }
const bat=(u,B)=>addBuff(u,'bat','spd',u.hp/200,Infinity,B); // +X%, X = half her current HP
const flash=(u,B)=>addBuff(u,'flash','spd',0.05*aliveEnemies(u,B).filter(isAblaze).length+(u.flashPerm||0),Infinity,B);
function challenge(u,B,choose){ if(u.duel&&u.duel.alive) return; const t=choose(u,B); if(t) startDuel(u,t,B); }
const closest=(u,B)=>{ const es=aliveEnemies(u,B), fr=es.filter(e=>e.row==='front'); return (fr.length?pick(fr):es.length?pick(es):null); };
const highestHp=(u,B)=>{ const es=aliveEnemies(u,B); return es.length?es.reduce((m,x)=>x.hp>m.hp?x:m):null; };
function shell(u,B){ if(u.shellSec!==u.secs){ u.shellSec=u.secs; u.shellN=0; } if(u.shellN<5){ u.shellN++; addShield(u,1,B); } }
// Necromancer: a Skeleton copy of the fallen at half its max HP, no abilities
function raise(u,t,B){ u.risen=(u.risen||0)+1; const st={maxHp:Math.max(1,Math.round(t.maxHp/2)),atk:t.atk,spd:t.spd*(u.flags.hasty?1.5:1),armor:t.armor,crit:0,dodge:0};
  const w=summonAlly(B,'Skeletal '+t.name,st,t.row,{eid:t.eid||'skeleton',apply:u.flags.gravechill?{chill:2}:{}}); if(w&&u.flags.graverobber){ B.bounty+=2; B.fx(w,'+2 gold','buff'); } }
// Berserker's stacks: +5% attack speed each (10 at most), doubled in Battle Trance below a quarter HP
function rage(u,B){ u.rage=Math.min(10,(u.rage||0)+1); rageBuff(u,B); }
function rageBuff(u,B){ addBuff(u,'rage','spd',0.05*(u.rage||0)*(u.trance?2:1),Infinity,B); }
function trance(u,B){ const t=u.hp<u.maxHp/4; if(t!==!!u.trance){ u.trance=t; rageBuff(u,B); if(t) B.fx(u,'TRANCE','buff'); } }
// Flamecaller's Stoked: +25% attack speed while every enemy burns, +50% while every enemy is Ablaze
function stoked(u,B){ const es=aliveEnemies(u,B); let n=0; if(es.length&&es.every(e=>e.st.burn>0)) n=es.every(isAblaze)?0.5:0.25; addBuff(u,'stoked','spd',n,Infinity,B); }
