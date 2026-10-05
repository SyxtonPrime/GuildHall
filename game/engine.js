
// ============================================================
//  GUILDHALL — engine (pure logic, no DOM)
// ============================================================
const ri=n=>Math.floor(Math.random()*n), pick=a=>a[ri(a.length)];
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=ri(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ENV=(k,d)=>+((typeof process!=='undefined'&&process.env&&process.env[k])||d); // tuning knobs the balance bot can override (browser: defaults)

// ---------- Heroes ----------
const REAPER_HP=46, REAPER_GAIN=3, REAPER_CAP=60;
const BURN_DMG=2; // Burn deals this × its stacks per tick (it halves each tick, so stacks are hard to build) // Reaper grows permanently with kills
const HEROES={
 knight:{tags:['shield', 'tank'],name:'Knight',row:'front',hp:58,atk:5,spd:0.8,armor:2,
  ab:L=>`Whenever another ally is hit, gain ${1+L} Shield.`,
  hooks:{onAllyHit:(u,ally,B)=>{ if(ally!==u) addShield(u,1+u.L,B); }}},
 berserker:{tags:['tank', 'rage'],name:'Berserker',row:'front',hp:48,atk:6,spd:0.9,
  ab:L=>`Whenever damaged, gain +${L} ATK for the rest of the battle.`,
  hooks:{onDamaged:(u,src,dmg,info,B)=>{ u.atk+=u.L*(u.flags.rampage?2:1); if(u.flags.frenzy) u.spd*=1.05; if(u.flags.bloodlust) heal(u,3,B,u); if(u.flags.wildrage) aliveEnemies(u,B).forEach(t=>applyStatus(u,t,'burn',1,B)); B.fx(u,`+${u.L} ATK`,'buff'); }}},
 rogue:{tags:['crit', 'kill'],name:'Rogue',row:'mid',hp:38,atk:6,spd:1.1,crit:0.3,critLv:0.1,
  ab:L=>`${30+10*(L-1)}% crit chance (×2). On kill, attacks again immediately (and again on each further kill).`,
  hooks:{onKill:(u,t,B)=>{ if(u.chain<KILL_CHAIN_MAX){u.chain++; attack(u,B); u.chain--;} }}},
 shieldmaiden:{tags:['shield'],name:'Shieldmaiden',row:'front',hp:56,atk:4,spd:0.9,armor:1,
  ab:L=>`Starts with ${10*L} Shield. Attacks deal bonus damage equal to ¼ of her current Shield.`,
  hooks:{onStart:(u,B)=>addShield(u,10*u.L,B), onAttack:(u,a,B)=>{ a.bonus+=Math.floor(u.shield/(u.flags.halfShield?2:4)); }}},
 ranger:{tags:['speed'],name:'Ranger',row:'back',hp:36,atk:5,spd:1.4,
  ab:L=>`Every 3rd attack deals ×${1+L} damage and targets the back row.`,
  hooks:{onAttack:(u,a,B)=>{ const n=u.flags.barrage?2:3; if(u.attacks%n===n-1){ a.mult*=(1+u.L); a.preferBack=true; const x=Object.assign({},a.extraApply); if(u.flags.firearrows) x.burn=(x.burn||0)+3; if(u.flags.poisontips) x.poison=(x.poison||0)+3; if(u.flags.explosive){ a.forceCrit=true; x.burn=(x.burn||0)+3; } if(Object.keys(x).length) a.extraApply=x; if(u.flags.volley&&aliveEnemies(u,B).some(f=>f.row==='back')) a.hitRow='back'; if(u.flags.rain){ a.hitAll=true; a.mult*=0.5; } } }}},
 apothecary:{tags:['poison'],name:'Apothecary',row:'back',hp:30,atk:3,spd:1.0,apply:L=>({poison:2*L}),
  ab:L=>`Attacks apply ${2*L} Poison.`},
 pyromancer:{tags:['burn'],name:'Pyromancer',row:'back',hp:28,atk:3,spd:0.75,hitAll:true,hitAllMult:0.6,apply:L=>({burn:L}),
  ab:L=>`Attacks hit ALL enemies for 60% damage and apply ${L} Burn to each.`},
 cleric:{tags:['heal'],name:'Cleric',row:'back',hp:38,atk:4,spd:0.9,
  ab:L=>`Every 2 seconds, heal the most injured ally ${7*L}.`,
  hooks:{onSecond:(u,B)=>{ if(u.secs%(u.flags.miracle?1:2)===0){ const n=Math.ceil(7*u.L*(u.flags.bigheal?1.5:1)); const ts=u.flags.radiance?alliesOf(u,B).filter(x=>x.alive):[lowestAlly(u,B)].filter(Boolean); ts.forEach(a=>{ heal(a,u.flags.radiance?Math.ceil(n/2):n,B,u); if(u.flags.blessing) addShield(a,4,B); if(u.flags.blessing2) addShield(a,6,B); if(u.flags.consecrate){ const e=randomEnemy(u,B); if(e) applyStatus(u,e,'burn',2,B); } if(u.flags.consecrate2){ const e=randomEnemy(u,B); if(e) applyStatus(u,e,'burn',4,B); } }); } }}},
 monk:{tags:['dodge'],name:'Monk',row:'front',hp:42,atk:5,spd:1.2,dodge:0.25,dodgeLv:0.1,
  ab:L=>`${25+10*(L-1)}% chance to dodge. Counterattacks after dodging.`,
  hooks:{onDodge:(u,src,B)=>{ if(u.flags.flow) u.spd*=1.1; if(u.chain<2){u.chain++; u.tmpMult=u.flags.palm?2:1; u.tmpCrit=!!u.flags.counterCrit; attack(u,B,src); if(u.flags.thousand) attack(u,B,src); u.tmpMult=1; u.tmpCrit=false; u.chain--;} }}},
 sniper:{tags:['kill'],name:'Sniper',row:'back',hp:30,atk:9,spd:0.8,targetLowest:true,
  ab:L=>`Targets the lowest-HP enemy. +${50*L}% damage against the back row.`,
  hooks:{onTarget:(u,t,a,B)=>{ if(t.row==='back') a.mult*=1+0.5*u.L; }}},
 ashwalker:{tags:['burn', 'shield'],name:'Ashwalker',row:'front',hp:54,atk:5,spd:0.85,armor:1,
  ab:L=>`Whenever Burn damages an enemy, gain ${L} Shield.`,
  hooks:{onBurnDamage:(u,t,d,B)=>addShield(u,u.flags.ashenheart?d:u.L,B)}},
 glacier:{tags:['chill', 'shield', 'tank'],name:'Glacier Warden',row:'front',hp:54,atk:4,spd:0.8,
  ab:L=>`Attackers that hit her gain 1 Chill. She takes −1 damage per Chill on her attacker (−2 at ★★★).`,
  hooks:{onDefend:(u,src,a,B)=>{ a.bonus-=(u.L>=3?2:1)*(src.st.chill||0); }, onDamaged:(u,src,d,info,B)=>{ if(info.type==='attack'&&src.alive) applyStatus(u,src,'chill',u.flags.permafrost?2:1,B); },
         onTarget:(u,t,a,B)=>{ if(u.flags.shatter&&t.st.chill>=5) a.bonus+=12; }}},
 duelist:{tags:['crit'],name:'Duelist',row:'mid',hp:40,atk:6,spd:1.1,
  ab:L=>`Every 3rd attack is a guaranteed crit. Her crits reduce the target's ATK by ${L+1}.`,
  hooks:{onAttack:(u,a,B)=>{ const n=u.flags.form?2:3; if(u.attacks%n===n-1) a.forceCrit=true; }, onHit:(u,t,d,B)=>{ if(u.lastCrit){ t.atk=Math.max(1,t.atk-u.L-1-(u.flags.shred?3:0)); B.fx(t,`-${u.L} ATK`,'miss'); if(u.flags.flourish) u.spd*=1.05; } },
         onDodge:(u,src,B)=>{ if(u.flags.riposte&&u.chain<2){u.chain++; attack(u,B,src); u.chain--;} }}},
 bloodmage:{tags:['heal'],name:'Blood Mage',row:'back',hp:34,atk:5,spd:0.9,
  ab:L=>`Heals the most injured ally for ${50*L}% of the attack damage she deals.`,
  hooks:{onHit:(u,t,d,B)=>{ const a=lowestAlly(u,B); if(a&&d>0){ const n=Math.ceil(d*(u.flags.crimson?1.0:0.5)*u.L); const ts=u.flags.lifetide?alliesOf(u,B).filter(x=>x.alive):[a]; ts.forEach(x=>{ if(u.flags.transfusion&&x.hp>=x.maxHp) addShield(x,n,B); else heal(x,n,B,u); }); } },
         onTarget:(u,t,a,B)=>{ if(u.flags.hemo) a.bonus+=Math.floor((1-t.hp/t.maxHp)*10); }}},
 // locked
 plaguedoctor:{tags:['poison', 'heal'],name:'Plague Doctor',row:'back',hp:34,atk:3,spd:0.9,apply:L=>({poison:L+1}),locked:'Defeat the Act 1 boss',
  ab:L=>`Attacks apply ${L+1} Poison. Whenever Poison damages an enemy, heal the most injured ally ${L}.`,
  hooks:{onPoisonDamage:(u,t,dmg,B)=>{ const a=lowestAlly(u,B); if(a) heal(a,u.L*(u.flags.remedy?3:1),B,u); },
         onKill:(u,t,B)=>{ if(u.flags.epidemic&&t.st_poisonAtDeath>0){ const o=randomEnemy(u,B); if(o) applyStatus(u,o,'poison',t.st_poisonAtDeath,B); } }}},
 bard:{tags:['speed'],name:'Bard',row:'back',hp:32,atk:2,spd:1.0,locked:'Reach Act 3',
  ab:L=>`Other allies attack ${12*L}% faster and have +${L} ATK.`,
  hooks:{onStart:(u,B)=>{ alliesOf(u,B).forEach(x=>{ if(x!==u){ x.spd*=1+0.12*u.L; x.atk+=u.L; } }); }}},
 frostmage:{tags:['chill'],name:'Frost Mage',row:'back',hp:34,atk:5,spd:0.9,apply:L=>({chill:1}),locked:'Win a run',
  ab:L=>`Attacks apply Chill (−10% speed each, max 5) and deal +${L} damage per Chill on the target.`,
  hooks:{onAttack:(u,a,B)=>{ if(u.flags.blizzard){ a.hitAll=true; a.mult*=0.5; } }, onTarget:(u,t,a,B)=>{ a.bonus+=u.L*(t.st.chill||0); if(u.flags.deepfreeze&&t.st.chill>=5) a.mult*=2; }}},
 reaper:{tags:['kill'],name:'Reaper',row:'front',hp:REAPER_HP,atk:8,spd:0.9,locked:'Slay 150 enemies in total',
  ab:L=>`Attacks execute enemies below ${15+5*L}% HP. Every kill permanently adds +${REAPER_GAIN} max HP (up to +${REAPER_CAP}) and heals ${5*L}.`,
  hooks:{onTarget:(u,t,a,B)=>{ if(t.hp<=t.maxHp*(0.15+0.05*u.L+(u.flags.dread?0.15:0)+(u.flags.grim?0.3:0))) a.execute=true; },
         onKill:(u,t,B)=>{ const h=u.hero; if(h){ const cur=h.bonusHp||0; const g=Math.min(REAPER_GAIN,REAPER_CAP-cur); if(g>0){ h.bonusHp=cur+g; u.maxHp+=g; B.fx(u,`+${g} max HP`,'buff'); } } heal(u,5*u.L,B); }}},
};
const BASE_HEROES=Object.keys(HEROES).filter(k=>!HEROES[k].locked);
const ROW_MAX=4; // cells per row, both sides
const defaultRow=id=>HEROES[id].row==='mid'?'back':HEROES[id].row; // 'mid' heroes start in the back and move with their skills

// ---------- Traits (chosen on training) ----------
const TRAITS={
 // hero paths (3 per hero, all shown at ★★, pick one)
 k_bastion:{tags:['shield'],hero:'knight',name:'Bastion',desc:'Shield gained is doubled',flag:'shieldMult2'},
 k_taunt:{tags:['shield'],hero:'knight',name:'Iron Wall',desc:'Starts with 15 Shield and +2 Armor',mod:{armor:2},hooks:{onStart:(u,B)=>addShield(u,15,B)}},
 k_thorn:{tags:['poison'],hero:'knight',name:'Thorned Shield',desc:'When his Shield absorbs a hit, the attacker gains 2 Poison',hooks:{onShieldAbsorb:(u,src,ab,B)=>applyStatus(u,src,'poison',2,B)}},
 b_blood:{tags:['heal'],hero:'berserker',name:'Bloodlust',desc:'Heal 3 whenever rage grants ATK',flag:'bloodlust'},
 b_frenzy:{tags:['speed'],hero:'berserker',name:'Frenzy',desc:'Rage also grants +5% attack speed',flag:'frenzy'},
 b_wild:{tags:['burn'],hero:'berserker',name:'Wildfire Rage',desc:'Whenever rage grants ATK, every enemy gains 1 Burn',flag:'wildrage'},
 r_assn:{tags:['poison'],hero:'rogue',name:'Assassinate',desc:'Crits apply 2 Poison',flag:'critPoison'},
 r_shadow:{tags:['dodge'],hero:'rogue',name:'Shadowstep',desc:'20% dodge',mod:{dodge:0.2}},
 r_cold:{tags:['chill'],hero:'rogue',name:'Cold Steel',desc:'Crits apply 2 Chill',flag:'critChill'},
 s_aegis:{tags:['shield'],hero:'shieldmaiden',name:'Aegis',desc:'Every 3 seconds, regain 6 Shield',hooks:{onSecond:(u,B)=>{ if(u.secs%3===0) addShield(u,6,B); }}},
 s_bash:{tags:['shield'],hero:'shieldmaiden',name:'Shield Bash',desc:'Bonus damage is ½ of Shield instead of ¼',flag:'halfShield'},
 s_frost:{tags:['chill'],hero:'shieldmaiden',name:'Frost Aegis',desc:'When her Shield absorbs a hit, the attacker gains 1 Chill',hooks:{onShieldAbsorb:(u,src,ab,B)=>applyStatus(u,src,'chill',1,B)}},
 ra_volley:{tags:['speed'],hero:'ranger',name:'Volley',desc:'Her 3rd attack hits every back-row enemy',flag:'volley'},
 ra_pierce:{tags:['speed'],hero:'ranger',name:'Piercing Arrows',desc:'Attacks ignore Armor',flag:'pierce'},
 ra_fire:{tags:['burn'],hero:'ranger',name:'Fire Arrows',desc:'Her 3rd attack also applies 3 Burn',flag:'firearrows'},
 a_cloud:{tags:['poison'],hero:'apothecary',name:'Toxic Cloud',desc:'Battle start: 3 Poison on every enemy',hooks:{onStart:(u,B)=>aliveEnemies(u,B).forEach(t=>applyStatus(u,t,'poison',3,B))}},
 a_volatile:{tags:['burn'],hero:'apothecary',name:'Volatile Brew',desc:'When her Poison damages an enemy, it also gains 1 Burn',hooks:{onPoisonDamage:(u,t,d,B)=>{ if(t.poisonSrc===u&&t.alive) applyStatus(u,t,'burn',1,B); }}},
 a_numb:{tags:['chill'],hero:'apothecary',name:'Numbing Toxin',desc:'Poison she applies also applies 1 Chill',flag:'numb'},
 p_inferno:{tags:['burn'],hero:'pyromancer',name:'Inferno',desc:'Her Burn decays by 1 instead of halving',flag:'slowBurn'},
 p_back:{tags:['burn'],hero:'pyromancer',name:'Backdraft',desc:'Hits everyone for 100% instead of 60%',flag:'aoeFull'},
 p_shock:{tags:['chill'],hero:'pyromancer',name:'Thermal Shock',desc:'Hitting a Chilled enemy deals +4 per Chill, then removes the Chill',hooks:{onTarget:(u,t,a,B)=>{ if(t.st.chill>0){ a.bonus+=4*t.st.chill; t.st.chill=0; } }}},
 c_bless:{tags:['shield'],hero:'cleric',name:'Blessing',desc:'Her heals also grant 4 Shield',flag:'blessing'},
 c_radiance:{tags:['heal'],hero:'cleric',name:'Radiance',desc:'Heals every ally instead, for half',flag:'radiance'},
 c_consec:{tags:['burn'],hero:'cleric',name:'Consecrate',desc:'Each heal also applies 2 Burn to a random enemy',flag:'consecrate'},
 m_flow:{tags:['speed'],hero:'monk',name:'Flow',desc:'Each dodge: +10% attack speed',flag:'flow'},
 m_palm:{tags:['dodge'],hero:'monk',name:'Iron Palm',desc:'Counterattacks deal ×2',flag:'palm'},
 m_pressure:{tags:['crit'],hero:'monk',name:'Pressure Point',desc:'Counterattacks always crit',flag:'counterCrit'},
 sn_head:{tags:['crit'],hero:'sniper',name:'Headshot',desc:'+35% crit chance',mod:{crit:0.35}},
 sn_pierce:{tags:['kill'],hero:'sniper',name:'Armor-Piercing',desc:'Attacks ignore Armor',flag:'pierce'},
 sn_venom:{tags:['poison'],hero:'sniper',name:'Venom Bolts',desc:'Crits apply 3 Poison',flag:'critPoison3'},
 pd_epid:{tags:['poison'],hero:'plaguedoctor',name:'Epidemic',desc:'When a poisoned enemy dies, its Poison jumps to another enemy',flag:'epidemic'},
 pd_rem:{tags:['heal'],hero:'plaguedoctor',name:'Remedy',desc:'Heals from Poison are tripled',flag:'remedy'},
 pd_miasma:{tags:['shield'],hero:'plaguedoctor',name:'Miasma',desc:'When Poison damages an enemy, every hero gains 1 Shield',hooks:{onPoisonDamage:(u,t,d,B)=>alliesOf(u,B).forEach(x=>addShield(x,1,B))}},
 bd_anthem:{tags:['speed'],hero:'bard',name:'Anthem',desc:'Other allies also +2 ATK',hooks:{onStart:(u,B)=>alliesOf(u,B).forEach(x=>{ if(x!==u) x.atk+=2; })}},
 bd_lull:{tags:['chill'],hero:'bard',name:'Lullaby',desc:'Enemies start with 3 Chill',hooks:{onStart:(u,B)=>aliveEnemies(u,B).forEach(t=>applyStatus(u,t,'chill',3,B))}},
 bd_war:{tags:['crit'],hero:'bard',name:'War Song',desc:'Other allies +15% crit chance',hooks:{onStart:(u,B)=>alliesOf(u,B).forEach(x=>{ if(x!==u) x.crit+=0.15; })}},
 f_deep:{tags:['chill'],hero:'frostmage',name:'Deep Freeze',desc:'Attacks on a 5-Chill target deal ×2',flag:'deepfreeze'},
 f_bliz:{tags:['chill'],hero:'frostmage',name:'Blizzard',desc:'Hits all enemies for 50%, chilling each',flag:'blizzard'},
 f_brittle:{tags:['crit'],hero:'frostmage',name:'Brittle',desc:'+10% crit chance per Chill on the target',hooks:{onTarget:(u,t,a,B)=>{ a.critBonus=(a.critBonus||0)+0.1*(t.st.chill||0); }}},
 re_harvest:{tags:['kill'],hero:'reaper',name:'Harvest',desc:'His kills grant all allies +2 ATK',hooks:{onKill:(u,t,B)=>alliesOf(u,B).forEach(x=>{ if(x.alive){x.atk+=2;} })}},
 re_dread:{tags:['kill'],hero:'reaper',name:'Dread',desc:'Execute threshold +15%',flag:'dread'},
 re_soul:{tags:['burn'],hero:'reaper',name:'Soul Fire',desc:'Executes set every enemy ablaze: 4 Burn',hooks:{onKill:(u,t,B)=>{ if(u.lastExec) aliveEnemies(u,B).forEach(x=>applyStatus(u,x,'burn',4,B)); }}},
 aw_cinder:{tags:['burn'],hero:'ashwalker',name:'Cinder Skin',desc:'Attackers that hit him gain 2 Burn',hooks:{onDamaged:(u,src,d,info,B)=>{ if(info.type==='attack'&&src.alive) applyStatus(u,src,'burn',2,B); }}},
 aw_pyre:{tags:['burn'],hero:'ashwalker',name:'Pyre',desc:'When an ally dies, every enemy gains 4 Burn',hooks:{onAllyDeath:(u,d,B)=>aliveEnemies(u,B).forEach(t=>applyStatus(u,t,'burn',4,B))}},
 aw_brim:{tags:['poison'],hero:'ashwalker',name:'Brimstone',desc:'When Burn damages an enemy, it also gains 1 Poison',hooks:{onBurnDamage:(u,t,d,B)=>{ if(t.alive) applyStatus(u,t,'poison',1,B); }}},
 gw_shatter:{tags:['chill'],hero:'glacier',name:'Shatter',desc:'Her attacks on 5-Chill targets deal +12',flag:'shatter'},
 gw_grip:{tags:['chill'],hero:'glacier',name:"Winter's Grip",desc:'All heroes deal +15% to Chilled enemies',flag:'wintersgrip'},
 gw_frozen:{tags:['shield'],hero:'glacier',name:'Frozen Armor',desc:'Whenever an enemy gains Chill, she gains 2 Shield',flag:'frozenarmor'},
 du_riposte:{tags:['dodge'],hero:'duelist',name:'Riposte',desc:'20% dodge; counterattacks after dodging',mod:{dodge:0.2},flag:'riposte'},
 du_flourish:{tags:['speed'],hero:'duelist',name:'Flourish',desc:'Each crit: +5% attack speed',flag:'flourish'},
 du_sear:{tags:['burn'],hero:'duelist',name:'Searing Blade',desc:'Crits apply 3 Burn',flag:'critBurn'},
 bm_sang:{tags:['heal'],hero:'bloodmage',name:'Sanguine Bond',desc:'All heroes heal 20% of their attack damage',flag:'sanguine'},
 bm_hemo:{tags:['kill'],hero:'bloodmage',name:'Hemorrhage',desc:'+1 damage per 10% HP the target is missing',flag:'hemo'},
 bm_trans:{tags:['shield'],hero:'bloodmage',name:'Transfusion',desc:'Her healing becomes Shield when the ally is at full HP',flag:'transfusion'},
};
// ---------- Fusions (★★★): trigger archetype → different output archetype ----------
const FUSIONS={
 fu_p_burn:{tr:'poison',out:'burn',name:'Caustic Fumes',desc:'When you apply Poison, also apply 1 Burn',hooks:{onApply:(u,k,t,n,B)=>{ if(k==='poison') applyStatus(u,t,'burn',1,B); }}},
 fu_p_chill:{tr:'poison',out:'chill',name:'Cold Venom',desc:'When you apply Poison, also apply 1 Chill',hooks:{onApply:(u,k,t,n,B)=>{ if(k==='poison') applyStatus(u,t,'chill',1,B); }}},
 fu_p_shield:{tr:'poison',out:'shield',name:'Antitoxin',desc:'Whenever your Poison damages an enemy, gain 2 Shield',hooks:{onPoisonDamage:(u,t,d,B)=>{ if(t.poisonSrc===u) addShield(u,2,B); }}},
 fu_p_crit:{tr:'poison',out:'crit',name:'Toxic Precision',desc:'+8% crit per Poison on the target (max +40%)',hooks:{onTarget:(u,t,a,B)=>{ a.critBonus=(a.critBonus||0)+Math.min(0.4,0.08*(t.st.poison||0)); }}},
 fu_p_heal:{tr:'poison',out:'heal',name:'Leech Culture',desc:'Whenever your Poison damages an enemy, heal the most injured ally 2',hooks:{onPoisonDamage:(u,t,d,B)=>{ if(t.poisonSrc===u) heal(lowestAlly(u,B),2,B,u); }}},
 fu_b_poison:{tr:'burn',out:'poison',name:'Acrid Smoke',desc:'When you apply Burn, also apply 1 Poison',hooks:{onApply:(u,k,t,n,B)=>{ if(k==='burn') applyStatus(u,t,'poison',1,B); }}},
 fu_b_chill:{tr:'burn',out:'chill',name:'Flash Freeze',desc:'Whenever your Burn damages an enemy, it gains 1 Chill',hooks:{onBurnDamage:(u,t,d,B)=>{ if(t.burnSrc===u&&t.alive) applyStatus(u,t,'chill',1,B); }}},
 fu_b_shield:{tr:'burn',out:'shield',name:'Heat Shield',desc:'Whenever your Burn damages an enemy, gain 2 Shield',hooks:{onBurnDamage:(u,t,d,B)=>{ if(t.burnSrc===u) addShield(u,2,B); }}},
 fu_b_heal:{tr:'burn',out:'heal',name:'Warmth',desc:'Whenever your Burn damages an enemy, heal the most injured ally 2',hooks:{onBurnDamage:(u,t,d,B)=>{ if(t.burnSrc===u) heal(lowestAlly(u,B),2,B,u); }}},
 fu_b_crit:{tr:'burn',out:'crit',name:'Glowing Marks',desc:'+8% crit per Burn on the target (max +40%)',hooks:{onTarget:(u,t,a,B)=>{ a.critBonus=(a.critBonus||0)+Math.min(0.4,0.08*(t.st.burn||0)); }}},
 fu_c_crit:{tr:'chill',out:'crit',name:'Brittle Edge',desc:'+8% crit per Chill on the target',hooks:{onTarget:(u,t,a,B)=>{ a.critBonus=(a.critBonus||0)+0.08*(t.st.chill||0); }}},
 fu_c_poison:{tr:'chill',out:'poison',name:'Frostbite',desc:'When you apply Chill, also apply 1 Poison',hooks:{onApply:(u,k,t,n,B)=>{ if(k==='chill') applyStatus(u,t,'poison',1,B); }}},
 fu_c_burn:{tr:'chill',out:'burn',name:'Thermal Clash',desc:'Hitting a Chilled enemy applies Burn equal to its Chill',hooks:{onTarget:(u,t,a,B)=>{ if(t.st.chill>0) a.extraApply=Object.assign({},a.extraApply,{burn:t.st.chill}); }}},
 fu_c_shield:{tr:'chill',out:'shield',name:'Rime',desc:'When you apply Chill, gain 2 Shield',hooks:{onApply:(u,k,t,n,B)=>{ if(k==='chill') addShield(u,2,B); }}},
 fu_k_poison:{tr:'crit',out:'poison',name:'Envenomed Crits',desc:'Crits apply 2 Poison',hooks:{onCrit:(u,t,B)=>applyStatus(u,t,'poison',2,B)}},
 fu_k_burn:{tr:'crit',out:'burn',name:'Searing Crits',desc:'Crits apply 2 Burn',hooks:{onCrit:(u,t,B)=>applyStatus(u,t,'burn',2,B)}},
 fu_k_chill:{tr:'crit',out:'chill',name:'Chilling Crits',desc:'Crits apply 2 Chill',hooks:{onCrit:(u,t,B)=>applyStatus(u,t,'chill',2,B)}},
 fu_k_shield:{tr:'crit',out:'shield',name:'Confident Strikes',desc:'Crits grant 4 Shield',hooks:{onCrit:(u,t,B)=>addShield(u,4,B)}},
 fu_k_heal:{tr:'crit',out:'heal',name:'Vital Strikes',desc:'Crits heal the most injured ally 4',hooks:{onCrit:(u,t,B)=>heal(lowestAlly(u,B),4,B,u)}},
 fu_s_burn:{tr:'shield',out:'burn',name:'Molten Ward',desc:'Whenever you gain Shield, a random enemy gains 1 Burn',hooks:{onShieldGain:(u,n,B)=>{ const e=randomEnemy(u,B); if(e) applyStatus(u,e,'burn',1,B); }}},
 fu_s_poison:{tr:'shield',out:'poison',name:'Blighted Ward',desc:'Whenever you gain Shield, a random enemy gains 1 Poison',hooks:{onShieldGain:(u,n,B)=>{ const e=randomEnemy(u,B); if(e) applyStatus(u,e,'poison',1,B); }}},
 fu_s_chill:{tr:'shield',out:'chill',name:'Glacial Ward',desc:'Whenever you gain Shield, a random enemy gains 1 Chill',hooks:{onShieldGain:(u,n,B)=>{ const e=randomEnemy(u,B); if(e) applyStatus(u,e,'chill',1,B); }}},
 fu_s_crit:{tr:'shield',out:'crit',name:'Bulwark Focus',desc:'+2% crit per Shield you have',hooks:{onAttack:(u,a,B)=>{ a.critBonus=(a.critBonus||0)+Math.min(0.6,0.02*u.shield); }}},
 fu_s_kill:{tr:'shield',out:'kill',name:'Shield Slam',desc:'Attacks deal +1 per 4 Shield you have',hooks:{onAttack:(u,a,B)=>{ a.bonus+=Math.floor(u.shield/4); }}},
 fu_h_shield:{tr:'heal',out:'shield',name:'Overheal',desc:'Healing beyond max HP becomes Shield',hooks:{onHeal:(u,t,r,w,B)=>{ if(w>0) addShield(t,w,B); }}},
 fu_h_burn:{tr:'heal',out:'burn',name:'Cleansing Flame',desc:'Whenever you heal an ally, a random enemy gains 1 Burn',hooks:{onHeal:(u,t,r,w,B)=>{ const e=randomEnemy(u,B); if(e) applyStatus(u,e,'burn',1,B); }}},
 fu_h_poison:{tr:'heal',out:'poison',name:'Blessed Blight',desc:'Whenever you heal an ally, a random enemy gains 1 Poison',hooks:{onHeal:(u,t,r,w,B)=>{ const e=randomEnemy(u,B); if(e) applyStatus(u,e,'poison',1,B); }}},
 fu_h_crit:{tr:'heal',out:'crit',name:'Inspire',desc:'Each time you heal an ally, they gain +4% crit for the battle',hooks:{onHeal:(u,t,r,w,B)=>{ t.crit+=0.04; }}},
 fu_h_speed:{tr:'heal',out:'speed',name:'Quickening',desc:'Each time you heal an ally, they gain +3% attack speed',hooks:{onHeal:(u,t,r,w,B)=>{ t.spd*=1.03; }}},
 fu_d_chill:{tr:'dodge',out:'chill',name:'Slippery',desc:'When you dodge, the attacker gains 2 Chill',hooks:{onDodge:(u,src,B)=>applyStatus(u,src,'chill',2,B)}},
 fu_d_poison:{tr:'dodge',out:'poison',name:'Evasive Sting',desc:'When you dodge, the attacker gains 2 Poison',hooks:{onDodge:(u,src,B)=>applyStatus(u,src,'poison',2,B)}},
 fu_d_shield:{tr:'dodge',out:'shield',name:'Untouchable',desc:'When you dodge, gain 4 Shield',hooks:{onDodge:(u,src,B)=>addShield(u,4,B)}},
 fu_x_burn:{tr:'kill',out:'burn',name:'Funeral Pyre',desc:'On kill, every enemy gains 2 Burn',hooks:{onKill:(u,t,B)=>aliveEnemies(u,B).forEach(e=>applyStatus(u,e,'burn',2,B))}},
 fu_x_poison:{tr:'kill',out:'poison',name:'Rot',desc:'On kill, every enemy gains 2 Poison',hooks:{onKill:(u,t,B)=>aliveEnemies(u,B).forEach(e=>applyStatus(u,e,'poison',2,B))}},
 fu_x_shield:{tr:'kill',out:'shield',name:'Trophy',desc:'On kill, every hero gains 3 Shield',hooks:{onKill:(u,t,B)=>alliesOf(u,B).forEach(x=>addShield(x,3,B))}},
 fu_x_heal:{tr:'kill',out:'heal',name:'Reap',desc:'On kill, heal the most injured ally 6',hooks:{onKill:(u,t,B)=>heal(lowestAlly(u,B),6,B,u)}},
 fu_t_poison:{tr:'tank',out:'poison',name:'Venom Skin',desc:'When hit by an attack, the attacker gains 1 Poison',hooks:{onDamaged:(u,src,d,info,B)=>{ if(info.type==='attack'&&src.alive) applyStatus(u,src,'poison',1,B); }}},
 fu_t_chill:{tr:'tank',out:'chill',name:'Frost Skin',desc:'When hit by an attack, the attacker gains 1 Chill',hooks:{onDamaged:(u,src,d,info,B)=>{ if(info.type==='attack'&&src.alive) applyStatus(u,src,'chill',1,B); }}},
 fu_t_burn:{tr:'tank',out:'burn',name:'Ember Skin',desc:'When hit by an attack, the attacker gains 1 Burn',hooks:{onDamaged:(u,src,d,info,B)=>{ if(info.type==='attack'&&src.alive) applyStatus(u,src,'burn',1,B); }}},
 fu_t_heal:{tr:'tank',out:'heal',name:'Second Wind',desc:'When hit, heal 1 (2 if below half HP)',hooks:{onDamaged:(u,src,d,info,B)=>heal(u,u.hp<u.maxHp/2?2:1,B,u)}},
 fu_r_burn:{tr:'rage',out:'burn',name:'Burning Fury',desc:'Attacks apply Burn equal to ⅓ of ATK gained this battle',hooks:{onStart:(u,B)=>{u.atk0=u.atk;}, onTarget:(u,t,a,B)=>{ const g=Math.floor((u.atk-u.atk0)/3); if(g>0) a.extraApply=Object.assign({},a.extraApply,{burn:g}); }}},
 fu_r_shield:{tr:'rage',out:'shield',name:'Iron Fury',desc:'Whenever rage grants ATK, gain 3 Shield',hooks:{onDamaged:(u,src,d,info,B)=>addShield(u,3,B)}},
 fu_n_status:{tr:'speed',out:'poison',name:'Rhythm of Rot',desc:'Every 4th attack applies 2 Poison and 2 Chill',hooks:{onAttack:(u,a,B)=>{ if(u.attacks%4===3) a.extraApply=Object.assign({},a.extraApply,{poison:2,chill:2}); }}},
 fu_n_burn:{tr:'speed',out:'burn',name:'Friction',desc:'Every 4th attack applies 3 Burn',hooks:{onAttack:(u,a,B)=>{ if(u.attacks%4===3) a.extraApply=Object.assign({},a.extraApply,{burn:3}); }}},
 fu_n_shield:{tr:'speed',out:'shield',name:'Cadence',desc:'Every 4th attack grants the most injured ally 4 Shield',hooks:{onAttack:(u,a,B)=>{ if(u.attacks%4===3) addShield(lowestAlly(u,B)||u,4,B); }}},
 fu_n_crit:{tr:'speed',out:'crit',name:'Tempo',desc:'Every 4th attack is a guaranteed crit',hooks:{onAttack:(u,a,B)=>{ if(u.attacks%4===3) a.forceCrit=true; }}},
};
const ARCH_LABEL={poison:'Poison',burn:'Burn',chill:'Chill',shield:'Shield',crit:'Crit',heal:'Healing',speed:'Tempo',dodge:'Dodge',kill:'Kills',tank:'Taking hits',rage:'Rage'};

// ---------- Gems (orbment-style) ----------
// Each gem slotted into a hero grants a small passive. Combinations of gems unlock that hero's unique skills.
const GEMS={
 venom:{name:'Venom',arch:'poison',letter:'V',cost:3,hand:'Attacks apply +1 Poison',armor:'Attackers that hit this hero gain 1 Poison'},
 ember:{name:'Ember',arch:'burn',letter:'E',cost:3,hand:'Attacks apply +1 Burn',armor:'Attackers that hit this hero gain 1 Burn'},
 frost:{name:'Frost',arch:'chill',letter:'F',cost:3,hand:'Attacks apply +1 Chill',armor:'Attackers that hit this hero gain 1 Chill'},
 ward:{name:'Ward',arch:'shield',letter:'W',cost:3,hand:'Gain 1 Shield with every attack',armor:'+1 Armor · start each fight with 5 Shield'},
 edge:{name:'Edge',arch:'crit',letter:'K',cost:3,hand:'+15% crit chance',armor:'Spiked: attackers that hit this hero take 2 damage'},
 vital:{name:'Vital',arch:'heal',letter:'H',cost:3,hand:'Each hit heals this hero 2',armor:'+12 HP · heal 1 every 2 seconds'},
 swift:{name:'Swift',arch:'speed',letter:'S',cost:3,hand:'+15% attack speed',armor:'+8% dodge'},
 gilt:{name:'Gilt',arch:'gold',letter:'G',cost:3,hand:'+1 gold for each enemy this hero kills',armor:'+1 gold after every won fight'},
 // rare: two essences + a bonus effect
 bloodstone:{name:'Bloodstone',rare:1,ess:['venom','vital'],cost:5,desc:'Venom + Vital. Whenever this hero\'s Poison damages an enemy, heal 1',hooks:{onPoisonDamage:(u,t,d,B)=>{ if(t.poisonSrc===u) heal(u,1,B,u); }}},
 hearthstone:{name:'Hearthstone',rare:1,ess:['ember','ward'],cost:5,desc:'Ember + Ward. When this hero\'s Shield absorbs a hit, the attacker gains 1 Burn',hooks:{onShieldAbsorb:(u,src,ab,B)=>applyStatus(u,src,'burn',1,B)}},
 rimeheart:{name:'Rimeheart',rare:1,ess:['frost','ward'],cost:5,desc:'Frost + Ward. Whenever this hero applies Chill, gain 1 Shield',hooks:{onApply:(u,k,t,n,B)=>{ if(k==='chill') addShield(u,1,B); }}},
 sunstone:{name:'Sunstone',rare:1,ess:['ember','edge'],cost:5,desc:'Ember + Edge. Crits apply +2 Burn',hooks:{onCrit:(u,t,B)=>applyStatus(u,t,'burn',2,B)}},
 quicksilver:{name:'Quicksilver',rare:1,ess:['swift','edge'],cost:5,desc:'Swift + Edge. Every 4th attack is a guaranteed crit',hooks:{onAttack:(u,a,B)=>{ if(u.attacks%4===3) a.forceCrit=true; }}},
 moonstone:{name:'Moonstone',rare:1,ess:['frost','vital'],cost:5,desc:'Frost + Vital. Whenever this hero applies Chill, heal the most injured ally 1',hooks:{onApply:(u,k,t,n,B)=>{ if(k==='chill') heal(lowestAlly(u,B),1,B,u); }}},
 ambergold:{name:'Ambergold',rare:1,ess:['gilt','edge'],cost:5,desc:'Gilt + Edge. +1 gold for each enemy this hero kills',gold:{kill:1}},
 verdigris:{name:'Verdigris',rare:1,ess:['venom','gilt'],cost:5,desc:'Venom + Gilt. Attacks apply +1 extra Poison',apply:{poison:1}},
 // rare: three essences with a drawback
 chaosshard:{name:'Chaos Shard',rare:2,ess:['venom','ember','frost'],cost:6,desc:'Venom + Ember + Frost. Drawback: −25% max HP',mod:{hpMult:0.75}},
 titanseye:{name:"Titan's Eye",rare:2,ess:['ward','vital','edge'],cost:6,desc:'Ward + Vital + Edge. Drawback: −25% attack speed',mod:{spdMult:0.75}},
 stormheart:{name:'Stormheart',rare:2,ess:['swift','edge','ember'],cost:6,desc:'Swift + Edge + Ember. Drawback: −2 Armor and −15 HP',mod:{armor:-2,hp:-15}},
 hollowpearl:{name:'Hollow Pearl',rare:2,ess:['venom','ward','swift'],cost:6,desc:'Venom + Ward + Swift. Drawback: this hero cannot be healed',flag:'noHeal'},
 midasheart:{name:'Midas Heart',rare:2,ess:['gilt','gilt','vital'],cost:6,desc:'Gilt ×2 + Vital. +2 gold after every won fight. Drawback: −4 ATK',mod:{atk:-4},gold:{win:2}},
};
for(const k in GEMS){ const g=GEMS[k]; if(g.hand&&!g.desc) g.desc=`Weapon/hand: ${g.hand} · Body/head: ${g.armor}`; if(!g.ess) g.ess=[k]; if(!g.letter) g.letter=''; if(!g.arch) g.arch=GEMS[g.ess[0]].arch; }
const GEM_BY_LETTER={}; for(const k in GEMS) if(GEMS[k].letter) GEM_BY_LETTER[GEMS[k].letter]=k;
const BASIC_GEMS=Object.keys(GEMS).filter(k=>!GEMS[k].rare), RARE_GEMS=Object.keys(GEMS).filter(k=>GEMS[k].rare);
const gemEss=id=>GEMS[id].ess;
// Merged gems (the Forge): one gem that carries every part's effects and counts as all of their essences for recipes.
// Parts may themselves be merged gems. Defined at runtime; a run stores {id,parts} pairs so they can be rebuilt on load.
function gemLeaves(id){ const d=GEMS[id]; return d&&d.merged?d.parts.flatMap(gemLeaves):[id]; }
function defineMergedGem(id,parts){ const ds=parts.map(q=>GEMS[q]); const leaves=parts.flatMap(gemLeaves);
  GEMS[id]={name:leaves.map(l=>GEMS[l].name).join(' · '),merged:true,parts:parts.slice(),ess:ds.flatMap(d=>d.ess),rare:3,cost:ds.reduce((a,d)=>a+d.cost,0),arch:ds[0].arch,letter:'',
    desc:'Composite of '+leaves.map(l=>GEMS[l].name).join(' + ')+': every part keeps its effect'}; return GEMS[id]; }
function restoreMergedGems(list){ (list||[]).forEach(m=>{ if(!GEMS[m.id]) defineMergedGem(m.id,m.parts); }); }
const SLOTS=L=>1+L; // ★ 2 slots, ★★ 3, ★★★ 4

// Per-hero skill trees. need = gem letters (V E F W K H S). ref = reuse a definition from TRAITS/FUSIONS.
// Per-hero skill trees, 10 each. Template: 1-gem primary stat · 1-gem secondary stat · 1-gem Gilt gold skill ·
// PP path · PX path · PY path · PPP capstone · PPZ cross capstone · PPPP ultimate · 4-gem mixed ultimate (cross-archetype build).
const st=(need,name,desc,mod,apply)=>{ const o={need,name,desc}; if(mod) o.mod=mod; if(apply) o.apply=apply; return o; };
const SKILLS={
 knight:[ st('W','Braced','+2 Armor',{armor:2}), st('H','Steadfast','+15 HP',{hp:15}),
  {need:'G',name:'Patron',desc:'Interest cap raised by 1 (3 → 4)',gold:{interest:1}},
  {need:'WW',ref:'k_bastion'}, {need:'WV',ref:'k_thorn'}, {need:'WH',ref:'k_taunt'},
  {need:'WWW',name:'Guild Aegis',desc:'Whenever he gains Shield, the most injured other ally gains half as much',hooks:{onShieldGain:(u,n,B)=>{ const a=alliesOf(u,B).filter(x=>x.alive&&x!==u); if(!a.length) return; const t=a.reduce((m,x)=>(x.hp/x.maxHp)<(m.hp/m.maxHp)?x:m); addShield(t,Math.ceil(n/2),B); }}},
  {need:'WWF',name:'Frozen Bulwark',desc:'When his Shield absorbs a hit, the attacker gains 1 Chill',hooks:{onShieldAbsorb:(u,src,ab,B)=>applyStatus(u,src,'chill',1,B)}},
  {need:'WWWW',name:'Unbreakable',desc:'Starts every fight with Shield equal to half his max HP',hooks:{onStart:(u,B)=>addShield(u,Math.floor(u.maxHp/2),B)}},
  {need:'WWVH',name:'Living Wall',desc:'When his Shield absorbs a hit: every ally heals 2 and the attacker gains 2 Poison',hooks:{onShieldAbsorb:(u,src,ab,B)=>{ alliesOf(u,B).forEach(x=>heal(x,2,B,u)); applyStatus(u,src,'poison',2,B); }}} ],
 berserker:[ st('E','Hot Blood','+3 ATK',{atk:3}), st('H','Thick Skin','+15 HP',{hp:15}),
  {need:'GE',name:"Warlord's Spoils",desc:'+4 gold after elite and boss wins',gold:{elite:4}},
  {need:'EE',ref:'b_wild'}, {need:'ES',ref:'b_frenzy'}, {need:'EH',ref:'b_blood'},
  {need:'EEE',name:'Rampage',desc:'Rage grants +2 ATK per hit instead of +1 (scales with ★)',flag:'rampage'},
  {need:'EEW',ref:'fu_r_shield'},
  {need:'EEEE',name:'Inferno Rage',desc:'+20 HP; attacks apply Burn equal to the ATK he has gained this battle',mod:{hp:20},hooks:{onStart:(u,B)=>{u.atk0=u.atk;}, onTarget:(u,t,a,B)=>{ const g=u.atk-u.atk0; if(g>0) a.extraApply=Object.assign({},a.extraApply,{burn:g}); }}},
  {need:'EEHS',name:'Blood Trance',desc:'Below half HP, each hit he takes grants double rage and heals him 5',hooks:{onDamaged:(u,src,d,info,B)=>{ if(u.hp<u.maxHp/2){ u.atk+=u.L; heal(u,5,B,u); } }}} ],
 rogue:[ st('K','Sharpened','+2 ATK',{atk:2}), st('S','Quick Hands','+12% attack speed',{spdMult:1.12}),
  {need:'G',name:'Pickpocket',desc:'+1 gold for each enemy he kills',gold:{kill:1}},
  {need:'KK',name:'Lethal',desc:'Crits deal ×3 instead of ×2',flag:'crit3'}, {need:'KV',ref:'r_assn'},
  {need:'KS',name:'Shadowstep',desc:'20% dodge. Slips back to the back row when he drops below 66% HP (once per fight)',mod:{dodge:0.2},flag:'retreat'},
  {need:'KKF',name:'Frozen Precision',desc:'Crits apply 2 Chill; +8% crit per Chill on the target',flag:'critChill',hooks:{onTarget:(u,t,a,B)=>{ a.critBonus=(a.critBonus||0)+0.08*(t.st.chill||0); }}},
  {need:'KKK',name:'Flurry',desc:'35% chance each attack also hits another enemy for 50%',hooks:{onAttackEnd:(u,t,B)=>{ if(Math.random()<0.35){ const o=randomEnemy(u,B,t); if(o) hit(u,o,{mult:0.5},B); } }}},
  {need:'KKKK',name:'Death Blossom',desc:'Each of his regular attacks that crits is followed by one extra attack (the extra attack cannot trigger this again)',hooks:{onAttack:(u,a,B)=>{ if(u.chain===0) u.blossomed=false; }, onCrit:(u,t,B)=>{ if(u.chain===0&&!u.blossomed){ u.blossomed=true; u.chain++; attack(u,B); u.chain--;} }}},
  {need:'KKVS',name:'Venom Dance',desc:'+20% dodge; dodging gives the attacker 3 Poison; crits apply 2 Poison',mod:{dodge:0.2},flags:['critPoison'],hooks:{onDodge:(u,src,B)=>applyStatus(u,src,'poison',3,B)}} ],
 shieldmaiden:[ st('W','Bulwark','+1 Armor, +10 HP',{armor:1,hp:10}), st('K','Precise','+15% crit chance',{crit:0.15}),
  {need:'GW',name:'Toll Keeper',desc:'+2 gold after every won fight',gold:{win:2}},
  {need:'WW',ref:'s_aegis'}, {need:'WK',ref:'s_bash'}, {need:'WF',ref:'s_frost'},
  {need:'WWW',ref:'k_bastion'}, {need:'WWK',ref:'fu_s_crit'},
  {need:'WWWW',name:'Aegis Eternal',desc:'Regains 6 Shield every second and starts with 20 extra Shield',hooks:{onStart:(u,B)=>addShield(u,20,B), onSecond:(u,B)=>addShield(u,6,B)}},
  {need:'WWKF',name:'Glacial Bash',desc:'Attacks deal +2 per Chill on the target; her crits apply 2 Chill',flag:'critChill',hooks:{onTarget:(u,t,a,B)=>{ a.bonus+=2*(t.st.chill||0); }}} ],
 ranger:[ st('S','Fleet','+15% attack speed',{spdMult:1.15}), st('K','Keen Eye','+15% crit chance',{crit:0.15}),
  st('V','Barbed Tips','Attacks apply +1 Poison',null,{poison:1}),
  {need:'SS',ref:'ra_volley'}, {need:'SK',ref:'ra_pierce'}, {need:'SE',ref:'ra_fire'},
  {need:'SSS',name:'Rain of Arrows',desc:'Her big shot hits every enemy (at half its damage)',flag:'rain'},
  {need:'SSV',name:'Poison Tips',desc:'Her big shot also applies 3 Poison',flag:'poisontips'},
  {need:'SSSS',name:'Barrage',desc:'Every 2nd attack is her big shot, instead of every 3rd',flag:'barrage'},
  {need:'SSKE',name:'Explosive Shot',desc:'Her big shot always crits and applies 3 Burn',flag:'explosive'} ],
 apothecary:[ st('V','Strong Brew','Attacks apply +1 Poison',null,{poison:1}), st('H','Tonic','+10 HP',{hp:10}),
  {need:'GV',name:"Apothecary's Trade",desc:'+3 gold after every won fight',gold:{win:3}},
  {need:'VV',ref:'a_cloud'}, {need:'VE',ref:'a_volatile'}, {need:'VF',ref:'a_numb'},
  {need:'VVV',name:'Plague',desc:'Poison she applies also spreads to another random enemy',flag:'virulent'},
  {need:'VVH',ref:'fu_p_heal'},
  {need:'VVVV',name:'Pandemic',desc:'Poison she applies is doubled',statusMult:2},
  {need:'VVEF',name:"Witch's Brew",desc:'Her Poison also applies 1 Burn and 1 Chill; attacks deal ×2 to enemies carrying all three',hooks:{onApply:(u,k,t,n,B)=>{ if(k==='poison'){ applyStatus(u,t,'burn',1,B); applyStatus(u,t,'chill',1,B); } }, onTarget:(u,t,a,B)=>{ if(t.st.poison>0&&t.st.burn>0&&t.st.chill>0) a.mult*=2; }}} ],
 pyromancer:[ st('E','Kindle','Attacks apply +1 Burn',null,{burn:1}), st('S','Quickfire','+15% attack speed',{spdMult:1.15}),
  st('K','Focused Flame','+15% crit chance',{crit:0.15}),
  {need:'EE',ref:'p_inferno'}, {need:'ES',ref:'p_back'}, {need:'EF',ref:'p_shock'},
  {need:'EEE',name:'Firestorm',desc:'Burn she applies is doubled',statusMult:2},
  {need:'EEW',ref:'fu_b_shield'},
  {need:'EEEE',name:'Conflagration',desc:'Whenever her Burn damages an enemy, every other enemy gains 1 Burn',hooks:{onBurnDamage:(u,t,d,B)=>{ if(t.burnSrc!==u) return; aliveEnemies(u,B).forEach(x=>{ if(x!==t){ x.st.burn=(x.st.burn||0)+1; x.burnSrc=u; } }); }}},
  {need:'EESK',name:'Blue Flame',desc:'Crits apply 3 Burn; attacks deal +1 per Burn on the target',flag:'critBurn',hooks:{onTarget:(u,t,a,B)=>{ a.bonus+=(t.st.burn||0); }}} ],
 cleric:[ st('H','Devout','+10 HP',{hp:10}), st('S','Hymn','+15% attack speed',{spdMult:1.15}),
  {need:'GH',name:'Tithe',desc:'Interest cap raised by 1 (3 → 4)',gold:{interest:1}},
  {need:'HH',ref:'c_radiance'}, {need:'HW',ref:'c_bless'}, {need:'HE',ref:'c_consec'},
  {need:'HHH',ref:'fu_h_shield'}, {need:'HHS',ref:'fu_h_speed'},
  {need:'HHHH',name:'Miracle',desc:'Heals every second instead of every 2 seconds, and her heals are 50% larger',flags:['miracle','bigheal']},
  {need:'HHWE',name:'Holy Fire',desc:'Her heals also grant 6 Shield and set a random enemy ablaze with 4 Burn',flags:['blessing2','consecrate2']} ],
 monk:[ st('S','Swift Feet','+15% attack speed',{spdMult:1.15}), st('K','Focus','+15% crit chance',{crit:0.15}),
  {need:'G',name:'Alms',desc:'+1 gold after every won fight',gold:{win:1}},
  {need:'SS',ref:'m_flow'}, {need:'SK',ref:'m_pressure'}, {need:'SH',ref:'m_palm'},
  {need:'SSS',name:'Serenity',desc:'+15% dodge; dodging grants 4 Shield. Falls back to the back row below 33% HP and steps forward again above 66%',mod:{dodge:0.15},flag:'weave',hooks:{onDodge:(u,src,B)=>addShield(u,4,B)}},
  {need:'SSF',ref:'fu_d_chill'},
  {need:'SSSS',name:'Thousand Palms',desc:'Counterattacks strike twice',flag:'thousand'},
  {need:'SSSH',name:'Inner Peace',desc:'Each dodge heals him 5. Meditates while in the back row, healing 5% of his max HP each second',flag:'meditate',hooks:{onDodge:(u,src,B)=>heal(u,5,B,u)}} ],
 sniper:[ st('K','Steady Aim','+15% crit chance',{crit:0.15}), st('S','Quick Reload','+15% attack speed',{spdMult:1.15}),
  {need:'G',name:'Bounty Hunter',desc:'+1 gold for each enemy he kills',gold:{kill:1}},
  {need:'KK',ref:'sn_head'}, {need:'KS',ref:'sn_pierce'}, {need:'KV',ref:'sn_venom'},
  {need:'KKK',name:'Killshot',desc:'Crits deal ×3 instead of ×2',flag:'crit3'},
  {need:'KKE',name:'Incendiary Rounds',desc:'Crits apply 3 Burn; +2 ATK',flag:'critBurn',mod:{atk:2}},
  {need:'KKKK',name:'Deadeye',desc:'+25% crit; attacks against enemies below half HP always crit and deal ×2',mod:{crit:0.25},hooks:{onTarget:(u,t,a,B)=>{ if(t.hp<t.maxHp/2){ a.forceCrit=true; a.mult*=2; } }}},
  {need:'KKSV',name:"Assassin's Mark",desc:'Attacks ignore Armor, apply 2 Poison and deal +3 per Poison on the target',flag:'pierce',apply:{poison:2},hooks:{onTarget:(u,t,a,B)=>{ a.bonus+=3*(t.st.poison||0); }}} ],
 ashwalker:[ st('E','Smolder','+2 ATK',{atk:2}), st('W','Ash Plate','+1 Armor',{armor:1}),
  {need:'GE',name:'Ashes to Gold',desc:'+1 gold for each enemy he kills',gold:{kill:1}},
  {need:'EE',ref:'aw_cinder'}, {need:'EH',ref:'aw_pyre'}, {need:'EV',ref:'aw_brim'},
  {need:'EEE',ref:'fu_b_chill'}, {need:'EEW',ref:'fu_b_shield'},
  {need:'EEEE',name:'Ashen Heart',desc:'Shield gained from Burn damage equals the damage dealt, instead of ★',flag:'ashenheart'},
  {need:'EEWH',name:'Phoenix Ash',desc:'The first time he drops below 30% HP, he heals half his max HP and every enemy gains 5 Burn',hooks:{onDamaged:(u,src,d,info,B)=>{ if(!u.flags._phx&&u.hp<u.maxHp*0.3){ u.flags._phx=1; heal(u,Math.floor(u.maxHp/2),B,u); aliveEnemies(u,B).forEach(t=>applyStatus(u,t,'burn',5,B)); } }}} ],
 glacier:[ st('F','Cold Blood','+10 HP',{hp:10}), st('W','Rime Plate','+1 Armor',{armor:1}),
  st('K','Cold Edge','+15% crit chance',{crit:0.15}),
  {need:'FF',ref:'gw_grip'}, {need:'FK',ref:'gw_shatter'}, {need:'FW',ref:'gw_frozen'},
  {need:'FFF',name:'Permafrost',desc:'Attackers that hit her gain 2 Chill instead of 1',flag:'permafrost'},
  {need:'FFW',ref:'fu_c_shield'},
  {need:'FFFF',name:'Absolute Zero',desc:'Enemies at 5 Chill take +50% damage from every hero',flag:'abszero'},
  {need:'FFWK',name:"Glacier's Edge",desc:'+8% crit and +2 damage per Chill on her target',hooks:{onTarget:(u,t,a,B)=>{ const c=t.st.chill||0; a.critBonus=(a.critBonus||0)+0.08*c; a.bonus+=2*c; }}} ],
 duelist:[ st('K','En Garde','+15% crit chance',{crit:0.15}), st('S','Footwork','+15% attack speed',{spdMult:1.15}),
  st('E','Hot Temper','+2 ATK',{atk:2}),
  {need:'KK',ref:'du_flourish'},
  {need:'KS',name:'Riposte',desc:'20% dodge; counterattacks after dodging. Vanguard: steps up to the front row the moment it empties',mod:{dodge:0.2},flags:['riposte','vanguard']},
  {need:'KE',ref:'du_sear'},
  {need:'KKK',name:'Perfect Form',desc:'Every 2nd attack is a guaranteed crit (instead of every 3rd)',flag:'form'},
  {need:'KKF',ref:'fu_k_chill'},
  {need:'KKKK',name:'Coup de Grâce',desc:'+20% crit, +3 ATK, +15 HP; crits deal ×3 and shred 3 extra ATK from the target',mod:{crit:0.2,atk:3,hp:15},flags:['crit3','shred']},
  {need:'KKSF',name:'Dancing Blade',desc:'+20% dodge; dodging gives the attacker 2 Chill',mod:{dodge:0.2},hooks:{onDodge:(u,src,B)=>applyStatus(u,src,'chill',2,B)}} ],
 bloodmage:[ st('H','Vigor','+10 HP',{hp:10}), st('V','Hemotoxin','Attacks apply +1 Poison',null,{poison:1}),
  st('K','Keen Sight','+15% crit chance',{crit:0.15}),
  {need:'HH',ref:'bm_sang'}, {need:'HK',ref:'bm_hemo'}, {need:'HW',ref:'bm_trans'},
  {need:'HHH',name:'Crimson Tide',desc:'Her healing ratio is doubled',flag:'crimson'},
  {need:'HHV',ref:'fu_h_poison'},
  {need:'HHHH',name:'Life Tide',desc:'Her healing reaches every ally instead of only the most injured; +4 ATK',flag:'lifetide',mod:{atk:4}},
  {need:'HHVK',name:'Bloodletting',desc:'Crits apply 3 Poison; her Poison damage heals the most injured ally for half of it',flag:'critPoison3',hooks:{onPoisonDamage:(u,t,d,B)=>{ if(t.poisonSrc===u) heal(lowestAlly(u,B),Math.ceil(d/2),B,u); }}} ],
 plaguedoctor:[ st('V','Miasmic','Attacks apply +1 Poison',null,{poison:1}), st('H','Bedside Manner','+10 HP',{hp:10}),
  {need:'G',name:'House Call',desc:'+1 gold after every won fight',gold:{win:1}},
  {need:'VV',ref:'pd_epid'}, {need:'VH',ref:'pd_rem'}, {need:'VW',ref:'pd_miasma'},
  {need:'VVV',name:'Contagion',desc:'Poison he applies also spreads to another random enemy',flag:'virulent'},
  {need:'VVE',name:"Alchemist's Flask",desc:'Poison and Burn he applies deal +50% on targets that have both',flag:'flask'},
  {need:'VVVV',name:'Black Death',desc:'When a poisoned enemy dies, every enemy gains its Poison',hooks:{onKill:(u,t,B)=>{ const n=t.st_poisonAtDeath; if(n>0) aliveEnemies(u,B).forEach(o=>applyStatus(u,o,'poison',n,B)); }}},
  {need:'VVHW',name:'Quarantine',desc:'Whenever his Poison damages an enemy, the most injured ally heals 2 and gains 2 Shield',hooks:{onPoisonDamage:(u,t,d,B)=>{ if(t.poisonSrc!==u) return; const a=lowestAlly(u,B); heal(a,2,B,u); addShield(a,2,B); }}} ],
 bard:[ st('S','Tempo','+15% attack speed',{spdMult:1.15}), st('H','Encore','+10 HP',{hp:10}),
  {need:'G',name:'Busking',desc:'+2 gold after every won fight',gold:{win:2}},
  {need:'SS',ref:'bd_anthem'}, {need:'SF',ref:'bd_lull'}, {need:'SK',ref:'bd_war'},
  {need:'SSS',name:'Crescendo',desc:'Other allies attack another 25% faster',hooks:{onStart:(u,B)=>{ alliesOf(u,B).forEach(x=>{ if(x!==u) x.spd*=1.25; }); }}},
  {need:'SSH',name:'Ballad',desc:'Every 2 seconds, every ally heals 3',hooks:{onSecond:(u,B)=>{ if(u.secs%2===0) alliesOf(u,B).forEach(x=>heal(x,3,B,u)); }}},
  {need:'SSSS',name:'Symphony',desc:'Other allies start with +30% speed, +4 ATK and +20% crit',hooks:{onStart:(u,B)=>{ alliesOf(u,B).forEach(x=>{ if(x!==u){ x.spd*=1.3; x.atk+=4; x.crit+=0.2; } }); }}},
  {need:'SSFE',name:'Dirge',desc:'Enemies start the fight with 4 Chill, 4 Burn and −2 ATK',hooks:{onStart:(u,B)=>aliveEnemies(u,B).forEach(t=>{ applyStatus(u,t,'chill',4,B); applyStatus(u,t,'burn',4,B); t.atk=Math.max(1,t.atk-2); })}} ],
 frostmage:[ st('F','Cold Focus','+2 ATK',{atk:2}), st('K','Sharp Ice','+15% crit chance',{crit:0.15}),
  st('W','Ice Armor','+1 Armor, +5 HP',{armor:1,hp:5}),
  {need:'FF',ref:'f_bliz'}, {need:'FK',ref:'f_brittle'}, {need:'FE',ref:'fu_c_burn'},
  {need:'FFF',ref:'f_deep'}, {need:'FFW',ref:'fu_c_shield'},
  {need:'FFFF',name:'Shatterpoint',desc:'Hitting a 5-Chill enemy deals +15 and shatters the Chill',hooks:{onTarget:(u,t,a,B)=>{ if(t.st.chill>=5){ a.bonus+=15; t.st.chill=0; } }}},
  {need:'FFKE',name:'Frostfire',desc:'Crits apply 3 Burn; attacks deal +1 per Burn on the target',flag:'critBurn',hooks:{onTarget:(u,t,a,B)=>{ a.bonus+=(t.st.burn||0); }}} ],
 reaper:[ st('K','Whetted Scythe','+2 ATK',{atk:2}), st('H','Grave Vigor','+10 HP',{hp:10}),
  {need:'GK',name:'Death Tax',desc:'+1 gold for each enemy he kills',gold:{kill:1}},
  {need:'KK',ref:'re_dread'}, {need:'KE',ref:'re_soul'}, {need:'KS',ref:'re_harvest'},
  {need:'KKK',ref:'fu_x_heal'}, {need:'KKW',ref:'fu_x_shield'},
  {need:'KKKK',name:'Grim Harvest',desc:'Execute threshold +30%, +3 ATK; his kills heal every ally 5',flag:'grim',mod:{atk:3},hooks:{onKill:(u,t,B)=>alliesOf(u,B).forEach(x=>heal(x,5,B,u))}},
  {need:'KKEV',name:'Plague Reaper',desc:'Attacks apply 2 Poison and 2 Burn; on kill, every enemy gains 4 of each; +2 ATK',mod:{atk:2},apply:{poison:2,burn:2},hooks:{onKill:(u,t,B)=>aliveEnemies(u,B).forEach(e=>{ applyStatus(u,e,'poison',4,B); applyStatus(u,e,'burn',4,B); })}} ],
};
const ABIL=Object.assign({},TRAITS,FUSIONS);
function skillDef(sk){ return sk.ref?Object.assign({},ABIL[sk.ref],{need:sk.need}):sk; }
function needCounts(need){ const c={}; for(const ch of need){ const g=GEM_BY_LETTER[ch]; c[g]=(c[g]||0)+1; } return c; }
function gemsOf(h){ return (h.gems||[]).filter(Boolean); } // h.gems[k] = gem in slot k (weapon, body, head, off-hand) or null when that slot is empty
function gemCounts(h){ const c={}; gemsOf(h).forEach(g=>gemEss(g).forEach(e=>c[e]=(c[e]||0)+1)); return c; } // essences, for recipes
function essenceCounts(h){ const c={}; gemsOf(h).forEach(g=>{ const d=GEMS[g]; (!d.rare?[g]:d.ess.length>=3?d.ess:[]).forEach(e=>c[e]=(c[e]||0)+1); }); return c; } // Prismatic Lens: 3-essence gems grant every essence's passive
// Gear slots: 0 weapon & 3 off-hand = 'hand' (offensive passive), 1 body & 2 head = 'armor' (defensive passive)
const GEM_HAND={wardShield:1,vitalHeal:2}, GEM_ARMOR={spikes:2,dodge:0.08};
const HAND_SLOTS=[0,3], slotKind=(k,h)=>(HAND_SLOTS.includes(k)!==!!(h&&h.flip&&h.flip.includes(k)))?'hand':'armor'; // h.flip: sockets the Enchanter has turned to the other kind
function slotCounts(h,prism){ const c={hand:{},armor:{}}; (h.gems||[]).forEach((g,k)=>{ if(!g) return; const t=c[slotKind(k,h)]; gemLeaves(g).forEach(l=>{ const d=GEMS[l]; const es=!d.rare?[l]:(prism&&d.ess.length>=3?d.ess:[]); es.forEach(e=>t[e]=(t[e]||0)+1); }); }); return c; }
function basicCounts(h){ const c={}; gemsOf(h).forEach(g=>{ if(!GEMS[g].rare) c[g]=(c[g]||0)+1; }); return c; } // passives come only from basic gems
function skillActive(h,sk){ const have=gemCounts(h), need=needCounts(sk.need); return Object.keys(need).every(g=>(have[g]||0)>=need[g]); }
function heroSkills(id){ return (SKILLS[id]||[]).map(skillDef); }
function activeSkills(h){ return heroSkills(h.id).filter(sk=>skillActive(h,sk)); }
const skillArch=sk=>GEMS[GEM_BY_LETTER[sk.need[0]]].arch;

// ---------- Relics (guild-wide) ----------
const RELICS={
 warhorn:{name:'Warhorn',tier:'common',cost:6,desc:'All heroes +2 ATK'},
 bloodpact:{name:'Blood Pact',tier:'common',cost:5,desc:'All heroes +40% ATK, −15% max HP'},
 bulwark:{name:'Bulwark Standard',tier:'common',cost:6,desc:'Front-row heroes +2 Armor'},
 huntinghorn:{name:'Hunting Horn',tier:'common',cost:6,desc:'Back-row heroes +25% attack speed'},
 hourglass:{name:'Cracked Hourglass',tier:'common',cost:5,desc:'For the first 3 seconds, heroes attack 50% faster',
  hooks:{onStart:(u,B)=>{u.spd*=1.5;}, onSecond:(u,B)=>{ if(u.secs===3) u.spd/=1.5; }}},
 plaguebanner:{name:'Plague Banner',tier:'rare',cost:7,desc:'Whenever a hero applies Poison, apply 1 more'},
 kindling:{name:'Kindling',tier:'rare',cost:7,desc:'Burn applied by heroes deals double damage'},
 coinpurse:{name:'Deep Purse',tier:'common',cost:6,desc:'+2 gold after every fight'},
 phoenix:{name:'Phoenix Feather',tier:'rare',cost:8,desc:'Once per battle, the first hero to die revives at half HP',
  hooks:{onDeath:(u,B)=>{ if(!B.phoenixUsed){ B.phoenixUsed=true; u.alive=true; u.hp=Math.ceil(u.maxHp/2); B.fx(u,'REVIVE','heal'); B.logf(`${u.name} rises again!`); } }}},
 drums:{name:'Drums of War',tier:'common',cost:6,desc:'Every 3 seconds, all heroes gain +1 ATK',
  hooks:{onSecond:(u,B)=>{ if(u.secs%3===0){u.atk+=1;} }}},
 wildfire:{name:'Wildfire',tier:'rare',cost:7,desc:'Whenever Burn damages an enemy, 1 Burn spreads to another enemy'},
 glacialcore:{name:'Glacial Core',tier:'common',cost:5,desc:'Attacks on Chilled enemies deal +1 per Chill'},
 mirrorward:{name:'Mirror Ward',tier:'rare',cost:7,desc:"When a hero's Shield absorbs damage, the attacker takes that much"},
 luckycoin:{name:'Lucky Coin',tier:'common',cost:6,desc:'All heroes +10% crit. Crits heal the attacker 3'},
 resonance:{name:'Resonance',tier:'rare',cost:7,desc:'Enemies carrying 3 different statuses take +30% damage from everything'},
 steam:{name:'Steam Engine',tier:'common',cost:5,desc:'Burn on Chilled enemies deals double'},
 rally:{name:'Rally Banner',tier:'common',cost:5,desc:'Whenever a hero dies, the others gain +3 ATK',
  hooks:{onAllyDeath:(u,d,B)=>{ u.atk+=3; B.fx(u,'+3 ATK','buff'); }}},
 // --- v28 ---
 scales:{name:"Merchant's Scales",tier:'common',cost:5,desc:'Rerolls cost 1 less'},
 cloak:{name:'Cloak of Shadows',tier:'rare',cost:7,desc:'All heroes +10% dodge. Dodging grants 3 Shield',
  hooks:{onDodge:(u,src,B)=>{ if(u.hero) addShield(u,3,B); }}},
 boots:{name:"Skirmisher's Boots",tier:'rare',cost:7,desc:'All heroes +20% attack speed and +10% dodge, but enemies can target the back row even while the front row stands'},
 tithe:{name:'Tithe Box',tier:'rare',cost:7,desc:'+1 gold for each enemy killed by Poison or Burn'},
 iron:{name:'Iron Discipline',tier:'rare',cost:8,desc:'The first time each hero would fall in a fight, they hold on at 1 HP instead'},
 smoke:{name:'Smoke Bomb',tier:'legendary',cost:9,desc:'The first time each hero drops below 50% HP, they vanish in smoke: they slip to the back row and cannot be targeted for 3 seconds'},
 marching:{name:'Marching Orders',tier:'legendary',cost:8,desc:'When a front-row hero falls, the healthiest back-row hero steps up to take their place, gaining Shield equal to their max HP'},
 grimoire:{name:"Necromancer's Grimoire",tier:'legendary',cost:10,desc:'Each enemy your guild slays rises as a Skeleton that fights for you until the battle ends'},
 contract:{name:'Contract of Blood',tier:'legendary',cost:9,desc:'+1 hero slot. In every fight, heroes in the front row lose 1 HP each second',
  hooks:{onSecond:(u,B)=>{ if(u.hero&&u.row==='front') dealDamage(null,u,1,{type:'drain',ignoreArmor:true,ignoreShield:true,silent:true},B); }}},
 prism:{name:'Prismatic Lens',tier:'legendary',cost:10,desc:'Gems with 3 essences also grant the passive effect of each essence they hold'},
 chalice:{name:'Overflowing Chalice',tier:'legendary',cost:9,desc:'Every hero heals 1 HP each second. Healing beyond max HP becomes Shield',
  hooks:{onSecond:(u,B)=>{ if(u.hero) heal(u,1,B,u); }}},
 twinaegis:{name:'Twin Aegis',tier:'legendary',cost:8,desc:'Whenever a hero gains Shield, another random hero gains the same amount'},
};
const RELIC_TIERS=['common','rare','legendary'], TIER_LABEL={common:'Common',rare:'Rare',legendary:'Legendary'};
const relicsOfTier=(t,owned)=>Object.keys(RELICS).filter(k=>RELICS[k].tier===t&&!(owned||[]).includes(k));


// ---------- Enemies ----------
// Each one has a mechanic that changes how a fight plays, not just numbers.
const ENEMIES={
 // --- Act 1: forest & cave ---
 goblin:{name:'Goblin',row:'front',hp:16,atk:3,spd:1.2,ab:'Cowardly: attacks 30% faster while another Goblin is alive.',
  hooks:{onAttack:(u,a,B)=>{ if(alliesOf(u,B).some(x=>x!==u&&x.alive&&x.eid==='goblin')) u.timer+=0.3; }}},
 archer:{name:'Goblin Archer',row:'back',hp:12,atk:4,spd:1.0,ab:'Aims at the back row when it can.',hooks:{onAttack:(u,a)=>{ a.preferBack=true; }}},
 spider:{name:'Cave Spider',row:'front',hp:20,atk:3,spd:1.1,apply:{poison:2},ab:'Attacks apply 2 Poison.'},
 wolf:{name:'Warg',row:'front',hp:18,atk:4,spd:1.4,ab:'On kill, +50% speed.',hooks:{onKill:(u)=>{u.spd*=1.5;}}},
 shaman:{name:'Shaman',row:'back',hp:22,atk:2,spd:0.8,ab:'Every 2s, heals its most injured ally 4.',
  hooks:{onSecond:(u,B)=>{ if(u.secs%2===0){const a=lowestAlly(u,B); if(a) heal(a,4,B);} }}},
 rat:{name:'Giant Rat',row:'front',hp:12,atk:2,spd:1.5,ab:'Swarm: +1 ATK for every other Rat alive.',
  hooks:{onAttack:(u,a,B)=>{ a.bonus+=alliesOf(u,B).filter(x=>x!==u&&x.alive&&x.eid==='rat').length; }}},
 bat:{name:'Cave Bat',row:'back',hp:10,atk:3,spd:1.3,dodge:0.35,ab:'35% dodge. Erratic: half its attacks go for the back row.',
  hooks:{onAttack:(u,a)=>{ if(Math.random()<0.5) a.preferBack=true; }}},
 slime:{name:'Slime',row:'front',hp:22,atk:3,spd:0.8,ab:'Splits into two Slimelets when it dies.',
  hooks:{onDeath:(u,B)=>{ for(let i=0;i<2;i++) spawnEnemy(B,'slimelet',u.row); }}},
 spiderling:{name:'Spiderling',row:'front',hp:8,atk:2,spd:1.2,minion:true,spr:'spider',apply:{poison:1},ab:'A Broodmother hatchling. Attacks apply 1 Poison.'},
 slimelet:{name:'Slimelet',row:'front',hp:8,atk:2,spd:1.0,minion:true,spr:'slime',ab:'Half a Slime.'},
 kobold:{name:'Kobold',row:'front',hp:20,atk:4,spd:1.0,ab:'Spear: every 3rd attack reaches the back row for ×1.5.',
  hooks:{onAttack:(u,a)=>{ if(u.attacks%3===2){ a.preferBack=true; a.mult*=1.5; } }}},
 sporeling:{name:'Sporeling',row:'front',hp:14,atk:2,spd:0.9,ab:'Bursts on death: every hero gains 3 Poison.',
  hooks:{onDeath:(u,B)=>{ aliveEnemies(u,B).forEach(t=>applyStatus(u,t,'poison',3,B)); }}},
 // --- Act 2: crypt & ruins ---
 orc:{name:'Orc',row:'front',hp:44,atk:6,spd:0.7,ab:'Brute: attacks deal +50% to targets below half HP.',hooks:{onTarget:(u,t,a)=>{ if(t.hp<t.maxHp/2) a.mult*=1.5; }}},
 skeleton:{name:'Skeleton',row:'front',hp:26,atk:4,spd:0.9,armor:3,ab:'3 Armor.'},
 imp:{name:'Imp',row:'back',hp:18,atk:3,spd:1.0,apply:{burn:1},ab:'Attacks apply 1 Burn.'},
 wraith:{name:'Wraith',row:'back',hp:24,atk:5,spd:0.9,dodge:0.3,ab:'30% dodge.'},
 bandit:{name:'Bandit',row:'front',hp:30,atk:5,spd:1.0,crit:0.25,ab:'25% crit. Steals 1 gold on each crit.',hooks:{onHit:(u,t,d,B)=>{ if(u.lastCrit) B.bounty-=1; }}},
 zombie:{name:'Zombie',row:'front',hp:40,atk:5,spd:0.6,ab:'Undying: the first time it dies, it rises again at a third of its HP.',
  hooks:{onDeath:(u,B)=>{ if(!u.rose){ u.rose=true; u.alive=true; u.hp=Math.ceil(u.maxHp/3); B.fx(u,'RISES','buff'); B.logf(`${u.name} rises again.`); } }}},
 ghoul:{name:'Ghoul',row:'front',hp:28,atk:5,spd:1.0,crit:0.25,ab:'25% crit. Feeds: heals for half the damage it deals.',hooks:{onHit:(u,t,d,B)=>heal(u,Math.ceil(d/2),B)}},
 gargoyle:{name:'Gargoyle',row:'front',hp:34,atk:6,spd:0.5,armor:4,ab:'4 Armor. Stone: takes no Poison or Burn damage.',flags:{stone:1}},
 necromancer:{name:'Necromancer',row:'back',hp:22,atk:2,spd:0.8,ab:'Every 4s, raises a Skeleton (up to 6 enemies).',
  hooks:{onSecond:(u,B)=>{ if(u.secs%4===0) spawnEnemy(B,'skeleton','front'); }}},
 mimic:{name:'Mimic',row:'front',hp:30,atk:6,spd:0.7,ab:'Starts with 20 Shield. Drops 4 gold when killed.',
  hooks:{onStart:(u,B)=>addShield(u,20,B), onDeath:(u,B)=>{ if(!u.alive){ B.bounty+=4; B.logf('The Mimic spills 4 gold.'); } }}},
 // --- Act 3: the deep ---
 troll:{name:'Troll',row:'front',hp:64,atk:7,spd:0.6,ab:'Regenerates 3 HP per second (stops while Burning).',hooks:{onSecond:(u,B)=>{ if(!(u.st.burn>0)) heal(u,3,B); }}},
 cultist:{name:'Cultist',row:'back',hp:20,atk:3,spd:0.9,ab:'+3 ATK whenever an ally dies.',hooks:{onAllyDeath:(u)=>{u.atk+=3;}}},
 darkknight:{name:'Dark Knight',row:'front',hp:38,atk:6,spd:0.8,armor:2,ab:'2 Armor. Shieldbreaker: attacks deal ×1.5 against a Shielded target.',hooks:{onTarget:(u,t,a)=>{ if(t.shield>0) a.mult*=1.5; }}},
 fireelemental:{name:'Fire Elemental',row:'back',hp:24,atk:3,spd:0.9,apply:{burn:1},flags:{fireproof:1},ab:'Attacks apply 1 Burn, and a random other hero also catches 1 Burn. Immune to Burn.',
  hooks:{onAttackEnd:(u,t,B)=>{ const o=randomEnemy(u,B,t); if(o) applyStatus(u,o,'burn',1,B); }}},
 harpy:{name:'Harpy',row:'back',hp:22,atk:4,spd:1.1,dodge:0.25,targetLowest:true,ab:'25% dodge. Swoops on the lowest-HP hero, wherever they stand.'},
 basilisk:{name:'Basilisk',row:'front',hp:34,atk:5,spd:0.7,apply:{chill:1},ab:'Attacks apply 1 Chill. Petrify: deals ×2 to a target at 5 Chill.',hooks:{onTarget:(u,t,a)=>{ if(t.st.chill>=5) a.mult*=2; }}},
 fiend:{name:'Fiend',row:'front',hp:32,atk:4,spd:0.9,ab:'Trident: each attack hits 2 targets. +3 ATK when an ally dies.',
  hooks:{onAttack:(u,a)=>{ a.extraTargets=1; }, onAllyDeath:(u)=>{ u.atk+=3; }}},
 // --- elites ---
 ogre:{name:'Ogre',row:'front',hp:100,atk:9,spd:0.5,elite:true,ab:'Every 3rd attack hits your whole front row.',
  hooks:{onAttack:(u,a)=>{ if(u.attacks%3===2) a.hitRow='front'; }}},
 hydra:{name:'Hydra',row:'front',hp:70,atk:5,spd:1.2,elite:true,ab:'Each attack hits 2 targets.',hooks:{onAttack:(u,a)=>{a.extraTargets=1;}}},
 minotaur:{name:'Minotaur',row:'front',hp:80,atk:7,spd:0.7,elite:true,ab:'Charge: every 4th attack hits your whole front row for ×2. Below half HP it attacks 40% faster.',
  hooks:{onAttack:(u,a)=>{ if(u.attacks%4===3){ a.hitRow='front'; a.mult*=2; } }, onDamaged:(u)=>{ if(!u.enraged&&u.hp<u.maxHp/2){ u.enraged=true; u.spd*=1.4; } }}},
 // --- bosses ---
 goblinking:{name:'Goblin King',row:'front',hp:130,atk:9,spd:0.9,boss:true,ab:'Every 3s, all enemies gain +15% speed.',
  hooks:{onSecond:(u,B)=>{ if(u.secs%3===0) alliesOf(u,B).forEach(x=>{x.spd*=1.15;}); }}},
 lich:{name:'Lich',row:'back',hp:140,atk:7,spd:0.8,boss:true,apply:{poison:2},ab:'Attacks apply 2 Poison and heal the Lich for damage dealt.',
  hooks:{onHit:(u,t,dmg,B)=>heal(u,dmg,B)}},
 rifttitan:{name:'Stone Titan',row:'front',hp:210,atk:9,spd:0.6,armor:2,boss:true,ab:'+2 ATK every 3s. Every 5th attack hits everyone.',
  hooks:{onSecond:(u)=>{ if(u.secs%3===0) u.atk+=2; }, onAttack:(u,a)=>{ if(u.attacks%5===4) a.hitAll=true; }}},
 bonedragon:{name:'Bone Dragon',row:'front',hp:160,atk:8,spd:0.7,armor:1,boss:true,ab:'Every 5th attack breathes on everyone. Heals 20 whenever another enemy dies. Immune to Poison.',flags:{boneproof:1},
  hooks:{onAttack:(u,a)=>{ if(u.attacks%5===4) a.hitAll=true; }, onAllyDeath:(u,d,B)=>heal(u,20,B)}},
 // --- bosses added v35 (Scout's Camp picks between an act's own bosses) ---
 ratking:{name:'Rat King',row:'front',hp:100,atk:6,spd:0.9,boss:true,ab:'Every 5s, two Rats join the fight. +1 ATK for every Rat alive.',
  hooks:{onSecond:(u,B)=>{ if(u.secs%RK_EVERY===0){ for(let k=0;k<RK_N;k++) spawnEnemy(B,'rat','front'); } }, onAttack:(u,a,B)=>{ a.bonus+=B.units.filter(x=>x.alive&&x.eid==='rat').length; }}},
 broodmother:{name:'Broodmother',row:'front',hp:120,atk:6,spd:0.8,boss:true,apply:{poison:2},ab:'Attacks apply 2 Poison. Each time she loses a quarter of her HP, a Spiderling hatches.',
  hooks:{onDamaged:(u,src,d,info,B)=>{ if(u.hp<=0) return; while((u.hatched||0)<3&&u.hp<=u.maxHp*(0.75-0.25*(u.hatched||0))){ u.hatched=(u.hatched||0)+1; B.fx(u,'HATCH','buff'); for(let k=0;k<BR_N;k++) spawnEnemy(B,'spiderling','front'); } }}},
 vampirelord:{name:'Vampire Lord',row:'front',hp:125,atk:6,spd:0.9,boss:true,ab:'Heals for half the damage he deals. At half HP he becomes a bat swarm: untargetable for 3s while three Bats join the fight.',
  hooks:{onHit:(u,t,d,B)=>{ if(d>0) heal(u,Math.ceil(d/2),B); }, onDamaged:(u,src,d,info,B)=>{ if(!u.batted&&u.hp>0&&u.hp<u.maxHp/2){ u.batted=true; u.veilUntil=B.t+3; B.fx(u,'BAT SWARM','buff'); B.logf(`${u.name} dissolves into bats.`); for(let k=0;k<3;k++) spawnEnemy(B,'bat','back'); } }}},
 banshee:{name:'Banshee',row:'back',hp:110,atk:6,spd:0.9,dodge:0.3,boss:true,ab:'30% dodge. Every 4s she wails: every hero gains 2 Chill.',
  hooks:{onSecond:(u,B)=>{ if(u.secs%4===0){ B.fx(u,'WAIL','buff'); aliveEnemies(u,B).forEach(t=>applyStatus(u,t,'chill',BANSHEE_CHILL,B)); } }}},
 pitlord:{name:'Pit Lord',row:'front',hp:170,atk:9,spd:0.7,armor:1,boss:true,flags:{fireproof:1},ab:'1 Armor. Immune to Burn. Every 2s every hero gains 1 Burn. Deals ×1.25 to Shielded heroes.',
  hooks:{onSecond:(u,B)=>{ if(u.secs%2===0) aliveEnemies(u,B).forEach(t=>applyStatus(u,t,'burn',PIT_BURN,B)); }, onTarget:(u,t,a)=>{ if(t.shield>0) a.mult*=1.25; }}},
};
// Encounter templates: each act rolls one of several themed groups, so fights differ in shape, not just in art.
// `list` is filled front-to-back up to the floor's enemy count, cycling if the template is short.
const ENCOUNTERS={
 1:[
  {name:'Goblin warband',list:['goblin','goblin','archer','shaman','goblin','archer']},
  {name:'Wolf pack',list:['wolf','wolf','spider','wolf','archer','wolf']},
  {name:'Cave',list:['bat','spider','bat','rat','spider','bat']},
  {name:'Rat swarm',list:['rat','rat','rat','slime','rat','rat']},
  {name:'Fungal grove',list:['sporeling','slime','sporeling','spider','slime','sporeling']},
  {name:'Kobold raid',list:['kobold','kobold','archer','bat','kobold','shaman']},
 ],
 2:[
  {name:'Crypt',list:['zombie','skeleton','necromancer','zombie','skeleton','imp']},
  {name:'Ghoul pack',list:['ghoul','ghoul','wraith','cultist','ghoul','wraith']},
  {name:'Ruins',list:['gargoyle','bandit','imp','imp','gargoyle','wraith']},
  {name:'Treasure room',list:['mimic','bandit','bandit','imp','mimic','wraith']},
  {name:'Orc camp',list:['orc','orc','shaman','imp','orc','shaman']},
  {name:'Haunt',list:['wraith','wraith','necromancer','skeleton','wraith','cultist']},
 ],
 3:[
  {name:'Dark host',list:['darkknight','darkknight','cultist','wraith','darkknight','cultist']},
  {name:'Inferno',list:['troll','fireelemental','imp','fireelemental','orc','imp']},
  {name:'Aerie',list:['basilisk','harpy','bandit','harpy','orc','wraith']},
  {name:'Pit fiends',list:['fiend','fiend','cultist','necromancer','fiend','cultist']},
  {name:'Troll bridge',list:['troll','skeleton','harpy','troll','imp','cultist']},
  {name:'Petrified hall',list:['gargoyle','basilisk','wraith','darkknight','harpy','imp']},
 ],
};
const ELITES={1:['hydra'],2:['ogre','minotaur'],3:['hydra','minotaur']}, BOSSES={1:['goblinking','ratking','broodmother'],2:['lich','vampirelord','banshee'],3:['rifttitan','bonedragon','pitlord']};
const FLOORS=12;
const actOf=f=>Math.min(3,Math.ceil(f/4)); // floors past 12 (endless) stay in Act 3
const kindOf=f=>f%4===0?'boss':'fight'; // elites are chosen, never fixed
const curAct=f=>Math.ceil(f/4); // act (or 4-floor endless block) for once-per-act limits
// Enemy strength compounds per floor: 10% in Act 1, 12% in Act 2, 13% in Act 3 (plus a one-off step entering Act 3),
// and much faster in endless so a run there ends in a handful of floors rather than dragging on for dozens.
const BANSHEE_CHILL=2, PIT_BURN=1, RK_EVERY=5, RK_N=2, BR_N=1; // v35 boss numbers (tuned so each act's bosses have similar bot loss rates)
const ACT_GROWTH=[ENV('G1',1.10),ENV('G2',1.12),ENV('G3',1.13)], ENDLESS_GROWTH=ENV('GE',1.20), ACT3_BOOST=ENV('ACT3',1.12);
const floorGrowth=f=>f>FLOORS?ENDLESS_GROWTH:ACT_GROWTH[actOf(f-1)-1]; // an act's faster rate starts after its first floor, so entering the act is no cliff
const enemyMult=(floor,depth)=>{ let m=0.7; for(let f=2;f<=floor;f++) m*=floorGrowth(f); return m*(1+0.10*depth)*(floor>=9?ACT3_BOOST:1); };
const ENEMY_HP=2.1, ENEMY_ATK=1.25;

const bossPool=floor=>BOSSES[floor>FLOORS?((Math.ceil(floor/4)-1)%3)+1:actOf(floor)];
const rollActBoss=floor=>pick(bossPool(floor)); // decided when an act (or endless block) begins
// a boss brought in from another act (Scout's Camp) is rescaled to this act's own bosses' average HP and ATK
function bossNorm(floor,id){ const nat=bossPool(floor); if(nat.includes(id)) return null; const d=ENEMIES[id], av=k=>nat.reduce((a,b)=>a+ENEMIES[b][k],0)/nat.length; return {hp:av('hp')/d.hp,atk:av('atk')/d.atk}; }
function genEncounter(floor,depth,kindOverride,bossId){
  const act=actOf(floor), kind=kindOverride||kindOf(floor);
  const cyc=((Math.ceil(floor/4)-1)%3)+1; // endless: elites and bosses cycle through all three acts
  const tAct=floor>FLOORS?pick([2,3]):act;
  const tpl=pick(ENCOUNTERS[tAct]);
  let list=[];
  if(kind==='elite') list.push(pick(ELITES[floor>FLOORS?cyc:act])); if(kind==='boss') list.push(bossId||pick(BOSSES[floor>FLOORS?cyc:act]));
  const n=floor>FLOORS?6:kind==='fight'?[3,4,4,5,5,6][Math.min(5,(act-1)*2+(floor-1)%4)]:2+act;
  let i=0; while(list.length<Math.min(6,n)) list.push(tpl.list[i++%tpl.list.length]);
  // rows: max ROW_MAX per row
  const out=[], cnt={front:0,back:0};
  list.forEach(id=>{ let r=ENEMIES[id].row; if(cnt[r]>=ROW_MAX) r=r==='front'?'back':'front'; cnt[r]++; out.push({id,row:r}); });
  const norm=kind==='boss'?bossNorm(floor,list[0]):null;
  return {floor,kind,act,mult:enemyMult(floor,depth),list:out,theme:kind==='fight'?tpl.name:null,...(norm?{norm}:{})};
}
// What the camp offers on a floor: floor 1 and bosses are fixed; every other floor is fight vs elite.
// (Events — Forge, Enchanter, Gem Cutter, Retirement, Scout's Camp — come as a bonus after each act's 2nd fight.)
function genChoices(floor,depth,opts){
  const fixed=k=>[{kind:k,enc:genEncounter(floor,depth,k,opts&&opts.boss)}];
  if(floor===1) return fixed('fight');
  if(kindOf(floor)==='boss') return fixed('boss');
  return ['fight','elite'].map(k=>({kind:k,enc:genEncounter(floor,depth,k)}));
}

// ---------- Stats ----------
function computeStats(h,relics){
  relics=relics||[];
  const d=HEROES[h.id], L=h.lv, m=1+0.15*(L-1);
  let hp=d.hp*m+(h.bonusHp||0)+(h.giftHp||0), atk=d.atk*m+(h.giftAtk||0), spd=d.spd, armor=d.armor||0, crit=(d.crit||0)+(d.critLv||0)*(L-1), dodge=(d.dodge||0)+(d.dodgeLv||0)*(L-1);
  const apply={}; const base=d.apply?d.apply(L):{}; for(const k in base) apply[k]=(apply[k]||0)+base[k];
  let statusMult=1, targetLowest=!!d.targetLowest, startShield=0, regen=0;
  const flags={};
  const sc=slotCounts(h,relics.includes('prism')), gh=sc.hand, ga=sc.armor, gold={win:0,kill:0,interest:0,elite:0};
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
  const skills=activeSkills(h);
  const gemDefs=gemsOf(h).flatMap(gemLeaves).map(g=>GEMS[g]).filter(g=>g.rare);
  let hpMult=1;
  skills.concat(gemDefs).forEach(it=>{
    if(it.flag) flags[it.flag]=1; if(it.flags) it.flags.forEach(f=>flags[f]=1);
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
  return {maxHpRaw:Math.round(hpRaw),maxHp:Math.max(1,Math.round(hp)),atk:Math.round(atk),spd:Math.round(spd*100)/100,armor,crit,dodge:Math.min(DODGE_CAP,dodge),apply,statusMult,targetLowest,flags,startShield,regen,retaliate,spikes,lifesteal,shieldPerAttack,giltHand:gh.gilt||0,giltArmor:ga.gilt||0,skills,gold,gemHooks:gemDefs.map(g=>g.hooks||{})};
}

// ---------- Battle ----------
function baseUnit(def,side,row,s,B){
  return {uid:B.uid++,def,name:def.name,side,row,alive:true,hp:s.maxHp,maxHp:s.maxHp,maxHp0:s.maxHp,atk:s.atk,spd:s.spd,armor:s.armor,crit:s.crit||0,dodge:s.dodge||0,
    shield:0,st:{},flags:{},tmpMult:1,timer:0.35+Math.random()*0.3,stTimer:Math.random()*0.2,secs:0,attacks:0,chain:0,L:1,apply:{},hooks:[],statusMult:1,targetLowest:false,hitAll:false,hitAllMult:1,
    stats:{dealt:0,taken:0,healed:0,kills:0}};
}
function createBattle(heroes,enc,relics){
  const B={units:[],t:0,over:false,winner:null,log:[],relics,fx:()=>{},anim:()=>{},spawn:()=>{},move:()=>{},vanish:()=>{},phoenixUsed:false,uid:0,enc,flags:{},depth:0,bounty:0};
  B.logf=s=>{B.log.push(`${B.t.toFixed(1)}s ${s}`); if(B.log.length>400) B.log.shift();};
  heroes.forEach(h=>{ const d=HEROES[h.id], s=computeStats(h,relics);
    const u=baseUnit(d,'p',h.row,s,B); u.L=h.lv; u.hero=h; u.apply=s.apply; u.statusMult=s.statusMult; u.targetLowest=s.targetLowest; u.hitAll=!!d.hitAll; u.hitAllMult=s.flags.aoeFull?1:(d.hitAllMult||1); u.flags=s.flags;
    const gemHooks={onStart:(u,B)=>{ if(s.startShield) addShield(u,s.startShield,B); }, onSecond:(u,B)=>{ if(s.regen&&u.secs%2===0) heal(u,s.regen,B,u); },
      onAttack:(u,a,B)=>{ if(s.shieldPerAttack) addShield(u,s.shieldPerAttack,B); },
      onHit:(u,t,d,B)=>{ if(s.lifesteal&&d>0) heal(u,s.lifesteal,B,u); },
      onDamaged:(u,src,d,info,B)=>{ if(info.type!=='attack'||!src||!src.alive) return; for(const k in s.retaliate) applyStatus(u,src,k,s.retaliate[k],B); if(s.spikes) dealDamage(u,src,s.spikes,{type:'thorns',ignoreArmor:true},B); }};
    u.hooks=[d.hooks||{}, gemHooks, ...s.gemHooks, ...s.skills.map(x=>x.hooks||{}), ...relics.map(r=>RELICS[r].hooks||{})];
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
// hard caps so stacking buffs can never run away: dodge tops out at 75%, attack speed at 3 attacks/s, kill-chains at one per possible kill
const DODGE_CAP=0.75, SPD_CAP=3, KILL_CHAIN_MAX=ROW_MAX*2;
const effSpd=u=>Math.min(SPD_CAP,u.spd*(1-0.1*(u.st.chill||0)));
function addShield(u,n,B,echo){ if(!u||!u.alive||n<=0) return; if(u.flags.shieldMult2) n*=2; u.shield+=n; B.fx(u,`+${n}`,'shield'); fireOnce(u,'onShieldGain',B,n);
  // Twin Aegis: copy to another random hero (the copy never copies itself)
  if(!echo&&u.hero&&B.relics.includes('twinaegis')){ const o=B.units.filter(x=>x!==u&&x.hero&&x.alive); if(o.length) addShield(pick(o),n,B,true); } }
function heal(u,n,B,src){ if(!u||!u.alive||n<=0||u.flags.noHeal) return; const r=Math.max(0,Math.min(n,u.maxHp-u.hp)); if(r>0){ u.hp+=r; u.stats.healed+=r; B.fx(u,`+${r}`,'heal'); } if(n-r>0&&u.hero&&B.relics.includes('chalice')) addShield(u,Math.round(n-r),B); if(src&&src.alive) fireOnce(src,'onHeal',B,u,r,n-r); }
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
  let foes=aliveEnemies(u,B).filter(f=>!(f.veilUntil>B.t)); if(!foes.length) return;
  let targets;
  if(forced&&forced.alive) targets=[forced];
  else if(u.hitAll||a.hitAll){ targets=foes.slice(); if(u.hitAll) a.mult*=u.hitAllMult; }
  else if(a.hitRow){ targets=foes.filter(f=>f.row===a.hitRow); if(!targets.length) targets=[pickTarget(u,foes,a,B)]; }
  else { targets=[pickTarget(u,foes,a,B)]; for(let i=0;i<a.extraTargets;i++){ const o=foes.filter(f=>!targets.includes(f)); if(o.length) targets.push(pick(o)); } }
  u.attacks++;
  targets.forEach(t=>hit(u,t,a,B));
  fire(u,'onAttackEnd',targets[0],B);
}
function hit(u,t,a,B){
  if(!t.alive||!u.alive) return;
  if(Math.random()<Math.min(DODGE_CAP,t.dodge)){ B.anim(u,t,{type:'miss'}); B.fx(t,'miss','miss'); B.logf(`${t.name} dodges ${u.name}.`); fire(t,'onDodge',u,B); return; }
  const ac=Object.assign({mult:1,bonus:0},a);
  fire(u,'onTarget',t,ac,B);
  fire(t,'onDefend',u,ac,B);
  if(t.st.chill>0&&u.side==='p'){ if(B.relics.includes('glacialcore')) ac.bonus+=t.st.chill; if(B.flags.wintersgrip) ac.mult*=1.15; if(t.st.chill>=5&&B.flags.abszero) ac.mult*=1.5; }
  let dmg=Math.max(1,u.atk+ac.bonus)*ac.mult, crit=false;
  if(ac.forceCrit||Math.random()<u.crit+(ac.critBonus||0)){ dmg*=u.flags.crit3?3:2; crit=true; }
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
  if(k==='chill') t.st.chill=Math.min(5,(t.st.chill||0)+n); else t.st[k]=(t.st[k]||0)+n;
  fireOnce(src,'onApply',B,k,t,n);
  if(k==='poison') t.poisonSrc=src; if(k==='burn') t.burnSrc=src;
  if(k==='poison'&&src.flags.numb&&!B._numb){ B._numb=1; applyStatus(src,t,'chill',1,B); B._numb=0; }
  if(k==='chill'&&src.side==='p'&&B.flags.frozenarmor) B.units.forEach(x=>{ if(x.alive&&x.flags.frozenarmor) addShield(x,2,B); });
  if(k==='poison'&&src.flags.virulent&&!B._vir){ B._vir=1; const o=randomEnemy(src,B,t); if(o) applyStatus(src,o,'poison',n/(src.statusMult||1),B); B._vir=0; }
}
function dealDamage(src,t,amount,info,B){
  if(!t.alive) return 0;
  if(info.type==='attack'&&src) B.anim(src,t,info);
  if(t.side==='e'&&B.relics.includes('resonance')&&['poison','burn','chill'].filter(k=>t.st[k]>0).length>=3) amount*=1.3;
  let dmg=Math.max(0,Math.round(amount));
  if(!info.ignoreArmor&&dmg>0) dmg=Math.max(1,dmg-t.armor);
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
  t.alive=false; t.hp=0; t.shield=0; t.st_poisonAtDeath=t.st.poison||0; t.st={};
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
    const d=dealDamage(src,u,st.burn*BURN_DMG*m,{type:'burn',ignoreArmor:true},B); st.burn=(src&&src.flags.slowBurn)?st.burn-1:Math.floor(st.burn/2);
    if(d>0&&src){ B.units.forEach(x=>{ if(x.side===src.side&&x.alive) fire(x,'onBurnDamage',u,d,B); }); if(src.side==='p'&&B.relics.includes('wildfire')){ const o=randomEnemy(src,B,u); if(o){ o.st.burn=(o.st.burn||0)+1; o.burnSrc=src; } } } }
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
if(typeof module!=='undefined') module.exports={rollActBoss,bossPool,bossNorm,BOSSES,enemyMult,gemLeaves,defineMergedGem,restoreMergedGems,genChoices,curAct,slotKind,HAND_SLOTS,HEROES,defaultRow,ROW_MAX,ENCOUNTERS,GEMS,BASIC_GEMS,RARE_GEMS,SKILLS,SLOTS,RELICS,ENEMIES,TRAITS,FUSIONS,ARCH_LABEL,heroSkills,activeSkills,skillActive,needCounts,gemCounts,genEncounter,computeStats,createBattle,stepBattle,runToEnd,actOf,kindOf,FLOORS};
