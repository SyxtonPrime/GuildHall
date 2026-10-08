// ---------- Stats ----------
// ctx: {gemMult} doubles gem socket effects (Master Jeweller). h.permAtk and h.souls are run-permanent gains (Bounty hunter, Reaper).
function computeStats(h,relics,ctx){
  relics=relics||[];
  const L=h.lv, m=1+0.15*(L-1), base=classStats(h.root||rootOf(h.id),heroPath(h)); // the route's stats, grown 15% per ★
  let hp=base.hp*m+(h.bonusHp||0)+(h.giftHp||0)+(h.souls||0), atk=base.atk*m+(h.giftAtk||0)+(h.permAtk||0), spd=base.spd, armor=base.armor, crit=base.crit, dodge=base.dodge;
  const apply={};
  let statusMult=1, targetLowest=false, startShield=0, regen=0;
  const flags={};
  const sc=slotCounts(h), gh=sc.hand, ga=sc.armor, gold={win:0,kill:0,interest:0,elite:0};
  if(relics.includes('prism')){ const all={}; [gh,ga].forEach(t=>{ for(const k in t) all[k]=(all[k]||0)+t[k]; }); for(const k in all){ gh[k]=all[k]; ga[k]=all[k]; } } // Prismatic Lens: every gem works as both kinds
  const gm=(ctx&&ctx.gemMult)||1; if(gm!==1){ for(const k in gh) gh[k]*=gm; for(const k in ga) ga[k]*=gm; }
  const retaliate={}; let spikes=0, lifesteal=0, shieldPerAttack=0;
  // hand (weapon / off-hand): offensive
  if(gh.venom) apply.poison=(apply.poison||0)+gh.venom;
  if(gh.ember) apply.burn=(apply.burn||0)+gh.ember;
  if(gh.frost) apply.chill=(apply.chill||0)+gh.frost;
  if(gh.ward) shieldPerAttack=GEM_HAND.wardShield*gh.ward;
  if(gh.edge) crit+=0.15*gh.edge;
  if(gh.vital) lifesteal=GEM_HAND.vitalHeal*gh.vital;
  if(gh.swift) spd*=Math.pow(1.15,gh.swift);
  if(gh.gilt) gold.kill+=gh.gilt;
  // armor (body / head): defensive
  if(ga.venom) retaliate.poison=ga.venom;
  if(ga.ember) retaliate.burn=ga.ember;
  if(ga.frost) retaliate.chill=ga.frost;
  if(ga.ward){ armor+=ga.ward; startShield=5*ga.ward; }
  if(ga.edge) spikes=GEM_ARMOR.spikes*ga.edge;
  if(ga.vital){ hp+=12*ga.vital; regen=ga.vital; }
  if(ga.swift) dodge+=GEM_ARMOR.dodge*ga.swift;
  if(ga.gilt) gold.win+=ga.gilt;
  if(relics.includes('crownofthorns')) spikes+=3;
  const skills=activeSkills(h), passives=heroPassives(h); // class passives along the route stack
  const gemDefs=gemsOf(h).flatMap(gemLeaves).map(g=>GEMS[g]).filter(g=>g.rare);
  let hpMult=1, applyBonus=0, healBonus=0; // Mage root: +1 per on-hit status, +1 per ability heal
  skills.concat(passives,gemDefs).forEach(it=>{
    if(it.flag) flags[it.flag]=1; if(it.flags) it.flags.forEach(f=>flags[f]=1);
    applyBonus+=it.applyBonus||0; healBonus+=it.healBonus||0;
    if(it.mod){ hp+=it.mod.hp||0; atk+=it.mod.atk||0; armor+=it.mod.armor||0; crit+=it.mod.crit||0; dodge+=it.mod.dodge||0; if(it.mod.spdMult) spd*=it.mod.spdMult; if(it.mod.hpMult) hpMult*=it.mod.hpMult; }
    if(it.apply) for(const k in it.apply) apply[k]=(apply[k]||0)+it.apply[k];
    if(it.statusMult) statusMult*=it.statusMult; if(it.targetLowest) targetLowest=true;
    if(it.gold) for(const k in it.gold) gold[k]+=it.gold[k];
  });
  hp*=hpMult; armor=Math.max(0,armor); atk=Math.max(1,atk);
  const hpRaw=hp;
  if(relics.includes('warhorn')) atk+=2;
  if(relics.includes('luckycoin')) crit+=0.1;
  if(relics.includes('bloodpact')){ atk*=1.4; hp*=0.85; }
  if(relics.includes('bulwark')&&h.row==='front') armor+=2;
  if(relics.includes('huntinghorn')&&h.row==='back') spd*=1.25;
  if(relics.includes('cloak')) dodge+=0.1;
  if(relics.includes('boots')){ spd*=1.2; dodge+=0.1; }
  if(relics.includes('pactofhaste')) spd*=1.3;
  if(relics.includes('bloodidol')) atk*=1.3;
  return {maxHpRaw:Math.round(hpRaw),maxHp:Math.max(1,Math.round(hp)),atk:Math.round(atk),spd:Math.round(spd*100)/100,armor,crit,dodge,apply,statusMult,targetLowest,flags,startShield,regen,retaliate,spikes,lifesteal,shieldPerAttack,giltHand:gh.gilt||0,giltArmor:ga.gilt||0,skills,passives,gold,applyBonus,healBonus,gemHooks:gemDefs.map(g=>g.hooks||{})};
}

