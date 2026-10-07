// ---------- Gems (orbment-style) ----------
// Each gem slotted into a hero grants a small passive. Combinations of gems unlock that hero's unique skills.
const ARCH_LABEL={poison:'Poison',burn:'Burn',chill:'Chill',shield:'Shield',crit:'Crit',heal:'Healing',speed:'Tempo',dodge:'Dodge',kill:'Kills',tank:'Taking hits',rage:'Rage'};
const GEMS={
 venom:{name:'Venom',arch:'poison',letter:'V',cost:3,hand:'Attacks apply +1 Poison',armor:'Attackers that hit this hero gain 1 Poison'},
 ember:{name:'Ember',arch:'burn',letter:'E',cost:3,hand:'Attacks apply +1 Burn',armor:'Attackers that hit this hero gain 1 Burn'},
 frost:{name:'Frost',arch:'chill',letter:'F',cost:3,hand:'Attacks apply +1 Chill',armor:'Attackers that hit this hero gain 1 Chill'},
 ward:{name:'Ward',arch:'shield',letter:'W',cost:3,hand:'Gain 1 Shield with every attack',armor:'+1 Armor · start each fight with 5 Shield'},
 edge:{name:'Edge',arch:'crit',letter:'K',cost:3,hand:'+15% crit chance',armor:'Spiked: attackers that hit this hero take 2 damage'},
 vital:{name:'Vital',arch:'heal',letter:'H',cost:3,hand:'Each hit heals this hero 2',armor:'+12 HP · heal 1 every 2 seconds'},
 swift:{name:'Swift',arch:'speed',letter:'S',cost:3,hand:'+15% attack speed',armor:'+8% dodge'},
 gilt:{name:'Gilt',arch:'gold',letter:'G',cost:3,hand:'+1 gold for every 2 enemies this hero kills in a fight',armor:'+1 gold after every won fight'},
 // rare: two essences + a bonus effect
 bloodstone:{name:'Bloodstone',rare:1,ess:['venom','vital'],cost:5,desc:'Venom + Vital. Whenever this hero\'s Poison damages an enemy, heal 1',hooks:{onPoisonDamage:(u,t,d,B)=>{ if(t.poisonSrc===u) heal(u,1,B,u); }}},
 hearthstone:{name:'Hearthstone',rare:1,ess:['ember','ward'],cost:5,desc:'Ember + Ward. When this hero\'s Shield absorbs a hit, the attacker gains 1 Burn',hooks:{onShieldAbsorb:(u,src,ab,B)=>applyStatus(u,src,'burn',1,B)}},
 rimeheart:{name:'Rimeheart',rare:1,ess:['frost','ward'],cost:5,desc:'Frost + Ward. Whenever this hero applies Chill, gain 1 Shield',hooks:{onApply:(u,k,t,n,B)=>{ if(k==='chill') addShield(u,1,B); }}},
 sunstone:{name:'Sunstone',rare:1,ess:['ember','edge'],cost:5,desc:'Ember + Edge. Crits apply +2 Burn',hooks:{onCrit:(u,t,B)=>applyStatus(u,t,'burn',2,B)}},
 quicksilver:{name:'Quicksilver',rare:1,ess:['swift','edge'],cost:5,desc:'Swift + Edge. Every 4th attack is a guaranteed crit',hooks:{onAttack:(u,a,B)=>{ if(nthAttack(u,4)) a.forceCrit=true; }}},
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

function needCounts(need){ const c={}; for(const ch of need){ const g=GEM_BY_LETTER[ch]; c[g]=(c[g]||0)+1; } return c; }
function gemsOf(h){ return (h.gems||[]).filter(Boolean); } // h.gems[k] = gem in slot k (weapon, body, head, off-hand) or null when that slot is empty
function gemCounts(h){ const c={}; gemsOf(h).forEach(g=>gemEss(g).forEach(e=>c[e]=(c[e]||0)+1)); return c; } // essences, for recipes
function essenceCounts(h){ const c={}; gemsOf(h).forEach(g=>{ const d=GEMS[g]; (!d.rare?[g]:d.ess.length>=3?d.ess:[]).forEach(e=>c[e]=(c[e]||0)+1); }); return c; } // Prismatic Lens: 3-essence gems grant every essence's passive
// Gear slots: 0 weapon & 3 off-hand = 'hand' (offensive passive), 1 body & 2 head = 'armor' (defensive passive)
const GEM_HAND={wardShield:1,vitalHeal:2}, GEM_ARMOR={spikes:2,dodge:0.08}, GILT_PER_KILLS=2; // a Gilt weapon pays 1 gold per this many kills by its hero in a fight
const HAND_SLOTS=[0,3], slotKind=(k,h)=>(HAND_SLOTS.includes(k)!==!!(h&&h.flip&&h.flip.includes(k)))?'hand':'armor'; // h.flip: sockets the Enchanter has turned to the other kind
function slotCounts(h,prism){ const c={hand:{},armor:{}}; (h.gems||[]).forEach((g,k)=>{ if(!g) return; const t=c[slotKind(k,h)]; gemLeaves(g).forEach(l=>{ const d=GEMS[l]; const es=!d.rare?[l]:(prism&&d.ess.length>=3?d.ess:[]); es.forEach(e=>t[e]=(t[e]||0)+1); }); }); return c; }
function basicCounts(h){ const c={}; gemsOf(h).forEach(g=>{ if(!GEMS[g].rare) c[g]=(c[g]||0)+1; }); return c; } // passives come only from basic gems
function skillActive(h,sk){ const have=gemCounts(h), need=needCounts(sk.need); return Object.keys(need).every(g=>(have[g]||0)>=need[g]); }
const skillArch=sk=>GEMS[GEM_BY_LETTER[sk.need[0]]].arch;

