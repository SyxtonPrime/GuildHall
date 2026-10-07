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
  {need:'KKF',name:'Frozen Precision',desc:'Crits apply 2 Chill; +8% crit per Chill on the target (up to 5)',flag:'critChill',hooks:{onTarget:(u,t,a,B)=>{ a.critBonus=(a.critBonus||0)+0.08*chill5(t); }}},
  {need:'KKK',name:'Flurry',desc:'35% chance each attack also hits another enemy for 50%',hooks:{onAttackEnd:(u,t,B)=>{ if(Math.random()<0.35){ const o=randomEnemy(u,B,t); if(o) hit(u,o,{mult:0.5},B); } }}},
  {need:'KKKK',name:'Death Blossom',desc:'Each of his regular attacks that crits is followed by one extra attack (the extra attack cannot trigger this again)',hooks:{onAttack:(u,a,B)=>{ if(u.chain===0) u.blossomed=false; }, onCrit:(u,t,B)=>{ if(u.chain===0&&!u.blossomed){ u.blossomed=true; u.chain++; attack(u,B); u.chain--;} }}},
  {need:'KKVS',name:'Venom Dance',desc:'+20% dodge; dodging gives the attacker 3 Poison; crits apply 2 Poison',mod:{dodge:0.2},flags:['critPoison'],hooks:{onDodge:(u,src,B)=>applyStatus(u,src,'poison',3,B)}} ],
 shieldmaiden:[ st('W','Bulwark','+1 Armor, +10 HP',{armor:1,hp:10}), st('K','Precise','+15% crit chance',{crit:0.15}),
  {need:'GW',name:'Toll Keeper',desc:'+2 gold after every won fight',gold:{win:2}},
  {need:'WW',ref:'s_aegis'}, {need:'WK',ref:'s_bash'}, {need:'WF',ref:'s_frost'},
  {need:'WWW',ref:'k_bastion'}, {need:'WWK',ref:'fu_s_crit'},
  {need:'WWWW',name:'Aegis Eternal',desc:'Regains 6 Shield every second and starts with 20 extra Shield',hooks:{onStart:(u,B)=>addShield(u,20,B), onSecond:(u,B)=>addShield(u,6,B)}},
  {need:'WWKF',name:'Glacial Bash',desc:'Attacks deal +2 per Chill on the target (up to 5); her crits apply 2 Chill',flag:'critChill',hooks:{onTarget:(u,t,a,B)=>{ a.bonus+=2*chill5(t); }}} ],
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
  {need:'EEEE',name:'Conflagration',desc:'Whenever her Burn damages an enemy, every other enemy gains 1 Burn',hooks:{onBurnDamage:(u,t,d,B)=>{ if(t.burnSrc!==u) return; aliveEnemies(u,B).forEach(x=>{ if(x!==t){ gainStatus(x,'burn',1,B); x.burnSrc=u; } }); }}},
  {need:'EESK',name:'Blue Flame',desc:'Crits apply 3 Burn; attacks deal +1 per Burn on the target (up to 10)',flag:'critBurn',hooks:{onTarget:(u,t,a,B)=>{ a.bonus+=Math.min(10,t.st.burn||0); }}} ],
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
  {need:'FFFF',name:'Absolute Zero',desc:'Frozen enemies take +50% damage from every hero',flag:'abszero'},
  {need:'FFWK',name:"Glacier's Edge",desc:'+8% crit and +2 damage per Chill on her target (up to 5)',hooks:{onTarget:(u,t,a,B)=>{ const c=chill5(t); a.critBonus=(a.critBonus||0)+0.08*c; a.bonus+=2*c; }}} ],
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
  {need:'FFFF',name:'Shatterpoint',desc:'Hitting a Frozen enemy deals +15 and shatters the Chill',hooks:{onTarget:(u,t,a,B)=>{ if(isFrozen(t)){ a.bonus+=15; t.st.chill=0; } }}},
  {need:'FFKE',name:'Frostfire',desc:'Crits apply 3 Burn; attacks deal +1 per Burn on the target (up to 10)',flag:'critBurn',hooks:{onTarget:(u,t,a,B)=>{ a.bonus+=Math.min(10,t.st.burn||0); }}} ],
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

