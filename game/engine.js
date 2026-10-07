
// ============================================================
//  GUILDHALL — engine (pure logic, no DOM)
// ============================================================
const ri=n=>Math.floor(Math.random()*n), pick=a=>a[ri(a.length)];
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=ri(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ENV=(k,d)=>+((typeof process!=='undefined'&&process.env&&process.env[k])||d); // tuning knobs the balance bot can override (browser: defaults)

// ---------- Statuses ----------
// Chill slows 2.5% a stack (up to 20 stacks). A unit at 20 or more is Frozen: its next attack deals half damage (a quarter at 40, and so on)
// and consumes 20; under 20, attacking halves its Chill. Burn deals 1 a stack a second and halves each second; a unit that reaches 10 is Ablaze
// and its Burn never decays below 10 unless something removes it. Poison deals 1 a stack a second (ignoring Armor and Shield) and loses 1; at 15
// a unit is Festering: Armor counts as 0 and it cannot be healed or gain Shield. Frozen, Ablaze and Festering are the afflictions.
// Two afflictions at once mark a unit for the rest of the fight: Brittle (Frozen + Ablaze: every Chill or Burn application is +1), Blighted
// (Ablaze + Festering: +25% damage from statuses), Crippled (Frozen + Festering: attacks 25% slower). All three: Ruined (+50% damage from
// everything, and all three marks). The rules are the same for heroes and enemies.
const BURN_DMG=ENV('BURNDMG',1); // Burn deals this × its stacks per tick
const FROZEN_AT=20, ABLAZE_AT=10, FESTER_AT=ENV('FESTER',15), CHILL_SLOW=ENV('CHILLSLOW',0.025), CHILL_SLOW_MAX=20;
const isFrozen=u=>(u.st.chill||0)>=FROZEN_AT, isAblaze=u=>!!u.ablaze, isFestering=u=>(u.st.poison||0)>=FESTER_AT;
const chill5=u=>Math.min(5,u.st.chill||0); // content written against the old 5-stack Chill cap reads Chill through this
const STATUS_KEYS=['poison','burn','chill'];
const afflictions=u=>(isFrozen(u)?1:0)+(isAblaze(u)?1:0)+(isFestering(u)?1:0);
// Crit and dodge chance halve after each success and reset on the first failure, so stacked chance never means a guaranteed streak.
// Guaranteed crits and dodges (forceCrit / forceDodge) always succeed and leave the streak alone.
const STREAKS=ENV('STREAK',1), CHILL_SHED=ENV('CHILLSHED',1); // bot knobs: STREAK=0 restores plain rolls, CHILLSHED=0 stops attacking from halving Chill
const streakRoll=(chance,unit,key)=>{ if(Math.random()<chance/(STREAKS?Math.pow(2,unit[key]||0):1)){ unit[key]=(unit[key]||0)+1; return true; } unit[key]=0; return false; };

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
 gilt:{name:'Gilt',arch:'gold',letter:'G',cost:3,hand:'+1 gold for each enemy this hero kills',armor:'+1 gold after every won fight'},
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
const GEM_HAND={wardShield:1,vitalHeal:2}, GEM_ARMOR={spikes:2,dodge:0.08};
const HAND_SLOTS=[0,3], slotKind=(k,h)=>(HAND_SLOTS.includes(k)!==!!(h&&h.flip&&h.flip.includes(k)))?'hand':'armor'; // h.flip: sockets the Enchanter has turned to the other kind
function slotCounts(h,prism){ const c={hand:{},armor:{}}; (h.gems||[]).forEach((g,k)=>{ if(!g) return; const t=c[slotKind(k,h)]; gemLeaves(g).forEach(l=>{ const d=GEMS[l]; const es=!d.rare?[l]:(prism&&d.ess.length>=3?d.ess:[]); es.forEach(e=>t[e]=(t[e]||0)+1); }); }); return c; }
function basicCounts(h){ const c={}; gemsOf(h).forEach(g=>{ if(!GEMS[g].rare) c[g]=(c[g]||0)+1; }); return c; } // passives come only from basic gems
function skillActive(h,sk){ const have=gemCounts(h), need=needCounts(sk.need); return Object.keys(need).every(g=>(have[g]||0)>=need[g]); }
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
 glacialcore:{name:'Glacial Core',tier:'common',cost:5,desc:'Attacks on Chilled enemies deal +1 per Chill (up to 5)'},
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
 spider:{name:'Cave Spider',row:'front',hp:20,atk:3,spd:1.1,apply:{poison:ENV('SPIDER',2)},ab:'Attacks apply 2 Poison.'},
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
  hooks:{onAttack:(u,a)=>{ if(nthAttack(u,3)){ a.preferBack=true; a.mult*=1.5; } }}},
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
 basilisk:{name:'Basilisk',row:'front',hp:34,atk:5,spd:0.7,apply:{chill:3},ab:'Attacks apply 3 Chill. Petrify: deals ×2 to a target with 10 or more Chill.',hooks:{onTarget:(u,t,a)=>{ if((t.st.chill||0)>=10) a.mult*=2; }}},
 fiend:{name:'Fiend',row:'front',hp:32,atk:4,spd:0.9,ab:'Trident: each attack hits 2 targets. +3 ATK when an ally dies.',
  hooks:{onAttack:(u,a)=>{ a.extraTargets=1; }, onAllyDeath:(u)=>{ u.atk+=3; }}},
 // --- elites ---
 ogre:{name:'Ogre',row:'front',hp:100,atk:9,spd:0.5,elite:true,ab:'Every 3rd attack hits your whole front row.',
  hooks:{onAttack:(u,a)=>{ if(nthAttack(u,3)) a.hitRow='front'; }}},
 hydra:{name:'Hydra',row:'front',hp:70,atk:5,spd:1.2,elite:true,ab:'Each attack hits 2 targets.',hooks:{onAttack:(u,a)=>{a.extraTargets=1;}}},
 minotaur:{name:'Minotaur',row:'front',hp:80,atk:7,spd:0.7,elite:true,ab:'Charge: every 4th attack hits your whole front row for ×2. Below half HP it attacks 40% faster.',
  hooks:{onAttack:(u,a)=>{ if(nthAttack(u,4)){ a.hitRow='front'; a.mult*=2; } }, onDamaged:(u)=>{ if(!u.enraged&&u.hp<u.maxHp/2){ u.enraged=true; u.spd*=1.4; } }}},
 // --- bosses ---
 goblinking:{name:'Goblin King',row:'front',hp:130,atk:9,spd:0.9,boss:true,ab:'Every 3s, all enemies gain +15% speed.',
  hooks:{onSecond:(u,B)=>{ if(u.secs%3===0) alliesOf(u,B).forEach(x=>{x.spd*=1.15;}); }}},
 lich:{name:'Lich',row:'back',hp:140,atk:7,spd:0.8,boss:true,apply:{poison:2},ab:'Attacks apply 2 Poison and heal the Lich for damage dealt.',
  hooks:{onHit:(u,t,dmg,B)=>heal(u,dmg,B)}},
 rifttitan:{name:'Stone Titan',row:'front',hp:210,atk:9,spd:0.6,armor:2,boss:true,ab:'+2 ATK every 3s. Every 5th attack hits everyone.',
  hooks:{onSecond:(u)=>{ if(u.secs%3===0) u.atk+=2; }, onAttack:(u,a)=>{ if(nthAttack(u,5)) a.hitAll=true; }}},
 bonedragon:{name:'Bone Dragon',row:'front',hp:160,atk:8,spd:0.7,armor:1,boss:true,ab:'Every 5th attack breathes on everyone. Heals 20 whenever another enemy dies. Immune to Poison.',flags:{boneproof:1},
  hooks:{onAttack:(u,a)=>{ if(nthAttack(u,5)) a.hitAll=true; }, onAllyDeath:(u,d,B)=>heal(u,20,B)}},
 // --- bosses added v35 (Scout's Camp picks between an act's own bosses) ---
 ratking:{name:'Rat King',row:'front',hp:100,atk:6,spd:0.9,boss:true,ab:'Every 5s, two Rats join the fight. +1 ATK for every Rat alive.',
  hooks:{onSecond:(u,B)=>{ if(u.secs%RK_EVERY===0){ for(let k=0;k<RK_N;k++) spawnEnemy(B,'rat','front'); } }, onAttack:(u,a,B)=>{ a.bonus+=B.units.filter(x=>x.alive&&x.eid==='rat').length; }}},
 broodmother:{name:'Broodmother',row:'front',hp:120,atk:6,spd:0.8,boss:true,apply:{poison:2},ab:'Attacks apply 2 Poison. Each time she loses a quarter of her HP, a Spiderling hatches.',
  hooks:{onDamaged:(u,src,d,info,B)=>{ if(u.hp<=0) return; while((u.hatched||0)<3&&u.hp<=u.maxHp*(0.75-0.25*(u.hatched||0))){ u.hatched=(u.hatched||0)+1; B.fx(u,'HATCH','buff'); for(let k=0;k<BR_N;k++) spawnEnemy(B,'spiderling','front'); } }}},
 vampirelord:{name:'Vampire Lord',row:'front',hp:125,atk:6,spd:0.9,boss:true,ab:'Heals for half the damage he deals. At half HP he becomes a bat swarm: untargetable for 3s while three Bats join the fight.',
  hooks:{onHit:(u,t,d,B)=>{ if(d>0) heal(u,Math.ceil(d/2),B); }, onDamaged:(u,src,d,info,B)=>{ if(!u.batted&&u.hp>0&&u.hp<u.maxHp/2){ u.batted=true; u.veilUntil=B.t+3; B.fx(u,'BAT SWARM','buff'); B.logf(`${u.name} dissolves into bats.`); for(let k=0;k<3;k++) spawnEnemy(B,'bat','back'); } }}},
 banshee:{name:'Banshee',row:'back',hp:110,atk:6,spd:0.9,dodge:0.3,boss:true,ab:'30% dodge. Every 4s she wails: every hero gains 2 Chill.',
  hooks:{onSecond:(u,B)=>{ if(u.secs%4===0){ B.fx(u,'WAIL','buff'); aliveEnemies(u,B).forEach(t=>applyStatus(u,t,'chill',BANSHEE_CHILL,B)); } }}},
 pitlord:{name:'Pit Lord',row:'front',hp:170,atk:9,spd:0.7,armor:1,boss:true,flags:{fireproof:1},ab:'1 Armor. Immune to Burn. Every 2s every hero gains 2 Burn. Deals ×1.25 to Shielded heroes.',
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
const BANSHEE_CHILL=6, PIT_BURN=2, RK_EVERY=5, RK_N=2, BR_N=1; // v35 boss numbers (tuned so each act's bosses have similar bot loss rates)
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

// Generated by tools/build.js from design/gem-recipe-bench/recipes.json. Do not edit: change the bench and rebuild.
const CLASS_DATA={"format":"gem-recipe-bench","version":1,"exportedAt":"2026-10-06T01:42:42.360Z","classes":{"c_muucqat9mbn7":{"ess":["venom","frost","edge","swift"],"from":["c_muuberm8ge8h","c_muuaifyzo8vc"],"name":"Nightblade","notes":"","order":1791150447933,"passive":"Can't be targeted for 3 seconds at the start of each fight and after each kill, on top of any she already has. While untargetable, her attacks apply 3 Poison and 3 Chill.","updated":1791299661275},"c_muu8sumchvtt":{"ess":["venom"],"from":["c_muu7pm5ad90i","c_muu893hhv45u"],"name":"Poisoner","notes":"","order":1791143848452,"passive":"Attacks apply 1 Poison.","updated":1791155000000},"c_muu8s3phmca2":{"ess":["swift","swift"],"from":["c_muu8rt2490lr"],"name":"Windrunner","notes":"","order":1791143813573,"passive":"When an ally in her row crits, she immediately attacks their target for half damage.","rename":false,"updated":1791258317373},"c_muu8hkj0igmk":{"ess":["edge","gilt"],"from":["c_muu89hhv5yf5","c_muu8kfxb9l85"],"name":"Mercenary","notes":"","order":1791143322156,"passive":"Each kill this fight gives him +20% damage.","updated":1791251442429},"c_muu8cz7uo8uh":{"ess":["gilt","gilt","gilt"],"from":["c_muu8a0kltcn4"],"name":"Guildmaster","notes":"","order":1791143107914,"passive":"Your guild has one more hero slot. The hoard bonus has no cap.","updated":1791334901253},"c_muu9coiwf8yb":{"ess":["vital","vital"],"from":["c_muu8t3slx20j"],"name":"Blood mage","notes":"","order":1791144773672,"passive":"Her attacks heal the most injured ally for the damage dealt. Each attack costs her 2 HP.","rename":false,"updated":1791256390260},"c_muuayv3nak54":{"ess":["edge","edge","edge"],"from":["c_muu8kqk3v3ck"],"name":"Blademaster","notes":"","order":1791147488243,"passive":"Crits deal triple damage. On a kill, attacks again at once and gains +15% attack speed for the rest of the fight.","rename":false,"updated":1791299661275},"c_muu9qxrkyxif":{"ess":["vital","vital","vital"],"from":["c_muu9coiwf8yb"],"name":"Vampire","notes":"","order":1791145438832,"passive":"Heals half the damage she deals.","rename":false,"updated":1791305300088},"c_muu8fq9g7iy1":{"ess":["ember","ember","ward","ward"],"from":["c_muu8dwwwleo2","c_muu81a83luco"],"name":"Lava strider","notes":"Very good at playing the floor is lava","order":1791143236276,"passive":"Enemies that hit it gain 2 more Burn. Whenever Burn damages an enemy, it gains 1 more Shield, with no per-second cap.","rename":false,"updated":1791303170435},"c_muu80wgi8uoq":{"ess":["ember"],"from":["c_muu7pm5ad90i"],"name":"Fire mage","notes":"","order":1791142544466,"passive":"Attacks apply 1 Burn.","updated":1791155000000},"c_muu9hfleces9":{"ess":["venom","venom","gilt","gilt"],"from":["c_muu93w65k55t","c_muu8a0kltcn4","c_muubfqfprgsy"],"name":"Alchemist","notes":"","order":1791144995378,"passive":"Enemies killed while Poisoned drop 2 gold. Every 4th attack throws a vial: 5 Poison to the target and every adjacent enemy.","updated":1791334901253},"c_muu9rlact8dy":{"ess":["ward","ward","vital","vital"],"from":["c_muu9resprp7i","c_muu9ue1x7wfi"],"name":"Paladin","notes":"","order":1791145469316,"passive":"When an ally's Shield breaks, heals them a tenth of their max HP, on top of any they already get. Her heals give Shield equal to a quarter of the amount.","updated":1791305300088},"c_muub3d9lyt44":{"ess":["ward","vital","swift","gilt"],"from":["c_muu91gvq8418","c_muu9resprp7i","c_muubf8nae0xm"],"name":"Herald","notes":"Her friends call her enabler","order":1791147698409,"passive":"Allies deal 10% more damage. When an ally drops below half HP, every ally attacks 20% faster for 3 seconds.","rename":false,"updated":1791305300088},"c_muu7r2uqpswr":{"ess":["frost","frost","frost"],"from":["c_muu7q2c8r12v"],"name":"Cryomancer","notes":"In college he went by frosty the snow mage","order":1791142086194,"passive":"Her attacks also apply 2 Chill to every other enemy. Her hits on Frozen enemies deal double damage.","rename":false,"updated":1791297966757},"c_muu7sibtrs2m":{"ess":["venom","ember","frost","vital"],"from":["c_muu81a83luco","c_muua27gbu9q4","c_muu9fbav9cav"],"name":"Prismatic magus","notes":"","order":1791142152905,"passive":"Attacks apply 1 Poison, 1 Burn and 1 Chill. Enemies carrying all three take 25% more damage.","updated":1791297966757},"c_muuck8ca1kex":{"ess":["venom","frost","ward","swift"],"from":["c_muu98ulvacc4","c_muu8s3phmca2","c_muu7q2c8r12v"],"name":"Frost Stalker","notes":"She is always cold for some reason","order":1791150164794,"passive":"Targets the enemy back row. Attacks apply 1 Poison and 1 Chill.","rename":false,"updated":1791315008050},"c_muu98ulvacc4":{"ess":["frost","ward"],"from":["c_muu8dtb3foya","c_muu7pu09ggnx"],"name":"Glacier Warden","notes":"","order":1791144594931,"passive":"Attackers that hit it gain 2 Chill, and enemies attacking it don't halve their Chill.","updated":1791253549203},"c_muu8rt2490lr":{"ess":["swift"],"from":["c_muu893hhv45u"],"name":"Acrobat","notes":"","order":1791143799772,"passive":"When in the front row get 20% dodge. When in the back row get 15% attack speed.\n","updated":1791221492028},"c_muu8omul8tqu":{"ess":["edge","edge","swift","swift"],"from":["c_muu8kqk3v3ck","c_muu8s3phmca2"],"name":"Blade dancer","notes":"","order":1791143651757,"passive":"+15% dodge. Each dodge gives +5% crit chance and each crit gives +5% dodge, for the rest of the fight.","rename":false,"updated":1791339657856},"c_muu8kfxb9l85":{"ess":["edge"],"from":["c_muu893hhv45u","c_muu88mtm5j3i"],"name":"Swordsman","notes":"","order":1791143456159,"passive":"Crits do an extra 25% damage. This increases by 25% for each affliction on the target.","updated":1791297966757},"c_muu81homh3tq":{"ess":["ember","ember","ember"],"from":["c_muu81a83luco"],"name":"Pyromancer","notes":"","order":1791142571974,"passive":"Her attacks hit every enemy for 60% damage and apply her Burn to each.","updated":1791297966757},"c_muuaifyzo8vc":{"ess":["frost","edge"],"from":["c_muu7pu09ggnx","c_muu8kfxb9l85"],"name":"Frostblade","notes":"","order":1791146722139,"passive":"Crits apply 4 Chill. When an enemy becomes Frozen, his next attack targets it.","updated":1791251442429},"c_muubf8nae0xm":{"ess":["vital","swift"],"from":["c_muu8rt2490lr","c_muu8t3slx20j"],"name":"Monk","notes":"","order":1791148252294,"passive":"+15% dodge. Counterattacks after dodging.","updated":1791253549203},"c_muu8t3slx20j":{"ess":["vital"],"from":["c_muu88mtm5j3i","c_muu7pm5ad90i"],"name":"Healer","notes":"","order":1791143860341,"passive":"Every 3 seconds, heal the most injured ally 4. Healing you apply to heroes below a quarter hp is increased by 50%.","rename":false,"updated":1791223967688},"c_muu95oxqva1i":{"ess":["venom","venom","venom"],"from":["c_muu93w65k55t"],"name":"Venomancer","notes":"","order":1791144447614,"passive":"At the start of each fight, the lowest-HP enemy gains 20 Poison. Poison on Festering enemies doesn't decay.","rename":false,"updated":1791297966757},"c_muucnefb450t":{"ess":["ember","ember","swift","swift"],"from":["c_muu8trhnchpq","c_muu81a83luco","c_muu8s3phmca2"],"name":"Flame dancer","notes":"","order":1791150312647,"passive":"+15% dodge. Each dodge leaves 3 Burn on the attacker. Her attacks apply 1 more Burn per 10% dodge she has.","updated":1791315008050},"c_muucnsji9spe":{"ess":["venom","ember","edge","swift"],"from":["c_muu8trhnchpq","c_muuberm8ge8h","c_muu93w65k55t"],"name":"Firebomber","notes":"","order":1791150330942,"passive":"Every 4th attack throws a bomb: every enemy gains 3 Poison and 3 Burn.","rename":false,"updated":1791334901253},"c_muubahl3ny7g":{"ess":["venom","ward","vital","gilt"],"from":["c_muu9fbav9cav","c_muubfqfprgsy","c_muu9resprp7i","c_muu9coiwf8yb"],"name":"Witch Doctor","notes":"","order":1791148030599,"passive":"Her attacks hex the target for 3 seconds: it deals 20% less damage, and allies' hits on it heal them 2.","rename":false,"updated":1791303676191},"c_muub6hrov7i3":{"ess":["swift","swift","gilt","gilt"],"from":["c_muu91gvq8418","c_muu8a0kltcn4"],"name":"Silver tongue","notes":"","order":1791147844212,"passive":"At the start of each fight, the enemy with the highest ATK that is not Stalwart is Charmed for 5 seconds: it attacks 25% slower and deals 25% less damage. Heroes in the market cost 1 less.","updated":1791334901253},"c_muu89hhv5yf5":{"ess":["gilt"],"from":["c_muu893hhv45u","c_muu88mtm5j3i"],"name":"Thief","notes":"","order":1791142944979,"passive":"The first hit on each monster steals 1 gold. (Max 3 per fight)","updated":1791222996544},"c_muu8m2w3w2sq":{"ess":["frost","edge","vital","gilt"],"from":["c_muu8hkj0igmk","c_muuaifyzo8vc","c_muu9coiwf8yb"],"name":"Reaper","notes":"","order":1791143532579,"passive":"Collects a soul from every enemy she kills herself, for the rest of the run. +1 max HP per soul. On a kill, heals 1 per soul.","rename":false,"updated":1791335731227},"c_muu8a0kltcn4":{"ess":["gilt","gilt"],"from":["c_muu89hhv5yf5"],"name":"Merchant","notes":"Buffs people","order":1791142969701,"passive":"+1 gold after every won fight. Allies deal +5% damage per 10 gold held (up to +25%).","updated":1791258317373},"c_muuccpsasvwl":{"ess":["frost","frost","ward","ward"],"from":["c_muu98ulvacc4","c_muu7q2c8r12v","c_muu9ue1x7wfi"],"name":"Icemaiden","notes":"","order":1791149814154,"passive":"Allies start each fight with Shield equal to a tenth of their max HP, on top of any they already have. When an ally's Shield breaks, the attacker gains 5 Chill.","rename":false,"updated":1791303170435},"c_muu9v1dnhifa":{"ess":["ward","ward","ward"],"from":["c_muu9ue1x7wfi"],"name":"Bulwark","notes":"","order":1791145630139,"passive":"Starts each fight with Shield equal to half its max HP. Gains 1 Shield whenever another ally is hit.","updated":1791303170435},"c_muu8lrrukarl":{"ess":["ward","ward","edge","edge"],"from":["c_muu8kqk3v3ck","c_muu9ue1x7wfi"],"name":"Champion","notes":"","order":1791143518170,"passive":"Crits give it Shield equal to a quarter of the damage dealt. Whenever it is not in a duel, challenges the closest enemy.","updated":1791303170435},"c_muu893hhv45u":{"ess":[],"from":[],"name":"Rogue","notes":"","order":1791142926821,"passive":"+1 gold at the end of each round.","updated":1791343610568},"c_muu7pm5ad90i":{"ess":[],"from":[],"name":"Mage","notes":"","order":1791142017886,"passive":"Whenever this hero's attack applies a status, apply 1 more. Whenever this hero heals, heal 1 more.","updated":1791343610568},"c_muu81a83luco":{"ess":["ember","ember"],"from":["c_muu80wgi8uoq"],"name":"Flamecaller","notes":"","order":1791142562307,"passive":"Every 4th attack applies 3 Burn to every enemy.","updated":1791243835448},"c_muu93w65k55t":{"ess":["venom","venom"],"from":["c_muu8sumchvtt"],"name":"Plaguecaller","notes":"","order":1791144363677,"passive":"When a Poisoned enemy dies, all its Poison moves to the lowest-HP enemy.","updated":1791246762515},"c_muua27gbu9q4":{"ess":["ember","frost"],"from":["c_muu7pu09ggnx","c_muu80wgi8uoq"],"name":"Elementalist","notes":"","order":1791145964603,"passive":"Whenever your attack applies Burn, apply an equal amount of Chill. Whenever your attack applies Chill, apply an equal amount of Burn. ","updated":1791247421738},"c_muucdoklpfu4":{"ess":["venom","ember","frost","edge"],"from":["c_muua27gbu9q4","c_muuaifyzo8vc","c_muuberm8ge8h"],"name":"Spellblade","nameIdeas":"","notes":"","order":1791149859237,"passive":"Crits apply 2 of each status the target already has.","rename":false,"updated":1791297966757},"c_muub1s5b46u4":{"ess":["edge","edge","gilt","gilt"],"from":["c_muu8kqk3v3ck","c_muu8hkj0igmk","c_muu8a0kltcn4"],"name":"Bounty hunter","notes":"","order":1791147624383,"passive":"Whenever he is not in a duel, challenges the highest-HP enemy. Winning a duel gives him +1 ATK for the rest of the run.","updated":1791299661275},"c_muuberm8ge8h":{"ess":["venom","edge"],"from":["c_muu8sumchvtt","c_muu8kfxb9l85"],"name":"Cutthroat","notes":"","order":1791148230224,"passive":"Can't be targeted for the first 2 seconds of each fight and for 2 seconds after each kill.","updated":1791251442429},"c_muu9phmxqag5":{"ess":["venom","vital","swift","gilt"],"from":["c_muu9fbav9cav","c_muu91gvq8418","c_muubfqfprgsy","c_muubf8nae0xm"],"name":"Necrodancer","notes":"","order":1791145371273,"passive":"At the start of each fight, summons Wilfred to fight beside her. Wilfred has the Necrodancer's stats.","rename":false,"updated":1791334901253},"c_muu9resprp7i":{"ess":["ward","vital"],"from":["c_muu8t3slx20j","c_muu8dtb3foya"],"name":"Cleric","notes":"","order":1791145460905,"passive":"When an ally's Shield breaks, heals them 5. Healing beyond full HP becomes Shield.","updated":1791256390260},"c_muu9o6j6xwfi":{"ess":["venom","ember","frost","ward"],"from":["c_muu98ulvacc4","c_muu8dwwwleo2","c_muua27gbu9q4"],"name":"Runeguard","notes":"","order":1791145310226,"passive":"When its Shield absorbs a hit, the attacker gains 1 Poison, 1 Burn and 1 Chill.","rename":false,"updated":1791303170435},"c_muu8iedpyjas":{"ess":["venom","edge","swift","gilt"],"from":["c_muu8hkj0igmk","c_muu91gvq8418","c_muubfqfprgsy","c_muuberm8ge8h"],"name":"Assassin","notes":"","order":1791143360845,"passive":"Targets the lowest-HP enemy. Enemies below 5% HP die to her hits.","updated":1791299661275},"c_muu8trhnchpq":{"ess":["ember","swift"],"from":["c_muu8rt2490lr","c_muu80wgi8uoq"],"name":"Berserker","notes":"","order":1791143891051,"passive":"Each hit gives +5% attack speed for the rest of the fight (up to +50%). At the cap, his attacks apply 2 more Burn.","rename":false,"updated":1791258317373},"c_muu9ue1x7wfi":{"ess":["ward","ward"],"from":["c_muu8dtb3foya"],"name":"Shieldmaiden","notes":"","order":1791145599909,"passive":"Attacks deal bonus damage equal to a quarter of her Shield.","updated":1791253549203},"c_muu9oupl17gi":{"ess":["venom","venom","vital","vital"],"from":["c_muu9coiwf8yb","c_muu9fbav9cav","c_muu93w65k55t"],"name":"Necromancer","notes":"","order":1791145341561,"passive":"The first two enemies that die each fight rise as Skeletons that fight for you: a copy of the enemy at half its max HP, with no abilities.","rename":false,"updated":1791334901253},"c_muub9dnnh0qc":{"ess":["edge","vital","swift","gilt"],"from":["c_muu8hkj0igmk","c_muubf8nae0xm"],"name":"Heretic","notes":"","order":1791147978851,"passive":"Her attacks ignore Shield and Armor. Crits heal her 5% of her max HP.","rename":false,"updated":1791334901253},"c_muu88mtm5j3i":{"ess":[],"from":[],"name":"Warrior","notes":"","order":1791142905226,"passive":"Heals 1 every 2 seconds. +1 Armor.","updated":1791343610568},"c_muu7pu09ggnx":{"ess":["frost"],"from":["c_muu7pm5ad90i"],"name":"Frost mage","notes":"","order":1791142028073,"passive":"Attacks apply +1 Chill.","updated":1791235543611},"c_muucd48tezf2":{"ess":["ember","frost","ward","swift"],"from":["c_muu8dwwwleo2","c_muu8trhnchpq","c_muua27gbu9q4","c_muu98ulvacc4"],"name":"Storm dancer","notes":"","order":1791149832894,"passive":"Every 4th attack hits every enemy and applies 2 Burn and 2 Chill to each.","updated":1791315008050},"c_muu9fbav9cav":{"ess":["venom","vital"],"from":["c_muu8t3slx20j","c_muu8sumchvtt"],"name":"Plague doctor","notes":"","order":1791144896503,"passive":"Every second, heals the most injured ally 1 for each Poisoned enemy, 2 for each Festering enemy.","updated":1791258317373},"c_muu8kqk3v3ck":{"ess":["edge","edge"],"from":["c_muu8kfxb9l85"],"name":"Duelist","notes":"","order":1791143469939,"passive":"Challenges the enemy opposite him to a duel at the start of each fight. The two must target each other and take half damage from anyone else's hits.","rename":false,"updated":1791251442429},"c_muu8emlv6f5o":{"ess":["ember","ward","vital","swift"],"from":["c_muu8dwwwleo2","c_muu8trhnchpq","c_muu9resprp7i","c_muubf8nae0xm"],"name":"Phoenix","notes":"","order":1791143184883,"passive":"Once per fight, when it would die, it revives at half HP and every enemy gains 5 Burn.","updated":1791334901253},"c_muubfqfprgsy":{"ess":["venom","gilt"],"from":["c_muu8sumchvtt","c_muu89hhv5yf5"],"name":"Apothecary","notes":"","order":1791148275349,"passive":"At the start of each fight, gives an elixir to the ally who attacks fastest: their attacks apply 2 Poison this fight. If that is her, the next fastest.","updated":1791256390260},"c_muu8dtb3foya":{"ess":["ward"],"from":["c_muu88mtm5j3i"],"name":"Sentinel","notes":"","order":1791143146911,"passive":"Starts each fight with 8 Shield.","updated":1791155000000},"c_muu91gvq8418":{"ess":["swift","gilt"],"from":["c_muu89hhv5yf5","c_muu8rt2490lr"],"name":"Bard","notes":"","order":1791144250550,"passive":"Allies attack 10% faster.","updated":1791258317373},"c_muuczwluamkn":{"ess":["frost","frost","edge","edge"],"from":["c_muuaifyzo8vc","c_muu7q2c8r12v"],"name":"Bladestorm","nameIdeas":"","notes":"","order":1791150896082,"passive":"Crits also hit every other enemy in the target's row for half damage.","rename":false,"updated":1791299661275},"c_muu8v6mqq9lr":{"ess":["swift","swift","swift"],"from":["c_muu8s3phmca2"],"name":"Shadow Archer","notes":"","order":1791143957330,"passive":"Attacks always target the enemy with the highest ATK. Every 4th attack blinds the target: its next attack misses.","rename":false,"updated":1791315008050},"c_muu7q2c8r12v":{"ess":["frost","frost"],"from":["c_muu7pu09ggnx"],"name":"Rimecaller","notes":"","order":1791142038872,"passive":"Every 4th attack applies 5 Chill. Always targets the enemy with the most frost.","rename":false,"updated":1791236934196},"c_muu8dwwwleo2":{"ess":["ember","ward"],"from":["c_muu8dtb3foya","c_muu80wgi8uoq"],"name":"Hearthguard","notes":"","order":1791143151584,"passive":"Attackers that hit him gain 2 Burn. Whenever Burn damages an enemy, he gains 1 Shield (up to 5 a second).","rename":false,"updated":1791253549203}},"recipes":{"r_cl1a109749e05":{"classId":"c_muu7pu09ggnx","need":["frost","frost"],"name":"Deep Freeze","effect":"Deals +1 damage for every 2 Chill on the target. (Max +10 on frozen enemies)","notes":"","status":"keep","updated":1791235109944,"created":1791160000005},"r_cl1a109749e18":{"classId":"c_muu8sumchvtt","need":["vital"],"name":"Bitter Harvest","effect":"When a Poisoned enemy dies, heal the most injured ally 3. If it was Festering, heal every ally 3.","notes":"","status":"idea","updated":1791223734902,"created":1791160000024},"r_cl1a109749e31":{"classId":"c_muu7q2c8r12v","need":["frost","frost","frost"],"name":"Deep Winter","effect":"When a Frozen enemy's attack consumes Chill, half of it moves to the enemy with the next most Chill.","notes":"","status":"idea","updated":1791236930427,"created":1791160000049},"r_cl1a109749e22":{"classId":"c_muu81a83luco","need":["ember","swift"],"name":"Stoked","effect":"While every enemy is Burning, +25% attack speed. Doubles to 50% if every enemy is ablaze.","notes":"","status":"idea","updated":1791243933993,"created":1791160000034},"r_cl1a109749e17":{"classId":"c_muu8rt2490lr","need":["gilt"],"name":"Well Prepared","effect":"You dodge the first attack thrown at you.","notes":"","status":"idea","updated":1791221568991,"created":1791160000023},"r_cl1a109749e0d":{"classId":"c_muu8t3slx20j","need":["vital","vital"],"name":"Renew","effect":"Healing you apply to heroes below 50% hp is increased by 50%.","notes":"","status":"idea","updated":1791223983061,"created":1791160000013},"r_cl1a109749e26":{"classId":"c_muua27gbu9q4","need":["ember","frost","ward"],"name":"Conduction","effect":"Gain 1 shield for every 5 burn or frost you apply.","notes":"","status":"idea","updated":1791248018412,"created":1791160000038},"r_cl1a109749e12":{"classId":"c_muu8kfxb9l85","need":["venom"],"name":"Poisoned Blade","effect":"Crits apply 5 Poison.","notes":"","status":"idea","updated":1791221472634,"created":1791160000018},"r_cl1a109749e13":{"classId":"c_muu8kfxb9l85","need":["frost"],"name":"Cold Read","effect":"+2.5% crit chance per Chill on the target.","notes":"","status":"idea","updated":1791221259706,"created":1791160000019},"r_cl1a109749e1c":{"classId":"c_muu8dtb3foya","need":["ember"],"name":"Backdraft","effect":"Whenever your shield breaks, the attacker gains 3 burn.","notes":"Could do \"first time\" but combo's are fun.","status":"idea","updated":1791222888120,"created":1791160000028},"r_cl1a109749e14":{"classId":"c_muu8rt2490lr","need":["ember"],"name":"Juggling Torches","effect":"Every 4th attack hits a second enemy and applies 2 Burn to both.","notes":"","status":"idea","updated":1791221625184,"created":1791160000020},"r_cl1a109749e32":{"classId":"c_muu7q2c8r12v","need":["frost","ward"],"name":"Frostguard","effect":"When an enemy becomes Frozen, gain 6 shield.","notes":"","status":"idea","updated":1791235493705,"created":1791160000050},"r_cl1a109749e63":{"classId":"c_muu93w65k55t","need":["venom","ember"],"name":"Funeral Pyre","effect":"Burn is inherited along with Poison.","notes":"","status":"idea","updated":1791246674420,"created":1791160000099},"r_cl1a109749e15":{"classId":"c_muu8rt2490lr","need":["swift","swift"],"name":"Vault","effect":"When a hit brings you below half HP, leap to the back row and gain 100% dodge for 2 seconds. When you kill an enemy, heal 25% HP and leap to the front row.","notes":"","status":"idea","updated":1791222147412,"created":1791160000021},"r_cl1a109749e16":{"classId":"c_muu8rt2490lr","need":["vital"],"name":"Second Breath","effect":"Front row: each dodge heals you 2. Back row: every 4th attack heals the most injured ally 2.","notes":"","status":"idea","updated":1791221616523,"created":1791160000022},"r_cl1a109749e1a":{"classId":"c_muu8sumchvtt","need":["edge"],"name":"Venom Strike","effect":"Crits make the targets Poison tick once.","notes":"","status":"idea","updated":1791219027429,"created":1791160000026},"r_cl1a109749e0e":{"classId":"c_muu8t3slx20j","need":["ward"],"name":"Bandage","effect":"On heal, additionally apply a 2 health shield.","notes":"","status":"idea","updated":1791223428924,"created":1791160000014},"r_cl1a109749e30":{"classId":"c_muu7q2c8r12v","need":["frost","swift"],"name":"Shatter","effect":"Attacks against frozen targets hit adjacent enemies for half damage.","notes":"","status":"idea","updated":1791235596308,"created":1791160000048},"r_cl1a109749e64":{"classId":"c_muu93w65k55t","need":["venom","venom","venom"],"name":"Pandemic","effect":"Statuses grow by a quarter each time they are inherited.","notes":"","status":"idea","updated":1791246817034,"created":1791160000100},"r_cl1a109749e33":{"classId":"c_muu7q2c8r12v","need":["frost","frost","edge"],"name":"Splinter","effect":"Attacks against a Chilled enemy apply 1 Chill to every other enemy. This doubles on crit.","notes":"Claude draft","status":"idea","updated":1791236287824,"created":1791160000051},"r_cl1a109749e19":{"classId":"c_muu8sumchvtt","need":["venom","venom"],"name":"Virulence","effect":"Once per enemy, when its attack brings that enemy to 8 Poison, the Poison doubles.","notes":"","status":"idea","updated":1791219031425,"created":1791160000025},"r_cl1a109749e1e":{"classId":"c_muu8dtb3foya","need":["vital"],"name":"Protector","effect":"Gain 2 shield whenever an ally is attacked.","notes":"","status":"idea","updated":1791224208755,"created":1791160000030},"r_cl1a109749e25":{"classId":"c_muua27gbu9q4","need":["venom","ember","frost"],"name":"Triple Point","effect":"Attacks against an enemy that is both Burning and Chilled also apply 2 Poison.","notes":"","status":"idea","updated":1791248228362,"created":1791160000037},"r_cl1a109749e1b":{"classId":"c_muu8sumchvtt","need":["gilt"],"name":"Tainted Coin","effect":"Festering enemies drop 1 gold when they die.","notes":"","status":"idea","updated":1791223758589,"created":1791160000027},"r_cl1a109749e23":{"classId":"c_muu81a83luco","need":["ember","ember","vital"],"name":"Cauterize","effect":"When an enemy becomes Ablaze, heal all allies 3.","notes":"","status":"idea","updated":1791243977721,"created":1791160000035},"r_cl1a109749e1f":{"classId":"c_muu8dtb3foya","need":["frost"],"name":"Cold Iron","effect":"While your shield is up, enemy attackers do not halve their chill and instead increase it by 1.","notes":"","status":"idea","updated":1791221053158,"created":1791160000031},"r_cl1a109749e10":{"classId":"c_muu8kfxb9l85","need":["gilt"],"name":"Pristine Gear","effect":"Your first attack each fight is a guaranteed crit.","notes":"","status":"idea","updated":1791221379550,"created":1791160000016},"r_cl1a109749e1d":{"classId":"c_muu8dtb3foya","need":["ward","ward"],"name":"Interpose","effect":"The first hit on each other ally, lands on the the Sentinel instead","notes":"","status":"idea","updated":1791221123885,"created":1791160000029},"r_cl1a109749e0b":{"classId":"c_muu89hhv5yf5","need":["venom"],"name":"Finisher","effect":"Attacks against enemies below half HP apply 2 Poison.","notes":"","status":"idea","updated":1791221877031,"created":1791160000011},"r_cl1a109749e11":{"classId":"c_muu8kfxb9l85","need":["edge","edge"],"name":"Momentum","effect":"Each attack that doesn't crit gives +10% crit chance until one does.","notes":"","status":"idea","updated":1791222169364,"created":1791160000017},"r_cl1a109749e00":{"classId":"c_muu80wgi8uoq","need":["ward"],"name":"Flame Barrier","effect":"Whenever  burning enemy dies, gain the burn as a shield.","notes":"","status":"idea","updated":1791213381681,"created":1791160000000},"r_cl1a109749e09":{"classId":"c_muu89hhv5yf5","need":["edge"],"name":"Backstab","effect":"Your first attack against each enemy does +50% damage. If it crits, the bonus applies to the next attack too.","notes":"","status":"idea","updated":1791221976890,"created":1791160000009},"r_cl1a109749e07":{"classId":"c_muu7pu09ggnx","need":["ward"],"name":"Numbing Cold","effect":"Chilled enemies deal -1 damage. Frozen enemies deal -2 instead.","notes":"","status":"keep","updated":1791235107280,"created":1791160000007},"r_cl1a109749e08":{"classId":"c_muu89hhv5yf5","need":["gilt","gilt"],"name":"Gilded Knives","effect":"Attacks do +1 damage for every 3 gold in the bank. (Max + 5)","notes":"","status":"idea","updated":1791223015166,"created":1791160000008},"r_cl1a109749e02":{"classId":"c_muu80wgi8uoq","need":["swift"],"name":"Stoke","effect":"Attacking a burning enemy grants +5% attack speed for the rest of the battle (Once per enemy).","notes":"","status":"idea","updated":1791223714826,"created":1791160000002},"r_cl1a109749e21":{"classId":"c_muu81a83luco","need":["ember","ward"],"name":"Ashen Guard","effect":"Burn deals double damage to enemy shields. You gain the damage dealt as your own shield.","notes":"You only get the damage dealt to the shield as your own shield. Not all damage.","status":"idea","updated":1791248891519,"created":1791160000033},"r_cl1a109749e24":{"classId":"c_muua27gbu9q4","need":["ember","frost"],"name":"Flash Point","effect":"An enemy that becomes Frozen gains 5 Burn. An enemy that becomes Ablaze gains 10 Chill.","notes":"","status":"idea","updated":1791248277257,"created":1791160000036},"r_cl1a109749e0f":{"classId":"c_muu8t3slx20j","need":["swift"],"name":"Quick Hands","effect":"After healing another hero, you dodge the next attack.","notes":"","status":"idea","updated":1791223418814,"created":1791160000015},"r_cl1a109749e0a":{"classId":"c_muu89hhv5yf5","need":["swift"],"name":"Getaway","effect":"After a kill, dodge the next attack.","notes":"","status":"idea","updated":1791221893971,"created":1791160000010},"r_cl1a109749e01":{"classId":"c_muu80wgi8uoq","need":["ember","ember"],"name":"Fan the Flames","effect":"Ablaze enemies spread 1 burn to adjacent enemies every 2 seconds.","notes":"","status":"idea","updated":1791215551065,"created":1791160000001},"r_cl1a109749e66":{"classId":"c_muu93w65k55t","need":["venom","venom","gilt"],"name":"Pre-dosed","effect":"The lowest-HP enemy starts each fight with 1 Poison per 3 gold you hold (up to 6).","notes":"","status":"idea","updated":1791246772022,"created":1791160000102},"r_cl1a109749e0c":{"classId":"c_muu8t3slx20j","need":["venom"],"name":"Side Effects","effect":"On attack move 2 of each status on a random ally with status to the target.","notes":"","status":"idea","updated":1791224084988,"created":1791160000012},"r_cl1a109749e20":{"classId":"c_muu81a83luco","need":["ember","ember","ember"],"name":"Wildfire","effect":"Whenever you apply burn to an Ablaze enemy, apply 50% to all adjacent enemies.","notes":"This doesn't repeat. E.g. 2 adjacent ablaze enemies do not send burn back and forth repeatably.\n\nThe spread also ignores bonuses. If the main enemy gets 6 burn, the adjacent ones get 3.\n\nRounds down","status":"idea","updated":1791247949461,"created":1791160000032},"r_cl1a109749e03":{"classId":"c_muu80wgi8uoq","need":["frost"],"name":"Scald","effect":"Enemies who are both Burning and Chilled get +1 status from this hero.","notes":"","status":"idea","updated":1791223701410,"created":1791160000003},"r_muvdxg1pfp65":{"classId":"c_muu7pu09ggnx","need":["ember"],"name":"Frostburn","effect":"Enemies who are both Burning and Chilled take 2 more damage from heroes. Frozen and Ablaze enemies take 8 more instead.","notes":"","status":"keep","updated":1791235101995,"created":1791212927101},"r_muvdxk5q87vh":{"classId":"c_muu7pu09ggnx","need":["edge"],"name":"Precise Cut","effect":"Attacks against Frozen enemies are guaranteed to crit.","notes":"","status":"keep","updated":1791235104944,"created":1791212932430},"r_muvy4xptqm84":{"classId":"c_muu93w65k55t","need":["venom","vital"],"name":"Grave Tonic","effect":"Target Festering enemies. When a festering enemy dies, split is poison among all allies as healing.","notes":"","status":"idea","updated":1791247144999,"created":1791246868913},"r_muvyndxg2mf8":{"classId":"c_muua27gbu9q4","need":["edge","swift"],"name":"Give and Take","effect":"Whenever you Crit, apply 2 Burn to all enemies. Whenever you dodge, apply 2 Chill  to the attacker.","notes":"","status":"idea","updated":1791248307412,"created":1791247729732},"r_pvqx4dm4tqmx":{"classId":"c_muu8kqk3v3ck","created":1791251442429,"effect":"+25% dodge against his duel opponent. Dodging him gives +5% crit chance for the rest of the fight.","name":"Footwork","need":["edge","swift"],"notes":"","status":"idea","updated":1791339657856},"r_al7ukvdz3r0y":{"classId":"c_muu8kqk3v3ck","created":1791251442429,"effect":"Gains 2 Shield when he strikes and +2 ATK when struck (up to +10).","name":"Parry","need":["ward","edge"],"notes":"","status":"idea","updated":1791251442429},"r_1j509asb9w9o":{"classId":"c_muu8kqk3v3ck","created":1791251442429,"effect":"Stakes up to 5 gold at the start of each fight. If he wins his duel, the stake doubles.","name":"Wager","need":["edge","edge","gilt"],"notes":"","status":"idea","updated":1791251442429},"r_p2vj47iwan4k":{"classId":"c_muu8kqk3v3ck","created":1791251442429,"effect":"Attacks against his duel opponent, elites and bosses below a quarter HP always crit.","name":"Finishing Lunge","need":["edge","edge","edge"],"notes":"","status":"idea","updated":1791251442429},"r_7ib5avfoapil":{"classId":"c_muuaifyzo8vc","created":1791251442429,"effect":"Crits against Frozen enemies deal +50% damage.","name":"Rime Edge","need":["frost","edge"],"notes":"","status":"idea","updated":1791251442429},"r_f0n7kv0qad9u":{"classId":"c_muuaifyzo8vc","created":1791251442429,"effect":"Deals double damage to Crippled enemies. Heals a quarter of the damage he deals.","name":"Cold Blood","need":["venom","vital"],"notes":"","status":"idea","updated":1791251442429},"r_mx7z6jdt6lmx":{"classId":"c_muuaifyzo8vc","created":1791251442429,"effect":"His first crit each fight applies 20 Chill.","name":"Whetstone","need":["frost","edge","gilt"],"notes":"","status":"idea","updated":1791251442429},"r_i6yf43jm3omb":{"classId":"c_muuaifyzo8vc","created":1791251442429,"effect":"+5% attack speed per Chilled enemy, +10% per Frozen (up to +30%).","name":"Glacial Rush","need":["frost","edge","swift"],"notes":"","status":"idea","updated":1791251442429},"r_5ew71a4hih5r":{"classId":"c_muuberm8ge8h","created":1791251442429,"effect":"While untargetable, always crits.","name":"Ambush","need":["edge","swift"],"notes":"","status":"idea","updated":1791251442429},"r_24evydixzgqt":{"classId":"c_muuberm8ge8h","created":1791251442429,"effect":"Becomes untargetable for 2 seconds whenever an enemy becomes Frozen or Festering. Attacks against Crippled enemies deal +50%.","name":"Slip Away","need":["venom","frost"],"notes":"","status":"idea","updated":1791251442429},"r_gjjj8ygevele":{"classId":"c_muuberm8ge8h","created":1791251442429,"effect":"Crits also apply Burn equal to a quarter of the target's Poison.","name":"Caustic Flare","need":["venom","ember","edge"],"notes":"","status":"idea","updated":1791251442429},"r_6803i033zfol":{"classId":"c_muuberm8ge8h","created":1791251442429,"effect":"Crits deal bonus damage equal to half the target's Poison.","name":"Bounty Blade","need":["venom","edge","gilt"],"notes":"","status":"idea","updated":1791251442429},"r_j0e91b7k046y":{"classId":"c_muu8hkj0igmk","created":1791251442429,"effect":"Kills by allies trigger his on-kill effects, gems included.","name":"Shared Contract","need":["edge","gilt"],"notes":"","status":"idea","updated":1791251442429},"r_qknwfuedpfnt":{"classId":"c_muu8hkj0igmk","created":1791251442429,"effect":"+20% attack speed until his first kill each fight.","name":"Eager","need":["swift","gilt"],"notes":"","status":"idea","updated":1791251442429},"r_4bm1jox8allf":{"classId":"c_muu8hkj0igmk","created":1791251442429,"effect":"Each kill heals him a quarter of his missing HP.","name":"Second Wind","need":["vital","edge","gilt"],"notes":"","status":"idea","updated":1791251442429},"r_y3psewid04ea":{"classId":"c_muu8hkj0igmk","created":1791251442429,"effect":"Enemies below a quarter HP take +50% damage from him.","name":"Mark for Death","need":["venom","edge","gilt"],"notes":"","status":"idea","updated":1791251442429},"r_2618nh2dfroy":{"classId":"c_muu9ue1x7wfi","created":1791253549203,"effect":"Her Shield reflects a quarter of the damage it absorbs back to the attacker.","name":"Spiked Shield","need":["ward","edge"],"notes":"","status":"idea","updated":1791253549203},"r_k6oraggndzil":{"classId":"c_muu9ue1x7wfi","created":1791253549203,"effect":"Attackers that break her Shield gain 5 Chill.","name":"Frost Rim","need":["frost","ward"],"notes":"","status":"idea","updated":1791253549203},"r_5rxitvk4x517":{"classId":"c_muu9ue1x7wfi","created":1791253549203,"effect":"Whenever she gains Shield, adjacent allies gain 1 Shield.","name":"Phalanx","need":["ward","ward","vital"],"notes":"","status":"idea","updated":1791253549203},"r_ex6uhh97nnmh":{"classId":"c_muu9ue1x7wfi","created":1791253549203,"effect":"Every 4th attack gets double her Shield bonus and hits every enemy in the target's row.","name":"Shield Slam","need":["ward","ward","ward"],"notes":"","status":"idea","updated":1791253549203},"r_xn9pvvr5tlgy":{"classId":"c_muu98ulvacc4","created":1791253549203,"effect":"When an enemy becomes Frozen, every other enemy gains 3 Chill.","name":"Avalanche","need":["frost","swift"],"notes":"","status":"idea","updated":1791253549203},"r_kw2duwzl6kzj":{"classId":"c_muu98ulvacc4","created":1791253549203,"effect":"Every 4th attack applies 4 Burn. All allies target that enemy for 2 seconds.","name":"Branding Blow","need":["ember","swift"],"notes":"","status":"idea","updated":1791253549203},"r_a31oib1s1qub":{"classId":"c_muu98ulvacc4","created":1791253549203,"effect":"Takes 1 less damage per 4 Chill on the attacker (up to 5).","name":"Glacier","need":["frost","frost","ward"],"notes":"","status":"idea","updated":1791253549203},"r_ma7btmvnlpd3":{"classId":"c_muu98ulvacc4","created":1791253549203,"effect":"Frozen enemies that hit it gain 5 Poison.","name":"Rime Rot","need":["venom","frost","ward"],"notes":"","status":"idea","updated":1791253549203},"r_0iy05eyk0b70":{"classId":"c_muu8dwwwleo2","created":1791253549203,"effect":"When his Shield breaks, the attacker gains 5 Burn.","name":"Hearthfire","need":["ember","ward"],"notes":"","status":"idea","updated":1791253549203},"r_kbocmhiz81xe":{"classId":"c_muu8dwwwleo2","created":1791253549203,"effect":"+5% dodge for each Burning enemy (up to +30%).","name":"Hot Feet","need":["ember","swift"],"notes":"","status":"idea","updated":1791253549203},"r_kagg3epg3829":{"classId":"c_muu8dwwwleo2","created":1791253549203,"effect":"When he hits an enemy, its Burn doesn't decay on the next tick.","name":"Kiln","need":["ember","frost","ward"],"notes":"","status":"idea","updated":1791253549203},"r_sv430yux2uzb":{"classId":"c_muu8dwwwleo2","created":1791253549203,"effect":"When his Shield breaks, heals 1 per Burning enemy.","name":"Ashes","need":["ember","ward","vital"],"notes":"","status":"idea","updated":1791253549203},"r_2x1c0r4vwou8":{"classId":"c_muubf8nae0xm","created":1791253549203,"effect":"Each dodge heals him a tenth of his max HP. Each hit he takes gives +10% dodge until his next dodge.","name":"Flow","need":["vital","swift"],"notes":"","status":"idea","updated":1791253549203},"r_qqzuq14yxwkn":{"classId":"c_muubf8nae0xm","created":1791253549203,"effect":"Counterattacks always crit.","name":"Pressure Point","need":["edge","swift"],"notes":"","status":"idea","updated":1791253549203},"r_gvv2xe6u76kj":{"classId":"c_muubf8nae0xm","created":1791253549203,"effect":"A dodged attack lands on the enemy next to the attacker for half damage.","name":"Deflect","need":["venom","ward","swift"],"notes":"","status":"idea","updated":1791253549203},"r_lc9bbais7wif":{"classId":"c_muubf8nae0xm","created":1791253549203,"effect":"Starts each fight with +20% dodge, losing 5% each time he is hit.","name":"Composure","need":["vital","swift","gilt"],"notes":"","status":"idea","updated":1791253549203},"r_r0anx3zlnb9d":{"classId":"c_muu9resprp7i","created":1791256390260,"effect":"Allies start each fight with Shield equal to a tenth of their max HP.","name":"Consecrate","need":["ward","gilt"],"notes":"","status":"idea","updated":1791256390260},"r_y4jyjrq39mbn":{"classId":"c_muu9resprp7i","created":1791256390260,"effect":"When her heal lands on an ally, that ally attacks 15% faster for 3 seconds. Stacks.","name":"Rally","need":["vital","swift"],"notes":"","status":"idea","updated":1791256390260},"r_vuojkjq03vmv":{"classId":"c_muu9resprp7i","created":1791256390260,"effect":"On each attack, curses the target. The next attack to hit an ally diverts a fifth of its damage to the cursed enemy.","name":"Holy Shield","need":["venom","ember","vital"],"notes":"","status":"idea","updated":1791256390260},"r_mq9u3ucd95qu":{"classId":"c_muu9resprp7i","created":1791256390260,"effect":"Enemies that break an ally's Shield gain 3 Burn.","name":"Holy Fire","need":["ember","ward","vital"],"notes":"","status":"idea","updated":1791256390260},"r_t0el5rmbzhyj":{"classId":"c_muu9coiwf8yb","created":1791256390260,"effect":"Attacks against Festering enemies cost her no HP and heal double.","name":"Sanguine","need":["venom","vital"],"notes":"","status":"idea","updated":1791256390260},"r_avb1dpnq5lu8":{"classId":"c_muu9coiwf8yb","created":1791256390260,"effect":"Her crits heal every ally for the damage dealt. +10% crit chance for each affliction on the target.","name":"Hemorrhage","need":["vital","edge"],"notes":"","status":"idea","updated":1791297966757},"r_zr67tqfbihdg":{"classId":"c_muu9coiwf8yb","created":1791256390260,"effect":"Starts each fight with a blood reserve of 1 per 2 gold held. Each attack also draws 2 from the reserve, if any, for +50% damage.","name":"Stockpile","need":["vital","vital","gilt"],"notes":"","status":"idea","updated":1791256390260},"r_dsf73xd50jt6":{"classId":"c_muu9coiwf8yb","created":1791256390260,"effect":"Healing she does beyond full HP is dealt as damage to her target.","name":"Crimson Tide","need":["vital","vital","vital"],"notes":"","status":"idea","updated":1791256390260},"r_pq4wqozwdnuf":{"classId":"c_muu9fbav9cav","created":1791256390260,"effect":"Poisoned enemies receive half as much healing.","name":"Quarantine","need":["venom","vital"],"notes":"","status":"idea","updated":1791256390260},"r_p8m5ypfqtsrd":{"classId":"c_muu9fbav9cav","created":1791256390260,"effect":"His attacks move all Poison, Burn and Chill from the most afflicted ally to the target.","name":"Rounds","need":["venom","swift"],"notes":"","status":"idea","updated":1791258317373},"r_8t8d3uifrhsa":{"classId":"c_muu9fbav9cav","created":1791256390260,"effect":"Every 4 seconds, applies 1 Poison to every enemy.","name":"Miasma","need":["venom","venom","vital"],"notes":"","status":"idea","updated":1791256390260},"r_h3bzvt0gmn1f":{"classId":"c_muu9fbav9cav","created":1791256390260,"effect":"Festering enemies deal 20% less damage.","name":"Sickbed","need":["venom","ward","vital"],"notes":"","status":"idea","updated":1791257221407},"r_gz3d15r53i13":{"classId":"c_muubfqfprgsy","created":1791256390260,"effect":"She drinks the elixir too.","name":"Second Dose","need":["venom","gilt"],"notes":"","status":"idea","updated":1791256390260},"r_wrzu3jru0554":{"classId":"c_muubfqfprgsy","created":1791256390260,"effect":"The elixir ally also gets +15% crit chance and +25% attack speed.","name":"Whetting Oil","need":["edge","swift"],"notes":"","status":"idea","updated":1791256390260},"r_2k0eczy5r8vz":{"classId":"c_muubfqfprgsy","created":1791256390260,"effect":"Her attacks against Poisoned enemies apply 3 more Poison.","name":"Concentrate","need":["venom","venom","gilt"],"notes":"","status":"idea","updated":1791256390260},"r_t7o7s0onyzfw":{"classId":"c_muubfqfprgsy","created":1791256390260,"effect":"The elixir ally heals 2 whenever they hit a Festering enemy. Elixirs apply 1 more Poison, plus 1 per 10 gold held (up to +5).","name":"Rare Reagents","need":["venom","vital","gilt"],"notes":"","status":"idea","updated":1791256390260},"r_0ws9axvnq6pe":{"classId":"c_muu8s3phmca2","created":1791257221407,"effect":"Attacks ignore Armor.","name":"Piercing Hits","need":["edge","swift"],"notes":"","status":"idea","updated":1791257221407},"r_cmb4akd27lfa":{"classId":"c_muu8s3phmca2","created":1791257221407,"effect":"Her follow-up attacks apply 3 Chill.","name":"Cutting Wind","need":["frost","swift"],"notes":"","status":"idea","updated":1791257221407},"r_wk3ysrrpqp3w":{"classId":"c_muu8s3phmca2","created":1791257221407,"effect":"Her follow-up attacks also hit the enemy adjacent to the target, and apply 2 Burn to both.","name":"Firewind","need":["ember","swift","swift"],"notes":"","status":"idea","updated":1791257221407},"r_9zld51he0ncd":{"classId":"c_muu8s3phmca2","created":1791257221407,"effect":"Her follow-up attacks deal full damage and trigger on crits from any row.","name":"Gale","need":["swift","swift","swift"],"notes":"","status":"idea","updated":1791258317373},"r_pf2ofj4fk6i0":{"classId":"c_muu8trhnchpq","created":1791257221407,"effect":"Being hit also counts as a hit for his stacks.","name":"Bloodrush","need":["ember","swift"],"notes":"","status":"idea","updated":1791257221407},"r_akviryx88wru":{"classId":"c_muu8trhnchpq","created":1791257221407,"effect":"+2% crit chance per attack-speed stack (up to +20%).","name":"Reckless","need":["ember","edge"],"notes":"","status":"idea","updated":1791257221407},"r_zw1w5eurjdwh":{"classId":"c_muu8trhnchpq","created":1791257221407,"effect":"Below a quarter HP, his stack bonuses are doubled and each hit heals him a fifth of the damage dealt.","name":"Battle Trance","need":["ember","vital","swift"],"notes":"","status":"idea","updated":1791258317373},"r_d2yb5oadl926":{"classId":"c_muu8trhnchpq","created":1791257221407,"effect":"At max stacks, takes 20% less damage.","name":"Unstoppable","need":["ember","ward","swift"],"notes":"","status":"idea","updated":1791257221407},"r_k8tt7vm3us5k":{"classId":"c_muu91gvq8418","created":1791257221407,"effect":"Allies attack 25% faster for the first 3 seconds of each fight. +2 gold for each enemy that dies in that time.","name":"Overture","need":["swift","gilt"],"notes":"","status":"idea","updated":1791258317373},"r_zdg3rwh0cnvm":{"classId":"c_muu91gvq8418","created":1791257221407,"effect":"Whenever an ally crits, every ally gains 15% dodge for 2 seconds. Whenever an ally dodges, every ally gains 15% crit chance for 2 seconds. Doesn't stack.","name":"Two Step","need":["edge","swift"],"notes":"","status":"idea","updated":1791258317373},"r_gh2s3xt97uql":{"classId":"c_muu91gvq8418","created":1791257221407,"effect":"When an enemy dies, allies attack 20% faster for 3 seconds.","name":"Crescendo","need":["swift","swift","gilt"],"notes":"","status":"idea","updated":1791258317373},"r_llz0bjyoz2pq":{"classId":"c_muu91gvq8418","created":1791257221407,"effect":"Allies heal 2 whenever they dodge or crit.","name":"Ballad","need":["vital","swift","gilt"],"notes":"","status":"idea","updated":1791257221407},"r_i1rabc8214e0":{"classId":"c_muu8a0kltcn4","created":1791257221407,"effect":"Allies start each fight with 1 Shield per 4 gold held (up to 10).","name":"Hired Guards","need":["ward","gilt"],"notes":"","status":"idea","updated":1791257221407},"r_367gur6mceqz":{"classId":"c_muu8a0kltcn4","created":1791257221407,"effect":"Market rerolls in the next shop cost 1 less.","name":"Fast Talker","need":["swift","gilt"],"notes":"","status":"idea","updated":1791258317373},"r_ur4mnfrutl2c":{"classId":"c_muu8a0kltcn4","created":1791257221407,"effect":"Allies deal +25% damage to elites and bosses.","name":"Danger Money","need":["edge","gilt","gilt"],"notes":"","status":"idea","updated":1791257221407},"r_2vbhjlxgsyfy":{"classId":"c_muu8a0kltcn4","created":1791257221407,"effect":"The hoard bonus cap is doubled. Interest cap +1.","name":"Deep Pockets","need":["gilt","gilt","gilt"],"notes":"","status":"idea","updated":1791257221407},"r_r38zex2jh00d":{"classId":"c_muu7r2uqpswr","created":1791295650655,"effect":"All enemies start each fight with 10 Chill.","name":"Cold Reception","need":["frost","frost","gilt"],"notes":"","status":"idea","updated":1791297966757},"r_h0iwn5xnff8v":{"classId":"c_muu7r2uqpswr","created":1791295650655,"effect":"Chill she applies to Burning enemies is doubled.","name":"Frostfire","need":["ember","ember","frost","frost"],"notes":"","status":"idea","updated":1791295650655},"r_apyyhhgg7zaf":{"classId":"c_muu7r2uqpswr","created":1791295650655,"effect":"Her hits on Frozen enemies also hit every other Frozen enemy for half.","name":"Shardstorm","need":["frost","frost","edge","edge"],"notes":"","status":"idea","updated":1791297966757},"r_32q5ac9j92p4":{"classId":"c_muu7r2uqpswr","created":1791295650655,"effect":"When a Chilled enemy attacks, it takes 1 damage per Chill it has.","name":"Frostbite","need":["frost","frost","frost","frost","frost"],"notes":"","status":"idea","updated":1791295650655},"r_hdxkc3e61qyn":{"classId":"c_muu81homh3tq","created":1791295650655,"effect":"+5% attack speed per Ablaze enemy. When an Ablaze enemy dies, its bonus doubles and stays for the fight.","name":"Flashover","need":["ember","ember","swift","swift"],"notes":"","status":"idea","updated":1791297966757},"r_c4a6uwhvyxzl":{"classId":"c_muu81homh3tq","created":1791295650655,"effect":"Each second, gains 1 Shield per Ablaze enemy.","name":"Heat Shield","need":["ember","ember","ember","ward"],"notes":"","status":"idea","updated":1791295650655},"r_bnd5cdr0je37":{"classId":"c_muu81homh3tq","created":1791295650655,"effect":"Ablaze enemies' Burn floor is 20 instead of 10.","name":"Firestorm","need":["ember","ember","ember","ember","ember"],"notes":"","status":"idea","updated":1791295650655},"r_3maibk6a4rhd":{"classId":"c_muu81homh3tq","created":1791295650655,"effect":"Every enemy starts each fight Ablaze.","name":"Supernova","need":["ember","ember","ember","ember","ember","ember"],"notes":"","status":"idea","updated":1791295650655},"r_si7gdavuj8b6":{"classId":"c_muu95oxqva1i","created":1791295650655,"effect":"Always targets the enemy with the most Poison.","name":"Fixation","need":["venom","gilt","gilt"],"notes":"","status":"idea","updated":1791295650655},"r_dck9orbmrbzq":{"classId":"c_muu95oxqva1i","created":1791295650655,"effect":"Festering enemies gain 2 Chill a second.","name":"Rigor","need":["venom","venom","venom","frost"],"notes":"","status":"idea","updated":1791295650655},"r_hxsrquicfdql":{"classId":"c_muu95oxqva1i","created":1791295650655,"effect":"Crits against Festering enemies add half the target's Poison again.","name":"Overdose","need":["venom","venom","edge","edge"],"notes":"","status":"idea","updated":1791297966757},"r_dvpz95n7hzuc":{"classId":"c_muu95oxqva1i","created":1791295650655,"effect":"Every enemy starts each fight with 20 Poison, not just the lowest.","name":"Plague","need":["venom","venom","venom","venom","venom"],"notes":"","status":"idea","updated":1791295650655},"r_2cjhxbphhvkj":{"classId":"c_muu7sibtrs2m","created":1791295650655,"effect":"Whenever an enemy loses Chill by attacking, the Chill lost becomes Poison on it.","name":"Leeching Poison","need":["venom","frost","gilt","gilt"],"notes":"","status":"idea","updated":1791297966757},"r_z4bdg886hzqo":{"classId":"c_muu7sibtrs2m","created":1791295650655,"effect":"Every 4th attack removes all status stacks from the target and deals 1 damage per stack removed, doubled for each affliction on it. The afflictions are cleared.","name":"Detonate","need":["ember","ember","edge","edge"],"notes":"","status":"idea","updated":1791297966757},"r_xrhdl5hueyjt":{"classId":"c_muu7sibtrs2m","created":1791295650655,"effect":"Each second, every ally heals 1 per affliction on the enemy side.","name":"Panacea","need":["vital","vital","vital"],"notes":"","status":"idea","updated":1791297966757},"r_74ukq33uibpd":{"classId":"c_muu7sibtrs2m","created":1791295650655,"effect":"Enemies carrying all three statuses are Ruined at once, whatever their stacks.","name":"Convergence","need":["venom","venom","ember","ember","frost","frost"],"notes":"","status":"idea","updated":1791295650655},"r_awlmgas4r89e":{"classId":"c_muucdoklpfu4","created":1791295650655,"effect":"Crits against an enemy carrying all three statuses attack again at once. Each extra attack has half the crit chance of the one before; a guaranteed crit counts as 100%.","name":"Elemental Rush","need":["venom","ember","frost","swift","swift"],"notes":"","status":"idea","updated":1791335731227},"r_3w0bmokvfczz":{"classId":"c_muucdoklpfu4","created":1791295650655,"effect":"+15% crit chance per affliction on the target.","name":"Executioner's Eye","need":["edge","edge","edge"],"notes":"","status":"idea","updated":1791297966757},"r_2zjth52yjgoh":{"classId":"c_muucdoklpfu4","created":1791295650655,"effect":"Crits heal him 2 per status on the target.","name":"Siphon","need":["vital","vital","edge","edge"],"notes":"","status":"idea","updated":1791297966757},"r_kmv5p7fumy2k":{"classId":"c_muucdoklpfu4","created":1791295650655,"effect":"Crits against Ruined enemies deal triple damage.","name":"Trinity Strike","need":["venom","ember","frost","edge","edge","edge"],"notes":"","status":"idea","updated":1791295650655},"r_1ppx6to4owlp":{"classId":"c_muuayv3nak54","created":1791298365461,"effect":"When his duel opponent attacks him, 25% chance to strike back at once and gain Shield equal to a quarter of the damage dealt.","name":"Riposte","need":["ward","ward","edge"],"notes":"","status":"idea","updated":1791299661275},"r_5whfd4lkd0ke":{"classId":"c_muuayv3nak54","created":1791298365461,"effect":"After a crit, his next attack comes twice as fast.","name":"Flurry","need":["edge","edge","swift","swift"],"notes":"","status":"idea","updated":1791299661275},"r_uwqa8cztb380":{"classId":"c_muuayv3nak54","created":1791298365461,"effect":"His kills pay 2 gold, and his next attack after a kill crits.","name":"Reaper's Toll","need":["edge","edge","gilt","gilt"],"notes":"","status":"idea","updated":1791298365461},"r_kogd0thef2gf":{"classId":"c_muuayv3nak54","created":1791298365461,"effect":"Every attack crits.","name":"Perfect Form","need":["edge","edge","edge","edge","edge"],"notes":"","status":"idea","updated":1791298365461},"r_rdupyymo7ndx":{"classId":"c_muuczwluamkn","created":1791298365461,"effect":"Gains 2 Shield per enemy hit by a crit.","name":"Ice Guard","need":["frost","ward","ward"],"notes":"","status":"idea","updated":1791299661275},"r_49a8u2zvey5c":{"classId":"c_muuczwluamkn","created":1791298365461,"effect":"Whenever an enemy becomes Frozen, attacks again at once.","name":"Cascade","need":["edge","edge","swift","swift"],"notes":"","status":"idea","updated":1791299661275},"r_da67c0wbsnhc":{"classId":"c_muuczwluamkn","created":1791298365461,"effect":"+10% attack speed per Frozen enemy.","name":"Blizzard Step","need":["frost","frost","swift","swift"],"notes":"","status":"idea","updated":1791298365461},"r_w1sbbkh0xhyr":{"classId":"c_muuczwluamkn","created":1791298365461,"effect":"Crits against Frozen enemies apply 20 Chill to every other enemy in the row.","name":"Whiteout","need":["frost","frost","frost","edge","edge","edge"],"notes":"","status":"idea","updated":1791299661275},"r_1v8b7rob93rg":{"classId":"c_muucqat9mbn7","created":1791298365461,"effect":"After each kill, every enemy gains 3 Poison.","name":"Venom Step","need":["venom","venom","swift"],"notes":"","status":"idea","updated":1791298365461},"r_srj0q6d4cmxi":{"classId":"c_muucqat9mbn7","created":1791298365461,"effect":"Frozen enemies can't target her.","name":"Frost Shadow","need":["frost","frost","swift","swift"],"notes":"","status":"idea","updated":1791299661275},"r_56x9znbm8ssy":{"classId":"c_muucqat9mbn7","created":1791298365461,"effect":"Crits against Festering enemies apply 10 Chill. Crits against Crippled enemies deal +50% damage.","name":"Cripple","need":["venom","venom","edge","edge"],"notes":"","status":"idea","updated":1791299661275},"r_2v58zj64iyow":{"classId":"c_muucqat9mbn7","created":1791298365461,"effect":"Crits make her untargetable for 1 second. Doesn't retrigger while she already is.","name":"Phantom","need":["edge","edge","swift","swift","swift"],"notes":"","status":"idea","updated":1791299661275},"r_xopioagygbv2":{"classId":"c_muu8iedpyjas","created":1791298365461,"effect":"Her execute threshold rises 1% per 4 Poison on the target.","name":"Poisoned Needle","need":["venom","venom","gilt","gilt"],"notes":"","status":"idea","updated":1791299661275},"r_3vi10uuqxf4d":{"classId":"c_muu8iedpyjas","created":1791298365461,"effect":"+20% attack speed against enemies below half HP.","name":"Quick Kill","need":["swift","swift","swift"],"notes":"","status":"idea","updated":1791299661275},"r_rw9jxubs1tak":{"classId":"c_muu8iedpyjas","created":1791298365461,"effect":"Each attack hits twice. The second hit deals half damage.","name":"Double Tap","need":["edge","edge","swift","swift"],"notes":"","status":"idea","updated":1791299809222},"r_aa3uk812wg3d":{"classId":"c_muu8iedpyjas","created":1791298365461,"effect":"Her execute threshold is 10% higher. Executes pay 3 gold.","name":"Dead or Alive","need":["edge","edge","gilt","gilt","gilt"],"notes":"","status":"idea","updated":1791299661275},"r_ttntwnu2esc5":{"classId":"c_muub1s5b46u4","created":1791298365461,"effect":"Gains Shield equal to his ATK when he starts a duel.","name":"Bodyguard","need":["ward","ward","edge"],"notes":"","status":"idea","updated":1791299661275},"r_oowz9id7nn89":{"classId":"c_muub1s5b46u4","created":1791298365461,"effect":"+25% damage to his duel opponent for each duel he has won this fight.","name":"Headhunter","need":["edge","edge","edge","gilt"],"notes":"","status":"idea","updated":1791298365461},"r_x29xgr09fp4t":{"classId":"c_muub1s5b46u4","created":1791298365461,"effect":"At the start of each duel, his opponent gains 20 Chill and 15 Poison.","name":"Cheat","need":["venom","venom","frost","frost"],"notes":"","status":"idea","updated":1791299661275},"r_npli9retnqea":{"classId":"c_muub1s5b46u4","created":1791298365461,"effect":"Elites and bosses take 50% more damage from him. Killing one pays 10 gold.","name":"Wanted","need":["edge","edge","gilt","gilt","gilt"],"notes":"","status":"idea","updated":1791298365461},"r_vxrynh9dul4y":{"classId":"c_muu9v1dnhifa","created":1791299830405,"effect":"Allies in its row take 1 less damage per 10 Shield it has (up to 3).","name":"Fortress","need":["ward","vital","vital"],"notes":"","status":"idea","updated":1791303170435},"r_7ugzhce2bghq":{"classId":"c_muu9v1dnhifa","created":1791299830405,"effect":"When its Shield absorbs a hit, the attacker takes half the damage absorbed.","name":"Spiked Wall","need":["ward","ward","edge","edge"],"notes":"","status":"idea","updated":1791299830405},"r_naxm86a4sfqd":{"classId":"c_muu9v1dnhifa","created":1791299830405,"effect":"Can't be crit. The first time she would die each fight, she holds at 1 HP and regains her starting Shield.","name":"Immovable","need":["ember","ward","ward","swift"],"notes":"","status":"idea","updated":1791303170435},"r_tzm6nmlxc3ri":{"classId":"c_muu9v1dnhifa","created":1791299830405,"effect":"Whenever she gains Shield, every ally gains a quarter of it (rounded down).","name":"Rampart","need":["ward","ward","ward","ward","ward"],"notes":"","status":"idea","updated":1791303170435},"r_b84yievdab36":{"classId":"c_muu8lrrukarl","created":1791299830405,"effect":"Enemies forced to attack it deal 15% less damage.","name":"Challenge","need":["ward","gilt","gilt"],"notes":"","status":"idea","updated":1791303170435},"r_fsz7rvcgk0mt":{"classId":"c_muu8lrrukarl","created":1791299830405,"effect":"When its Shield absorbs a hit, 25% chance to strike back at once.","name":"Counter Guard","need":["edge","edge","swift","swift"],"notes":"","status":"idea","updated":1791303170435},"r_mj3b4c67ocx0":{"classId":"c_muu8lrrukarl","created":1791299830405,"effect":"+1 Armor per 10 Shield it has (up to +3).","name":"Indomitable","need":["ward","ward","vital","vital"],"notes":"","status":"idea","updated":1791303170435},"r_mtgacb6exbpt":{"classId":"c_muu8lrrukarl","created":1791299830405,"effect":"Once per duel, when she falls below a quarter HP, unleashes a massive attack on her duel opponent: +100% damage, +50% crit chance, and the target is set Ablaze. Heals a quarter of her HP whenever she wins a duel.","name":"Desperate Strike","need":["ember","ember","edge","edge","edge"],"notes":"","status":"idea","updated":1791303170435},"r_lk0vwlo8zw3e":{"classId":"c_muuccpsasvwl","created":1791299830405,"effect":"When an ally's Shield breaks, they heal 5.","name":"Snow Wall","need":["frost","vital","vital"],"notes":"","status":"idea","updated":1791303170435},"r_wxqyeuf6p3v8":{"classId":"c_muuccpsasvwl","created":1791299830405,"effect":"When her own Shield breaks, the attacker gains 20 Chill.","name":"Frozen Bastion","need":["frost","frost","frost","edge","edge"],"notes":"","status":"idea","updated":1791303170435},"r_9wndyf3sy6wg":{"classId":"c_muuccpsasvwl","created":1791299830405,"effect":"Allies with Shield are immune to Chill and Burn. Her attacks deal bonus damage equal to the Chill on the target.","name":"Ice Queen","need":["ember","ember","frost","frost","ward","ward"],"notes":"","status":"idea","updated":1791303170435},"r_85hou7jrdxnp":{"classId":"c_muuccpsasvwl","created":1791299830405,"effect":"Every 4 seconds, gives the most injured ally 1 Shield per 5 Chill across all enemies.","name":"Winter's Grace","need":["ward","ward","vital","vital"],"notes":"","status":"idea","updated":1791303170435},"r_s8l6md3d3cuw":{"classId":"c_muu8fq9g7iy1","created":1791299830405,"effect":"Heals 1 whenever a Burning enemy hits it, 2 if it is Ablaze.","name":"Magma Skin","need":["ember","vital","vital"],"notes":"","status":"idea","updated":1791303170435},"r_v6f3h77pqmkn":{"classId":"c_muu8fq9g7iy1","created":1791299830405,"effect":"When its Shield breaks, every enemy gains 3 Burn.","name":"Cooling Crust","need":["ember","ember","swift","swift"],"notes":"","status":"idea","updated":1791303170435},"r_y1giit4ej1s6":{"classId":"c_muu8fq9g7iy1","created":1791299830405,"effect":"While it has 10 or more Shield, it is immune to Chill and Poison.","name":"Obsidian","need":["ember","frost","ward","ward"],"notes":"","status":"idea","updated":1791299830405},"r_i1bv3t942ap6":{"classId":"c_muu8fq9g7iy1","created":1791299830405,"effect":"Enemies in the front row take 1 damage per second per Burning enemy, 2 per Ablaze enemy.","name":"The Floor Is Lava","need":["ember","ember","ember","ward","ward"],"notes":"","status":"idea","updated":1791303170435},"r_ht8j9lzc4teo":{"classId":"c_muu9o6j6xwfi","created":1791299830405,"effect":"Takes 20% less damage from enemies carrying all three statuses, 40% less from Ruined enemies.","name":"Rune of Binding","need":["venom","frost","ward","ward"],"notes":"","status":"idea","updated":1791303170435},"r_s1p84rol8qzu":{"classId":"c_muu9o6j6xwfi","created":1791299830405,"effect":"Gains 1 Shield whenever an enemy's status ticks (up to 5 a second).","name":"Runic Shell","need":["ward","ward","swift","swift"],"notes":"","status":"idea","updated":1791303170435},"r_4hf5fs43tac7":{"classId":"c_muu9o6j6xwfi","created":1791299830405,"effect":"When its Shield breaks, it regains 1 Shield per status stack on the attacker (up to 10).","name":"Rune of Return","need":["ember","frost","ward","vital"],"notes":"","status":"idea","updated":1791303170435},"r_3kl23e6s9wd1":{"classId":"c_muu9o6j6xwfi","created":1791299830405,"effect":"When its Shield breaks, every enemy gains 3 Poison, 3 Burn and 3 Chill.","name":"Glyph Wall","need":["venom","ember","frost","ward","ward","ward"],"notes":"","status":"idea","updated":1791303170435},"r_mz8rx8663iwt":{"classId":"c_muu9qxrkyxif","created":1791303676191,"effect":"Her healing beyond full HP becomes Shield on her.","name":"Blood Shield","need":["ward","ward","vital"],"notes":"","status":"idea","updated":1791305300088},"r_c2v2l6evx96f":{"classId":"c_muu9qxrkyxif","created":1791303676191,"effect":"Her crits heal her for the full damage dealt.","name":"Exsanguinate","need":["vital","vital","edge","edge"],"notes":"","status":"idea","updated":1791303676191},"r_y6weqscm6e0a":{"classId":"c_muu9qxrkyxif","created":1791303676191,"effect":"+X% attack speed, where X is half her current HP.","name":"Bat Swarm","need":["vital","vital","swift","swift"],"notes":"","status":"idea","updated":1791305300088},"r_5ngnsdr7fbep":{"classId":"c_muu9qxrkyxif","created":1791303676191,"effect":"Heals the full damage she deals. Healing beyond full HP raises her max HP for the fight.","name":"Blood Moon","need":["vital","vital","vital","vital","vital"],"notes":"","status":"idea","updated":1791303676191},"r_vg1uhri3tcvv":{"classId":"c_muu9rlact8dy","created":1791303676191,"effect":"Her crits heal the most injured ally for the damage dealt.","name":"Smite","need":["vital","vital","edge"],"notes":"","status":"idea","updated":1791303676191},"r_wg5ac19rs10z":{"classId":"c_muu9rlact8dy","created":1791303676191,"effect":"Allies without Shield take 20% less damage.","name":"Aegis","need":["ward","ward","ward","vital"],"notes":"","status":"idea","updated":1791305300088},"r_3xgsn0zhxwms":{"classId":"c_muu9rlact8dy","created":1791303676191,"effect":"When an ally falls below a quarter HP, heals them half their max HP (once per ally per fight).","name":"Lay on Hands","need":["vital","vital","vital","swift"],"notes":"","status":"idea","updated":1791303676191},"r_i6k2ah4myfvk":{"classId":"c_muu9rlact8dy","created":1791303676191,"effect":"Her heals also heal every other ally half as much.","name":"Divine Light","need":["ward","ward","vital","vital","vital"],"notes":"","status":"idea","updated":1791303676191},"r_4o7uibh6l9jq":{"classId":"c_muub3d9lyt44","created":1791303676191,"effect":"Allies in the front row gain +2 Armor.","name":"Standard Bearer","need":["ward","ward","gilt"],"notes":"","status":"idea","updated":1791303676191},"r_8lzqvm0y3je5":{"classId":"c_muub3d9lyt44","created":1791303676191,"effect":"When an enemy dies, every ally heals 5% of their max HP.","name":"Fanfare","need":["vital","vital","swift","swift"],"notes":"","status":"idea","updated":1791305300088},"r_a802ouk4r70x":{"classId":"c_muub3d9lyt44","created":1791303676191,"effect":"Allies deal +1% damage per gold held (up to +20%).","name":"War Chest","need":["edge","gilt","gilt","gilt"],"notes":"","status":"idea","updated":1791305300088},"r_4ovass8i6lp2":{"classId":"c_muub3d9lyt44","created":1791303676191,"effect":"When an ally kills an enemy, every ally gains +10% damage for the rest of the fight.","name":"Triumph","need":["vital","swift","swift","gilt","gilt"],"notes":"","status":"idea","updated":1791305300088},"r_gs7lqn6fc7s7":{"classId":"c_muubahl3ny7g","created":1791303676191,"effect":"When a hexed enemy dies, every ally gains +5% damage for the rest of the fight.","name":"Shrunken Head","need":["venom","venom","gilt"],"notes":"","status":"idea","updated":1791303676191},"r_4ddumtxand84":{"classId":"c_muubahl3ny7g","created":1791303676191,"effect":"Hexed enemies can't crit and their attacks apply no statuses.","name":"Spirit Ward","need":["ward","ward","vital","swift"],"notes":"","status":"idea","updated":1791303676191},"r_8f4lx4emc4ku":{"classId":"c_muubahl3ny7g","created":1791303676191,"effect":"Half of any damage dealt to a hexed enemy is also dealt to one other hexed enemy.","name":"Voodoo Doll","need":["venom","venom","ward","vital"],"notes":"","status":"idea","updated":1791303676191},"r_ng419mnmpvxs":{"classId":"c_muubahl3ny7g","created":1791303676191,"effect":"Her hex lasts the whole fight and applies to every enemy she has hit.","name":"Grand Hex","need":["venom","ward","vital","gilt","gilt"],"notes":"","status":"idea","updated":1791303676191},"r_c50bl5lx6vdo":{"classId":"c_muu8m2w3w2sq","created":1791303676191,"effect":"Enemies she kills leave 10 Chill on an adjacent enemy.","name":"Chill of the Grave","need":["frost","frost","vital"],"notes":"","status":"idea","updated":1791303676191},"r_n5rvmmb909q3":{"classId":"c_muu8m2w3w2sq","created":1791303676191,"effect":"+1% crit damage per soul.","name":"Soul Rend","need":["vital","edge","edge","gilt"],"notes":"","status":"idea","updated":1791303676191},"r_mnbk0lxd7p9y":{"classId":"c_muu8m2w3w2sq","created":1791303676191,"effect":"Targets enemies below her execute threshold when there are any. Enemies with less HP than 10% of their max plus her number of souls die to her hits. These count as her kills.","name":"Death's Door","need":["frost","vital","vital","edge"],"notes":"","status":"idea","updated":1791305379538},"r_i0wd38e9nrb6":{"classId":"c_muu8m2w3w2sq","created":1791303676191,"effect":"At the start of each fight, every enemy loses 1% of its max HP per 2 souls (up to 25%).","name":"Grim Harvest","need":["frost","vital","vital","edge","gilt"],"notes":"","status":"idea","updated":1791303676191},"r_9l97i7kr4w2a":{"classId":"c_muu8omul8tqu","created":1791305402387,"effect":"When she dodges, the attacker is Crippled: it gains 20 Chill and 15 Poison.","name":"Hamstring","need":["venom","frost","swift"],"notes":"","status":"idea","updated":1791315008050},"r_576urtxshwpz":{"classId":"c_muu8omul8tqu","created":1791305402387,"effect":"Her crits hit twice. The second hit deals half damage.","name":"Razor Waltz","need":["edge","edge","edge","gilt"],"notes":"","status":"idea","updated":1791315008050},"r_6lj7kel1d93w":{"classId":"c_muu8omul8tqu","created":1791305402387,"effect":"While at max dodge stacks, her next attack after a dodge gives her Shield equal to the damage dealt.","name":"Untouchable","need":["ward","ward","swift","swift"],"notes":"","status":"idea","updated":1791315008050},"r_mh6gflzqvbvi":{"classId":"c_muu8omul8tqu","created":1791305402387,"effect":"Every dodge is followed by a counterattack that always crits.","name":"Dance of Death","need":["edge","edge","edge","swift","swift","swift"],"notes":"","status":"idea","updated":1791315008050},"r_l7bfrk2i206q":{"classId":"c_muucnefb450t","created":1791305402387,"effect":"Dodging an Ablaze enemy heals her 5.","name":"Cinder Step","need":["vital","swift","gilt"],"notes":"","status":"idea","updated":1791315008050},"r_8o2l2j9wmn8q":{"classId":"c_muucnefb450t","created":1791305402387,"effect":"Her crits apply her Burn to every enemy in the target's row.","name":"Fire Whirl","need":["ember","ember","edge","edge"],"notes":"","status":"idea","updated":1791305402387},"r_sniwo8d03cxy":{"classId":"c_muucnefb450t","created":1791305402387,"effect":"Burning enemies have 15% less chance to hit her, Ablaze enemies 30% less.","name":"Heat Haze","need":["ember","ember","ward","ward"],"notes":"","status":"idea","updated":1791305402387},"r_rava4mg8lmu9":{"classId":"c_muucnefb450t","created":1791305402387,"effect":"Each dodge applies 3 Burn to every enemy, not just the attacker.","name":"Inferno Dance","need":["ember","ember","ember","swift","swift"],"notes":"","status":"idea","updated":1791305402387},"r_reqsbutbsmk4":{"classId":"c_muucd48tezf2","created":1791305402387,"effect":"Gains 1 Shield per enemy hit by her storm attack: 2 for an Ablaze or Frozen enemy, 4 for a Brittle one.","name":"Eye of the Storm","need":["ward","swift","gilt"],"notes":"","status":"idea","updated":1791315008050},"r_8abr1lyq24ar":{"classId":"c_muucd48tezf2","created":1791305402387,"effect":"Her storm attack comes every 3rd attack instead of every 4th, and after it she leaps to the other row.","name":"Lightning Step","need":["ember","frost","swift","swift"],"notes":"","status":"idea","updated":1791315008050},"r_t56z496sb15t":{"classId":"c_muucd48tezf2","created":1791305402387,"effect":"Her storm attack applies 4 Burn and 4 Chill instead of 2.","name":"Thunderhead","need":["ember","ember","frost","frost"],"notes":"","status":"idea","updated":1791305402387},"r_kubu4r2qw9ql":{"classId":"c_muucd48tezf2","created":1791305402387,"effect":"Enemies hit by her storm attack that are Burning and Chilled are Brittle at once.","name":"Maelstrom","need":["ember","ember","frost","frost","ward","swift"],"notes":"","status":"idea","updated":1791305402387},"r_zz9cvk0u3dm9":{"classId":"c_muu8v6mqq9lr","created":1791305402387,"effect":"Blinded enemies gain 10 Chill.","name":"Pinning Shot","need":["frost","frost","swift"],"notes":"","status":"idea","updated":1791315008050},"r_gy8nrca9tox8":{"classId":"c_muu8v6mqq9lr","created":1791305402387,"effect":"Attacks against blinded enemies always crit.","name":"Headshot","need":["edge","edge","swift","swift"],"notes":"","status":"idea","updated":1791305402387},"r_nrsgnkdfeq8l":{"classId":"c_muu8v6mqq9lr","created":1791305402387,"effect":"Her 4th attack also hits every other enemy in the target's row for half damage and applies 2 Burn to each enemy hit.","name":"Volley","need":["ember","ember","swift","swift"],"notes":"","status":"idea","updated":1791315008050},"r_x7d0id9ctg6z":{"classId":"c_muu8v6mqq9lr","created":1791305402387,"effect":"Every 3rd attack blinds instead of every 4th. Blinded enemies take 50% more damage from her.","name":"Eclipse","need":["swift","swift","swift","swift","swift"],"notes":"","status":"idea","updated":1791315008050},"r_cnoqie8cyi1t":{"classId":"c_muuck8ca1kex","created":1791305402387,"effect":"Every 3 seconds, gains 1 Shield per Chilled enemy.","name":"Cold Hide","need":["frost","ward","ward"],"notes":"","status":"idea","updated":1791305402387},"r_y65fmrvkfa9r":{"classId":"c_muuck8ca1kex","created":1791305402387,"effect":"Poison on Chilled enemies deals 50% more damage.","name":"Frostbite Venom","need":["venom","venom","frost","frost"],"notes":"","status":"idea","updated":1791305402387},"r_z3otwsu3v6zu":{"classId":"c_muuck8ca1kex","created":1791305402387,"effect":"Back-row enemies take 20% more damage from all heroes.","name":"Hunter's Mark","need":["venom","frost","swift","swift"],"notes":"","status":"idea","updated":1791305402387},"r_2700idg0u0mr":{"classId":"c_muuck8ca1kex","created":1791305402387,"effect":"Locks on to one enemy until it dies. Each attack on it applies 1 more status than the last, alternating Chill and Poison: +1/+0, +1/+1, +2/+1, +2/+2 and so on.","name":"Stalk","need":["venom","frost","ward","swift","swift"],"notes":"","status":"idea","updated":1791315008050},"r_n02o8t2bd7fd":{"classId":"c_muu8cz7uo8uh","created":1791315405239,"effect":"Allies gain +5% attack speed for every other living hero.","name":"Many Hands","need":["vital","gilt","gilt"],"notes":"","status":"idea","updated":1791334901253},"r_vjg1kbrt7esv":{"classId":"c_muu8cz7uo8uh","created":1791315405239,"effect":"Basic gems' weapon and armour effects are doubled on allies.","name":"Master Jeweller","need":["swift","swift","gilt","gilt"],"notes":"","status":"idea","updated":1791334901253},"r_j0h3e206u99f":{"classId":"c_muu8cz7uo8uh","created":1791315405239,"effect":"Allies deal +1% damage per 10 gold spent this run (up to +50%).","name":"War Bonds","need":["edge","gilt","gilt","gilt"],"notes":"","status":"idea","updated":1791315405239},"r_mdz9drtsg3fx":{"classId":"c_muu8cz7uo8uh","created":1791315405239,"effect":"Your gold counts double for every effect that reads it.","name":"Golden Age","need":["gilt","gilt","gilt","gilt","gilt"],"notes":"","status":"idea","updated":1791315405239},"r_jjmygg5tejcf":{"classId":"c_muub6hrov7i3","created":1791315405239,"effect":"Charmed enemies take 25% more damage.","name":"Smooth Talk","need":["ward","swift","gilt"],"notes":"","status":"idea","updated":1791334901253},"r_marhynzqfmeu":{"classId":"c_muub6hrov7i3","created":1791315405239,"effect":"Her Charm lasts 10 seconds.","name":"Silver Words","need":["swift","swift","swift","gilt"],"notes":"","status":"idea","updated":1791315405239},"r_fo9dx5at8kzd":{"classId":"c_muub6hrov7i3","created":1791315405239,"effect":"When her Charm ends, every ally gains +15% attack speed and +15% crit chance for the rest of the fight.","name":"Standing Ovation","need":["vital","swift","swift","gilt"],"notes":"","status":"idea","updated":1791334901253},"r_3k9zd0xmbhnu":{"classId":"c_muub6hrov7i3","created":1791315405239,"effect":"The Charmed enemy fights for you while Charmed. Stalwart enemies can't be turned.","name":"Turncoat","need":["swift","swift","swift","gilt","gilt","gilt"],"notes":"","status":"idea","updated":1791334901253},"r_mybckxtuj36z":{"classId":"c_muu9hfleces9","created":1791315405239,"effect":"Her vial also applies 5 Burn.","name":"Volatile Brew","need":["ember","ember","gilt"],"notes":"","status":"idea","updated":1791334901253},"r_yc7a6wskrnqg":{"classId":"c_muu9hfleces9","created":1791315405239,"effect":"Her vial's Poison is doubled on Festering enemies.","name":"Concentrated","need":["venom","venom","venom","gilt"],"notes":"","status":"idea","updated":1791315405239},"r_z20zwonvr6yp":{"classId":"c_muu9hfleces9","created":1791315405239,"effect":"Poison damage can crit, using her crit chance.","name":"Caustic Crit","need":["venom","venom","edge","edge"],"notes":"","status":"idea","updated":1791334901253},"r_0g2widbihv9g":{"classId":"c_muu9hfleces9","created":1791315405239,"effect":"Her vial hits every enemy.","name":"Grand Vial","need":["venom","venom","venom","gilt","gilt","gilt"],"notes":"","status":"idea","updated":1791334901253},"r_rz4uuaukx1x3":{"classId":"c_muub9dnnh0qc","created":1791315405239,"effect":"Her crits remove 2 Shield or 1 Armor from the target for the rest of the fight.","name":"Blasphemy","need":["edge","edge","gilt"],"notes":"","status":"idea","updated":1791334901253},"r_8in2ba56rfo0":{"classId":"c_muub9dnnh0qc","created":1791315405239,"effect":"Her crit heals also heal the most injured ally the same amount.","name":"Zealot","need":["vital","vital","edge","swift"],"notes":"","status":"idea","updated":1791315405239},"r_osl1fg7xjg0f":{"classId":"c_muub9dnnh0qc","created":1791315405239,"effect":"+40% dodge and +40% crit chance against enemies carrying all three statuses.","name":"Heresy","need":["venom","ember","frost","edge","swift"],"notes":"","status":"idea","updated":1791334901253},"r_5g0d1wbkc3b9":{"classId":"c_muub9dnnh0qc","created":1791315405239,"effect":"For the first 5 seconds of every fight, her crits and dodges are guaranteed.","name":"Apostate","need":["edge","edge","swift","swift","gilt","gilt"],"notes":"","status":"idea","updated":1791339657856},"r_pei3hh2i24wz":{"classId":"c_muu9oupl17gi","created":1791315405239,"effect":"Skeletons' attacks apply 2 Chill.","name":"Grave Chill","need":["venom","frost","frost"],"notes":"","status":"idea","updated":1791334901253},"r_3b2v1zaierco":{"classId":"c_muu9oupl17gi","created":1791315405239,"effect":"Skeletons rise with +50% attack speed.","name":"Hasty Burial","need":["vital","vital","swift","swift"],"notes":"","status":"idea","updated":1791334901253},"r_qr58vj4h8jzq":{"classId":"c_muu9oupl17gi","created":1791315405239,"effect":"Whenever a Skeleton rises, gain 2 gold.","name":"Grave Robber","need":["venom","vital","gilt","gilt"],"notes":"","status":"idea","updated":1791334901253},"r_jj6384gkkzmy":{"classId":"c_muu9oupl17gi","created":1791315405239,"effect":"Everyone who dies rises as a Skeleton, heroes included, not just the first two enemies.","name":"Legion","need":["venom","venom","venom","vital","vital","vital"],"notes":"","status":"idea","updated":1791334901253},"r_n6wzo6i3l3tp":{"classId":"c_muu9phmxqag5","created":1791315405239,"effect":"Wilfred heals for half the damage the Necrodancer deals. Doesn't revive her.","name":"Soul Link","need":["vital","vital","vital"],"notes":"","status":"idea","updated":1791315405239},"r_vaniwu9g42gm":{"classId":"c_muu9phmxqag5","created":1791315405239,"effect":"When Wilfred falls to a quarter HP she moves to the back row and gains +25% attack speed for the fight. At three-quarters she moves to the front and gains +25% dodge for the fight.","name":"Quickstep","need":["venom","venom","swift","swift"],"notes":"","status":"idea","updated":1791334901253},"r_ykva5xjjld89":{"classId":"c_muu9phmxqag5","created":1791315405239,"effect":"Wilfred gets +1 ATK and +1 HP per 2 gold held, at the start of each fight.","name":"Fat Wallet","need":["vital","vital","gilt","gilt"],"notes":"","status":"idea","updated":1791315405239},"r_kmitmg7rq9qz":{"classId":"c_muu9phmxqag5","created":1791315405239,"effect":"Wilfred gains the Necrodancer's essence passives.","name":"Perfect Partners","need":["venom","vital","swift","gilt","gilt"],"notes":"","status":"idea","updated":1791315405239},"r_08qf7jl5mg52":{"classId":"c_muu8emlv6f5o","created":1791315405239,"effect":"Each second, heals 1 per Burning enemy, 2 per Ablaze enemy.","name":"Cinder Wings","need":["ember","ember","vital","swift"],"notes":"","status":"idea","updated":1791315417459},"r_mjyw4qqicer3":{"classId":"c_muu8emlv6f5o","created":1791315405239,"effect":"Revives at full HP, with Shield equal to a quarter of its max HP.","name":"Rebirth","need":["ward","ward","vital","swift"],"notes":"","status":"idea","updated":1791315405239},"r_89tk685e9dsd":{"classId":"c_muu8emlv6f5o","created":1791315405239,"effect":"After reviving, +50% attack speed and its attacks apply 3 more Burn.","name":"Rising Flame","need":["ember","ember","ward","vital"],"notes":"","status":"idea","updated":1791315405239},"r_owlckbjege28":{"classId":"c_muu8emlv6f5o","created":1791315405239,"effect":"Can revive twice per fight.","name":"Eternal Flame","need":["ember","ember","ward","ward","vital","swift"],"notes":"","status":"idea","updated":1791334901253},"r_blhgcolswm9u":{"classId":"c_muucnsji9spe","created":1791315405239,"effect":"The bomb's Burn is doubled on Ablaze enemies.","name":"Napalm","need":["venom","ember","ember"],"notes":"","status":"idea","updated":1791315405239},"r_7bu53gvxc5fn":{"classId":"c_muucnsji9spe","created":1791315405239,"effect":"The bomb also deals damage: half her ATK to every enemy, and it can crit. (Without this it only applies status.)","name":"Shrapnel","need":["venom","ember","edge","edge"],"notes":"","status":"idea","updated":1791334901253},"r_148ilxwi1gdo":{"classId":"c_muucnsji9spe","created":1791315405239,"effect":"Bombs every 3rd attack instead of every 4th.","name":"Short Fuse","need":["ember","edge","swift","swift"],"notes":"","status":"idea","updated":1791315405239},"r_kjxe1lmlj5hr":{"classId":"c_muucnsji9spe","created":1791315405239,"effect":"When a Blighted enemy dies, it explodes: adjacent enemies gain 5 Poison and 5 Burn.","name":"Chain Reaction","need":["venom","venom","ember","ember","edge"],"notes":"","status":"idea","updated":1791315405239}}};
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
 Duelist:{passive:{hooks:{onStart:(u,B)=>startDuel(u,opposite(u,B),B)}}, // the mirror square, else the closest; die() fires onDuelWon when the opponent falls
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
// ---------- Classes (the hero tree) ----------
// CLASS_DATA is the gem recipe bench's snapshot (design/gem-recipe-bench/recipes.json), inlined by tools/build.js. Roots (Mage, Warrior,
// Rogue) have no essences and are never hired; starters have one essence, tier 3 two, capstones three or four. A hero is {id: its current
// class, root, path: every class it has been, lv, gems, open, row}. Training (unlockSlot) promotes it to an upgrade whose essences its
// gems meet; the old class's skills stay with it. Effects live in HOOKS, keyed by class name then skill name ('passive' for the class
// passive); a skill with no entry shows its text and does nothing yet. See docs/hero-refactor-plan.md.
const ESS_ORDER=['venom','ember','frost','ward','vital','edge','swift','gilt'];
const ESS_LETTER={venom:'V',ember:'E',frost:'F',ward:'W',vital:'H',edge:'K',swift:'S',gilt:'G'};
const needLetters=ess=>ess.slice().sort((a,b)=>ESS_ORDER.indexOf(a)-ESS_ORDER.indexOf(b)).map(e=>ESS_LETTER[e]).join('');
const ROW_MAX=4; // cells per row, both sides
// Where each class stands. Stats are a sum along the route: the root's base plus one contribution per class, by role and tier,
// so a capstone reached by two routes has different stats. 'mid' classes start in the back row and may move.
const CLASS_ROLE={
 Swordsman:'mid','Fire mage':'back','Frost mage':'back',Thief:'mid',Acrobat:'mid',Poisoner:'back',Healer:'back',Sentinel:'front',
 Duelist:'mid',Mercenary:'mid',Flamecaller:'back',Elementalist:'back',Berserker:'front',Hearthguard:'front',Frostblade:'mid',Rimecaller:'back',
 'Glacier Warden':'front',Merchant:'back',Bard:'back',Windrunner:'mid',Cutthroat:'mid',Apothecary:'back',Plaguecaller:'back','Plague doctor':'back',
 Monk:'front','Blood mage':'back',Cleric:'back',Shieldmaiden:'front',
 Blademaster:'mid',Bulwark:'front',Cryomancer:'back',Guildmaster:'back',Pyromancer:'back','Shadow Archer':'back',Vampire:'mid',Venomancer:'back',
 Alchemist:'back',Assassin:'mid','Blade dancer':'mid',Bladestorm:'mid','Bounty hunter':'mid',Champion:'front',Firebomber:'back','Flame dancer':'mid',
 'Frost Stalker':'mid',Herald:'back',Heretic:'mid',Icemaiden:'front','Lava strider':'front',Necrodancer:'back',Necromancer:'back',Nightblade:'mid',
 Paladin:'front',Phoenix:'front','Prismatic magus':'back',Reaper:'mid',Runeguard:'front','Silver tongue':'back',Spellblade:'mid','Storm dancer':'mid','Witch Doctor':'back'};
const ROOT_STATS={Mage:{hp:32,atk:5,spd:0.9,armor:0,row:'back'},Warrior:{hp:48,atk:5,spd:0.85,armor:1,row:'front'},Rogue:{hp:36,atk:6,spd:1.1,armor:0,row:'mid'}};
const ROLE_GAIN={ // [starter, tier 3, capstone]
 front:[{hp:14,atk:1,spd:0,armor:0},{hp:22,atk:2,spd:0,armor:1},{hp:30,atk:3,spd:0,armor:1}],
 mid:[{hp:8,atk:2,spd:0.05,armor:0},{hp:14,atk:3,spd:0.1,armor:0},{hp:20,atk:4,spd:0.1,armor:0}],
 back:[{hp:4,atk:3,spd:0,armor:0},{hp:8,atk:4,spd:0.05,armor:0},{hp:12,atk:5,spd:0.05,armor:0}]};
const BASE_CRIT=0.1; // every hero crits 10% of the time before gems
// Sprites: classes that match an existing sprite by name use it; the rest borrow their root's.
const SPR_FOR={Sentinel:'knight',Berserker:'berserker',Swordsman:'duelist',Duelist:'duelist',Thief:'rogue',Cutthroat:'rogue',Windrunner:'ranger','Shadow Archer':'ranger',
 Apothecary:'apothecary',Alchemist:'apothecary','Fire mage':'pyromancer',Flamecaller:'pyromancer',Pyromancer:'pyromancer',Healer:'cleric',Cleric:'cleric',Monk:'monk',
 Hearthguard:'ashwalker','Lava strider':'ashwalker','Glacier Warden':'glacier','Blood mage':'bloodmage',Vampire:'bloodmage','Plague doctor':'plaguedoctor',Plaguecaller:'plaguedoctor',
 Bard:'bard','Frost mage':'frostmage',Rimecaller:'frostmage',Cryomancer:'frostmage',Shieldmaiden:'shieldmaiden',Bulwark:'shieldmaiden',Reaper:'reaper',Assassin:'sniper'};
const ROOT_SPR={Mage:'frostmage',Warrior:'knight',Rogue:'rogue'};
// Effects live in HOOKS (engine/hooks.js, loaded before this file).
const CLASSES={};
for(const id in CLASS_DATA.classes){ const c=CLASS_DATA.classes[id]; const tier=c.ess.length>=3?3:c.ess.length; const H=HOOKS[c.name]||{};
  CLASSES[id]={id,name:c.name,ess:c.ess.slice(),from:(c.from||[]).slice(),passive:c.passive||'',notes:c.notes||'',tier,role:CLASS_ROLE[c.name]||(ROOT_STATS[c.name]||{}).row||'mid',need:needLetters(c.ess),skills:[],def:Object.assign({},H.passive||{})}; }
for(const rid in CLASS_DATA.recipes){ const r=CLASS_DATA.recipes[rid]; const c=CLASSES[r.classId]; if(!c) continue; const H=(HOOKS[c.name]||{})[r.name]||{};
  c.skills.push(Object.assign({id:rid,name:r.name,need:needLetters(r.need),desc:r.effect||'',cls:c.id,clsName:c.name},H)); }
for(const id in CLASSES) CLASSES[id].skills.sort((a,b)=>a.need.length-b.need.length||a.name.localeCompare(b.name));
const ROOTS=Object.keys(CLASSES).filter(id=>CLASSES[id].tier===0), STARTERS=Object.keys(CLASSES).filter(id=>CLASSES[id].tier===1);
const upgradesOf=id=>Object.keys(CLASSES).filter(k=>CLASSES[k].from.includes(id));
const rootOf=id=>{ let c=CLASSES[id]; while(c&&c.tier>0) c=CLASSES[c.from[0]]; return c?c.id:null; }; // a class's first root, for display before a hero exists
const routeTo=id=>{ const p=[id]; let c=CLASSES[id]; while(c&&c.tier>0){ c=CLASSES[c.from[0]]; p.unshift(c.id); } return p; };
const classStats=(rootId,path)=>{ const r=ROOT_STATS[CLASSES[rootId].name]; const s={hp:r.hp,atk:r.atk,spd:r.spd,armor:r.armor,crit:BASE_CRIT,dodge:0};
  path.forEach(id=>{ const c=CLASSES[id]; if(c.tier===0) return; const g=ROLE_GAIN[c.role][c.tier-1]; s.hp+=g.hp; s.atk+=g.atk; s.spd+=g.spd; s.armor+=g.armor; }); s.spd=Math.round(s.spd*100)/100; return s; };
// HEROES: what the UI reads per class (name, row, typical stats along the first route, ability text)
const HEROES={};
for(const id in CLASSES){ const c=CLASSES[id]; if(c.tier===0) continue; const s=classStats(rootOf(id),routeTo(id));
  HEROES[id]={name:c.name,row:c.role,tier:c.tier,tags:[GEMS[c.ess[0]].arch],hp:s.hp,atk:s.atk,spd:s.spd,armor:s.armor,crit:s.crit,ab:L=>c.passive,skills:c.skills}; }
const BASE_HEROES=STARTERS;
const defaultRow=id=>HEROES[id].row==='mid'?'back':HEROES[id].row; // 'mid' heroes start in the back and may move
const sprId=x=>{ const id=x&&x.id||x; const c=CLASSES[id]; if(!c) return id; return SPR_FOR[c.name]||ROOT_SPR[CLASSES[(x&&x.root)||rootOf(id)].name]; };
function newHero(id,row){ const c=CLASSES[id]; const root=pick(c.from.filter(f=>CLASSES[f].tier===0)); return {id,root,path:[root,id],lv:1,gems:[],open:[0,1],row:row||defaultRow(id),kills:0}; }
const heroPath=h=>h.path||routeTo(h.id);
// a hero's skills: its current class's, plus every earlier class's (inherited)
function heroSkills(x){ if(typeof x==='string') return CLASSES[x].skills.slice(); const out=[]; heroPath(x).forEach(id=>{ const c=CLASSES[id]; if(c.tier===0) return; c.skills.forEach(sk=>out.push(id===x.id?sk:Object.assign({},sk,{inherited:true}))); }); return out; }
function activeSkills(h){ return heroSkills(h).filter(sk=>skillActive(h,sk)); }
const heroPassives=h=>heroPath(h).map(id=>CLASSES[id]).map(c=>Object.assign({name:c.name,passiveOf:c.id},c.def)); // root, then each class: they stack
const meetsReq=(h,ess)=>{ const have=gemCounts(h), need={}; ess.forEach(e=>need[e]=(need[e]||0)+1); return Object.keys(need).every(e=>(have[e]||0)>=need[e]); };
const upgradeOptions=h=>upgradesOf(h.id).filter(id=>meetsReq(h,CLASSES[id].ess));
function promote(h,id){ h.path=heroPath(h).concat(id); h.id=id; return h; }
// Training: a hero can only train when its gems meet at least one upgrade. Opens slot k, raises ★ and promotes: outright when one upgrade
// fits, through choose(options) when several (or left to the caller when choose is omitted). Returns the options, or null if it can't train.
function trainHero(h,k,choose){ const opts=upgradeOptions(h); if(!opts.length) return null; h.lv++; if(k!==undefined&&!(h.open||[]).includes(k)) h.open=(h.open||[]).concat(k).sort(); if(opts.length===1) promote(h,opts[0]); else if(choose) promote(h,choose(opts)); return opts; }
// ---------- Stats ----------
// ctx: {gemMult} doubles basic gem socket effects (Master Jeweller). h.permAtk and h.souls are run-permanent gains (Bounty hunter, Reaper).
function computeStats(h,relics,ctx){
  relics=relics||[];
  const L=h.lv, m=1+0.15*(L-1), base=classStats(h.root||rootOf(h.id),heroPath(h)); // the route's stats, grown 15% per ★
  let hp=base.hp*m+(h.bonusHp||0)+(h.giftHp||0)+(h.souls||0), atk=base.atk*m+(h.giftAtk||0)+(h.permAtk||0), spd=base.spd, armor=base.armor, crit=base.crit, dodge=base.dodge;
  const apply={};
  let statusMult=1, targetLowest=false, startShield=0, regen=0;
  const flags={};
  const sc=slotCounts(h,relics.includes('prism')), gh=sc.hand, ga=sc.armor, gold={win:0,kill:0,interest:0,elite:0};
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
  return {maxHpRaw:Math.round(hpRaw),maxHp:Math.max(1,Math.round(hp)),atk:Math.round(atk),spd:Math.round(spd*100)/100,armor,crit,dodge,apply,statusMult,targetLowest,flags,startShield,regen,retaliate,spikes,lifesteal,shieldPerAttack,giltHand:gh.gilt||0,giltArmor:ga.gilt||0,skills,passives,gold,applyBonus,healBonus,gemHooks:gemDefs.map(g=>g.hooks||{})};
}

// ---------- Battle ----------
function baseUnit(def,side,row,s,B){
  return {uid:B.uid++,B,def,name:def.name,side,row,alive:true,hp:s.maxHp,maxHp:s.maxHp,maxHp0:s.maxHp,atk:s.atk,spd:s.spd,armor:s.armor,crit:s.crit||0,dodge:s.dodge||0,
    shield:0,st:{},kw:{},ablaze:false,critStreak:0,dodgeStreak:0,flags:{},tmpMult:1,timer:0.35+Math.random()*0.3,stTimer:Math.random()*0.2,secs:0,attacks:0,chain:0,L:1,apply:{},hooks:[],statusMult:1,targetLowest:false,hitAll:false,hitAllMult:1,
    stats:{dealt:0,taken:0,healed:0,kills:0}};
}
// gold: the run's bank when the fight starts; skills that read "gold in the bank" see it plus whatever the fight has paid so far (B.bounty)
// ctx: {spent} — gold spent this run (War Bonds). Master Jeweller (flag jeweller on any hero) doubles everyone's basic gem effects.
function createBattle(heroes,enc,relics,gold,ctx){
  const B={units:[],t:0,over:false,winner:null,log:[],relics,fx:()=>{},anim:()=>{},spawn:()=>{},move:()=>{},vanish:()=>{},phoenixUsed:false,uid:0,enc,flags:{},busy:{},bounty:0,gold:gold||0,spent:(ctx&&ctx.spent)||0};
  B.logf=s=>{B.log.push(`${B.t.toFixed(1)}s ${s}`); if(B.log.length>400) B.log.shift();};
  const sctx=heroes.some(h=>computeStats(h,relics).flags.jeweller)?{gemMult:2}:null;
  heroes.forEach(h=>{ const d=HEROES[h.id], s=computeStats(h,relics,sctx);
    const u=baseUnit(d,'p',h.row,s,B); u.L=h.lv; u.hero=h; u.s=s; u.apply=s.apply; u.statusMult=s.statusMult; u.targetLowest=s.targetLowest; u.hitAll=false; u.hitAllMult=1; u.flags=s.flags; u.applyBonus=s.applyBonus; u.healBonus=s.healBonus;
    const gemHooks={onStart:(u,B)=>{ if(s.startShield) addShield(u,s.startShield,B); }, onSecond:(u,B)=>{ if(s.regen&&u.secs%2===0) heal(u,s.regen,B); }, // regeneration has no source, so it never fires on-heal effects
      onAttack:(u,a,B)=>{ if(s.shieldPerAttack) addShield(u,s.shieldPerAttack,B); },
      onHit:(u,t,d,B)=>{ if(s.lifesteal&&d>0) heal(u,s.lifesteal,B,u); },
      onDamaged:(u,src,d,info,B)=>{ if(info.type!=='attack'||!src||!src.alive) return; for(const k in s.retaliate) applyStatus(u,src,k,s.retaliate[k],B); if(s.spikes) dealDamage(u,src,s.spikes,{type:'thorns',ignoreArmor:true},B); }};
    u.gemHooks=gemHooks; // Perfect Partners gives Wilfred the same socket passives
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
function moveUnit(u,row,B){ if(u.row===row||!rowRoom(B,u.side,row)) return false; u.row=row; B.move(u); fire(u,'onMove',B); return true; }
// neighbours in the same row (card order), for "adjacent" effects
// The board as the player sees it: a row's cards in order (living units, and the fallen regulars that keep a card; summons vanish).
const rowCards=(B,side,row,keep)=>B.units.filter(x=>x.side===side&&x.row===row&&(x.alive||!x.summon||x===keep));
const colOf=(u,B)=>Math.max(0,rowCards(B,u.side,u.row,u).indexOf(u));
function adjacentOf(t,B){ const row=rowCards(B,t.side,t.row,t); const i=row.indexOf(t); return [row[i-1],row[i+1]].filter(x=>x&&x.alive); } // works for a unit that just died
// Closest enemy by the board: columns apart squared, plus 1 for the enemy front row or 4 for its back row; the unit's own row doesn't count.
// Ties go to the front row, then at random. The Champion challenges this.
function closest(u,B){ const es=aliveEnemies(u,B); if(!es.length) return null; const c=colOf(u,B); let best=null, bd=Infinity;
  shuffle(es).forEach(e=>{ const d=Math.pow(colOf(e,B)-c,2)+(e.row==='front'?1:4); if(d<bd||(d===bd&&e.row==='front'&&best.row!=='front')){ best=e; bd=d; } }); return best; }
// The Duelist's opposite number: the living enemy in the mirror square (same row, same column), else the closest
function opposite(u,B){ const m=rowCards(B,u.side==='p'?'e':'p',u.row)[colOf(u,B)]; return (m&&m.alive)?m:closest(u,B); }
const wasFrozen=t=>t.alive?isFrozen(t):(t.stAtDeath&&t.stAtDeath.chill||0)>=FROZEN_AT, wasChilled=t=>(t.alive?t.st.chill:t.stAtDeath&&t.stAtDeath.chill)>0;
const bank=B=>(B.gold+B.bounty)*(B.flags.goldenage?2:1); // Golden Age: gold counts double for everything that reads it
// Timed buffs: {tag,key,n,until}. key is 'spd' (attack speed, +n as a fraction), 'dodge' or 'crit' (+n chance). A tag given again refreshes
// unless stack is set; dur Infinity lasts until dropBuff. Expired buffs are pruned when read.
function addBuff(u,tag,key,n,dur,B,stack){ u.buffs=u.buffs||[]; const until=B.t+dur; if(!stack){ const b=u.buffs.find(b=>b.tag===tag); if(b){ b.n=n; b.until=until; return; } } u.buffs.push({tag,key,n,until}); }
function buffSum(u,key){ if(!u.buffs) return 0; const t=u.B.t; let s=0; for(let i=u.buffs.length-1;i>=0;i--){ const b=u.buffs[i]; if(b.until<=t){ u.buffs.splice(i,1); continue; } if(b.key===key) s+=b.n; } return s; }
function dropBuff(u,tag){ if(u.buffs) u.buffs=u.buffs.filter(b=>b.tag!==tag); }
// a plain hit from a skill (Shatter, Shield Slam, Deflect): no crit, no on-hit status, no attack counters
const splash=(u,t,n,B)=>dealDamage(u,t,n,{type:'attack',splash:true},B);
function startDuel(u,t,B){ if(!t||!t.alive) return false; u.duel=t; t.duel=u; B.fx(u,'DUEL','buff'); B.fx(t,'DUEL','buff'); B.logf(`${u.name} challenges ${t.name} to a duel.`); fire(u,'onDuelStart',t,B); return true; }
// An ally raised mid-fight (Wilfred, Skeletons, Legion): a unit on the hero side with no hero record, so it counts as an ally, not a hero.
// stats: {maxHp,atk,spd,armor,crit,dodge}; opts: {hooks, apply, flags, eid (sprite), fx}. Goes in the row asked for, else the other, else nowhere.
function summonAlly(B,name,stats,row,opts){ opts=opts||{}; if(B.over) return null; const other=row==='front'?'back':'front'; row=rowRoom(B,'p',row)?row:rowRoom(B,'p',other)?other:null; if(!row) return null;
  const u=baseUnit({name},'p',row,stats,B); u.summon=true; u.timer=0; u.eid=opts.eid||'skeleton'; u.hooks=opts.hooks||[]; u.apply=Object.assign({},opts.apply||{}); if(opts.flags) u.flags=opts.flags;
  B.units.push(u); B.fx(u,opts.fx||'RISE','buff'); B.logf(`${name} joins your guild.`); B.move(u); fire(u,'onStart',B); return u; }
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
// a hook that must not re-enter itself (onApply from onApply); a different hook fired from inside it still runs
function fireOnce(u,name,B,...args){ if(B.busy[name]) return; B.busy[name]=1; try{ fire(u,name,...args,B); } finally{ B.busy[name]=0; } }
const alliesOf=(u,B)=>B.units.filter(x=>x.side===u.side);
const aliveEnemies=(u,B)=>B.units.filter(x=>x.side!==u.side&&x.alive);
function lowestAlly(u,B){ const a=alliesOf(u,B).filter(x=>x.alive); if(!a.length) return null; return a.reduce((m,x)=>(x.hp/x.maxHp)<(m.hp/m.maxHp)?x:m); }
function randomEnemy(u,B,not){ const f=aliveEnemies(u,B).filter(x=>x!==not); return f.length?pick(f):null; }
// hard caps so stacking buffs can never run away: attack speed at 3 attacks/s, kill-chains at one per possible kill (crit and dodge use streaks instead, see core)
const SPD_CAP=3, KILL_CHAIN_MAX=ROW_MAX*2;
const effSpd=u=>Math.min(SPD_CAP,u.spd*(1+buffSum(u,'spd'))*(1-CHILL_SLOW*Math.min(CHILL_SLOW_MAX,u.st.chill||0))*(u.kw.crippled?0.75:1));
function addShield(u,n,B,echo){ if(!u||!u.alive||n<=0) return; if(isFestering(u)){ B.fx(u,'festering','miss'); return; } if(u.flags.shieldMult2) n*=2; u.shield+=n; B.fx(u,`+${n}`,'shield'); fireOnce(u,'onShieldGain',B,n);
  // Twin Aegis: copy to another random hero (the copy never copies itself)
  if(!echo&&u.hero&&B.relics.includes('twinaegis')){ const o=B.units.filter(x=>x!==u&&x.hero&&x.alive); if(o.length) addShield(pick(o),n,B,true); } }
function heal(u,n,B,src){ if(!u||!u.alive||n<=0||u.flags.noHeal) return; if(isFestering(u)){ B.fx(u,'festering','miss'); return; } if(u.side==='e'&&u.st.poison>0&&B.flags.quarantine) n=Math.floor(n/2); const r=Math.max(0,Math.min(n,u.maxHp-u.hp)); if(r>0){ u.hp+=r; u.stats.healed+=r; B.fx(u,`+${r}`,'heal'); } if(n-r>0&&u.hero&&B.relics.includes('chalice')) addShield(u,Math.round(n-r),B); if(src&&src.alive) fireOnce(src,'onHeal',B,u,r,n-r); }
// a heal performed by a class ability: onHealing hooks scale it (Healer's bonuses), then the Mage root's +1; gem regeneration and lifesteal skip this
function abilityHeal(src,t,n,B){ if(!t||!t.alive||n<=0) return; const h={n}; fire(src,'onHealing',t,h,B); heal(t,Math.round(h.n)+(src.healBonus||0),B,src); }
// on-hit status: the attack's own applications, which get the Mage root's +1 and per-hit bonuses (u.hitBonus is set while a hit resolves)
const hitApply=(u,t,k,n,B)=>{ const m=n+(u.hitBonus||0); applyStatus(u,t,k,m,B); if(u.flags.mirror&&t.alive&&(k==='burn'||k==='chill')) applyStatus(u,t,k==='burn'?'chill':'burn',m,B); }; // mirror: the Elementalist copies the amount after the Mage's +1
const addApply=(a,k,n)=>{ a.extraApply=Object.assign({},a.extraApply); a.extraApply[k]=(a.extraApply[k]||0)+n; };
// removing status (cleanses, moves): Burn below the threshold ends Ablaze
function loseStatus(u,k,n,B){ u.st[k]=Math.max(0,(u.st[k]||0)-n); if(k==='burn'&&u.st.burn<ABLAZE_AT) u.ablaze=false; }
// guaranteed dodges: a flag for the next attack, or a timer; neither touches the dodge streak
function sureDodge(t,B){ if(t.sureDodge){ t.sureDodge=0; return true; } return t.sureDodgeUntil>B.t; }
// an ally may take a hit meant for t (Interpose): the first onIntercept hook that returns a living unit wins
function intercept(u,t,B){ for(const x of alliesOf(t,B)){ if(!x.alive||x===t) continue; for(const h of x.hooks){ if(h.onIntercept){ const r=h.onIntercept(x,t,u,B); if(r&&r.alive) return r; } } } return t; }
// Priority: the duel; a forced target (Branding Blow, heroes only); the unit's one-off next target (Frostblade); its class rule (u.targetRule,
// the last class to set one wins); then the old rules and random.
function pickTarget(u,foes,a,B){
  if(u.duel&&u.duel.alive&&foes.includes(u.duel)) return u.duel;
  if(u.side==='p'&&B.brand&&B.brand.t.alive&&B.brand.until>B.t&&foes.includes(B.brand.t)) return B.brand.t;
  if(u.lock&&u.lock.alive&&foes.includes(u.lock)) return u.lock; // Stalk: beats class rules
  if(u.nextTarget){ const t=u.nextTarget; u.nextTarget=null; if(t.alive&&foes.includes(t)) return t; }
  if(u.targetRule){ const t=u.targetRule(u,foes,B); if(t&&t.alive&&foes.includes(t)) return t; }
  if(u.side==='e'&&B&&B.relics.includes('boots')&&!u.targetLowest&&!a.targetLowest&&!a.preferBack) return pick(foes); // Skirmisher's Boots: the back row is exposed
  if(a.preferBack){ const b=foes.filter(f=>f.row==='back'); if(b.length) return pick(b); }
  if(u.targetLowest||a.targetLowest) return foes.reduce((m,x)=>x.hp<m.hp?x:m);
  const fr=foes.filter(f=>f.row==='front'); return pick(fr.length?fr:foes);
}
// u.attacks counts this attack before onAttack fires, so "every 4th attack" is nthAttack(u,4) in any hook. Extra attacks (follow-ups, counters)
// come through here too and advance the count; splash hits don't, they are plain dealDamage calls.
const nthAttack=(u,n)=>u.attacks%n===0;
// opts: {mult, followUp, counter} for extra attacks (Windrunner, Monk), which go to `forced` and skip the unit's targeting rule.
// a.hitTargetRow hits everyone in the chosen target's row; a.adjacent adds one of the target's neighbours.
function attack(u,B,forced,opts){
  if(!u.alive||B.over) return;
  opts=opts||{};
  u.attacks++; u.keepChill=null;
  const a={mult:(u.tmpMult||1)*(opts.mult||1),bonus:0,critBonus:opts.critBonus||0,extraTargets:0,forceCrit:!!u.tmpCrit||!!opts.forceCrit,followUp:!!opts.followUp,counter:!!opts.counter,rush:opts.rush||0};
  fire(u,'onAttack',a,B);
  if(u.blind){ u.blind=false; a.forceDodge=true; B.fx(u,'BLIND','miss'); } // Shadow Archer: the next attack misses
  u.lastA=a; aliveEnemies(u,B).forEach(x=>fire(x,'onEnemyAttack',u,a,B));
  const fz=Math.floor((u.st.chill||0)/FROZEN_AT); if(fz) a.mult/=Math.pow(2,fz); // Frozen: half damage per 20 Chill, consumed after the attack
  let foes=aliveEnemies(u,B).filter(f=>!(f.veilUntil>B.t)); if(isFrozen(u)) foes=foes.filter(f=>!f.flags.frostshadow); if(!foes.length&&!(forced&&forced.alive)) return;
  let targets;
  if(forced&&forced.alive) targets=[forced];
  else if(u.hitAll||a.hitAll){ targets=foes.slice(); if(u.hitAll) a.mult*=u.hitAllMult; }
  else if(a.hitRow){ targets=foes.filter(f=>f.row===a.hitRow); if(!targets.length) targets=[pickTarget(u,foes,a,B)]; }
  else { const t0=pickTarget(u,foes,a,B); targets=a.hitTargetRow?foes.filter(f=>f.row===t0.row):[t0]; for(let i=0;i<a.extraTargets;i++){ const o=foes.filter(f=>!targets.includes(f)); if(o.length) targets.push(pick(o)); } }
  if(a.adjacent){ const adj=adjacentOf(targets[0],B).filter(x=>!targets.includes(x)); if(adj.length) targets.push(pick(adj)); }
  u.lastTarget=targets[0];
  targets.forEach(t=>hit(u,t,a,B));
  // attacking sheds Chill: the Frozen amount, or half; a defender's keepChill ({by,gain}: Cold Iron, Glacier Warden) stops the halving and may add gain
  const c0=u.st.chill||0;
  if(fz){ u.st.chill-=fz*FROZEN_AT; B.units.forEach(x=>{ if(x.alive) fire(x,'onFrozenAttack',u,fz*FROZEN_AT,B); }); }
  else if(u.keepChill){ if(u.keepChill.gain>0&&u.keepChill.by.alive) applyStatus(u.keepChill.by,u,'chill',u.keepChill.gain,B); }
  else if(u.st.chill>0&&CHILL_SHED) u.st.chill=Math.floor(u.st.chill/2);
  const lost=c0-(u.st.chill||0); if(lost>0) B.units.forEach(x=>{ if(x.alive) fire(x,'onChillLost',u,lost,B); }); // any Chill shed by attacking (Leeching Poison)
  fire(u,'onAttackEnd',targets[0],B);
}
// One hit. ac is this hit's copy of the attack: mult and bonus (before the multiplier), reduce (flat, after it), critBonus (chance), critExtra
// (added to the ×2), forceCrit, applyBonus (per on-hit status), extraApply, execute. Damage is (ATK + bonus) × mult − reduce, so the Frozen halving
// lands before flat reductions.
function hit(u,t,a,B){
  if(!t.alive||!u.alive) return;
  t=intercept(u,t,B);
  const ac=Object.assign({mult:1,bonus:0},a);
  fire(t,'onIncoming',u,ac,B); // before the dodge roll: ac.dodgeBonus
  if(sureDodge(t,B)||ac.forceDodge||streakRoll(t.dodge+(ac.dodgeBonus||0)+buffSum(t,'dodge'),t,'dodgeStreak')){ B.anim(u,t,{type:'miss'}); B.fx(t,'miss','miss'); B.logf(`${t.name} dodges ${u.name}.`); fire(t,'onDodge',u,B); alliesOf(t,B).forEach(x=>{ if(x.alive) fire(x,'onAllyDodge',t,u,B); }); return; }
  fire(u,'onTarget',t,ac,B);
  fire(t,'onDefend',u,ac,B);
  for(const x of B.units){ if(!x.alive) continue; if(x.side===u.side) fire(x,'onAllyTarget',u,t,ac,B); else fire(x,'onAllyDefend',t,u,ac,B); } // side-wide auras, the attacker and defender included
  if(t.st.chill>0&&u.side==='p'){ if(B.relics.includes('glacialcore')) ac.bonus+=chill5(t); if(B.flags.wintersgrip) ac.mult*=1.15; if(isFrozen(t)&&B.flags.abszero) ac.mult*=1.5; }
  let dmg=Math.max(1,Math.max(1,u.atk+ac.bonus)*ac.mult-(ac.reduce||0)), crit=false;
  // crit: forced unless ac.noForce turns the guarantee into a 100% roll (Elemental Rush), scaled by ac.critScale; ac.noCrit (Immovable, Spirit Ward) stops it
  const forcedCrit=ac.forceCrit&&!ac.noForce, chance=(ac.forceCrit?1:u.crit+(ac.critBonus||0)+buffSum(u,'crit'))*(ac.critScale||1);
  if(!ac.noCrit&&(forcedCrit||streakRoll(chance,u,'critStreak'))){ dmg=dmg*((u.flags.crit3?3:2)+(ac.critExtra||0))+(ac.critFlat||0); crit=true; }
  u.lastCrit=crit;
  let dealt;
  u.lastExec=!!ac.execute;
  if(ac.execute) dealt=dealDamage(u,t,t.hp+t.shield,{type:'attack',ignoreArmor:true,ignoreShield:true,crit:true,exec:true},B);
  else dealt=dealDamage(u,t,dmg,{type:'attack',crit,ignoreArmor:!!u.flags.pierce,ignoreShield:!!u.flags.ghost},B);
  u.lastDealt=dealt;
  if(ac.divert&&ac.divert.t.alive&&dealt>0) dealDamage(ac.divert.src,ac.divert.t,Math.round(dealt*ac.divert.frac),{type:'attack',ignoreArmor:true},B); // Holy Shield: part of the blow lands on the cursed enemy
  u.inHit=true; u.hitBonus=(u.applyBonus||0)+(ac.applyBonus||0);
  if(!ac.noApply){ for(const k in u.apply){ if(u.apply[k]>0&&t.alive) hitApply(u,t,k,u.apply[k],B); }
    if(ac.extraApply&&t.alive) for(const k in ac.extraApply) hitApply(u,t,k,ac.extraApply[k],B); }
  if(crit&&t.alive) fireOnce(u,'onCrit',B,t);
  if(crit) alliesOf(u,B).forEach(x=>{ if(x.alive) fire(x,'onAllyCrit',u,t,B); });
  if(crit&&t.alive){ if(u.flags.critPoison) hitApply(u,t,'poison',2,B); if(u.flags.critPoison3) hitApply(u,t,'poison',3,B); if(u.flags.critChill) hitApply(u,t,'chill',2,B); if(u.flags.critBurn) hitApply(u,t,'burn',3,B); }
  if(crit&&u.side==='p'&&B.relics.includes('luckycoin')) heal(u,3,B);
  if(u.side==='p'&&B.flags.sanguine&&dealt>0) heal(u,Math.ceil(dealt*0.2),B);
  fire(u,'onHit',t,dealt,B);
  u.inHit=false; u.hitBonus=0;
  alliesOf(t,B).forEach(x=>{ if(x.alive) fire(x,'onAllyHit',t,B); });
}
function applyStatus(src,t,k,n,B){
  if((t.flags.stone&&(k==='poison'||k==='burn'))||(t.flags.fireproof&&k==='burn')||(t.flags.boneproof&&k==='poison')
    ||(t.flags.obsidian&&t.shield>=10&&(k==='chill'||k==='poison'))||(t.side==='p'&&t.shield>0&&B.flags.icequeen&&(k==='chill'||k==='burn'))){ B.fx(t,'immune','miss'); return; } // Obsidian, Ice Queen
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
  const was=t.st[k]||0; t.st[k]=was+n; let kind=null;
  if(k==='burn'&&!t.ablaze&&t.st.burn>=ABLAZE_AT){ t.ablaze=true; kind='ablaze'; B.fx(t,'ABLAZE','burn'); B.logf(`${t.name} is ablaze.`); }
  if(k==='chill'&&was<FROZEN_AT&&t.st.chill>=FROZEN_AT){ kind='frozen'; B.fx(t,'FROZEN','buff'); B.logf(`${t.name} is frozen.`); }
  if(k==='poison'&&was<FESTER_AT&&t.st.poison>=FESTER_AT){ kind='festering'; B.fx(t,'FESTERING','poison'); B.logf(`${t.name} is festering.`); }
  checkMarks(t,B);
  if(kind) B.units.forEach(x=>{ if(x.alive) fire(x,'onAffliction',t,kind,B); }); // everyone hears it; hooks check the side
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
  if(info.type==='attack'&&src&&t.duel&&t.duel.alive&&src!==t.duel) amount*=0.5; // a duellist takes half from anyone but the opponent
  if(info.type==='burn'&&src&&src.flags.ashen&&t.shield>0) amount*=2; // Ashen Guard: Burn doubles against Shield
  let dmg=Math.max(0,Math.round(amount));
  if(!info.ignoreArmor&&dmg>0&&!isFestering(t)) dmg=Math.max(1,dmg-t.armor); // Festering: Armor counts as 0
  if((!info.ignoreShield||t.flags.shieldAll)&&t.shield>0&&dmg>0){ const ab=Math.min(t.shield,dmg); t.shield-=ab; dmg-=ab; if(ab){ B.fx(t,`-${ab}`,'shield'); if(info.type==='attack'&&src&&src.alive){ fire(t,'onShieldAbsorb',src,ab,B); if(t.side==='p'&&B.relics.includes('mirrorward')) dealDamage(t,src,ab,{type:'thorns',ignoreArmor:true},B); }
    if(info.type==='burn'&&src&&src.alive&&src.flags.ashen) addShield(src,ab,B);
    if(t.shield<=0) alliesOf(t,B).forEach(x=>{ if(x.alive) fire(x,'onAllyShieldBreak',t,src,B); }); } }
  t.hp-=dmg; t.stats.taken+=dmg; if(src) src.stats.dealt+=dmg;
  if((dmg>0||!info.ignoreShield)&&!info.silent) B.fx(t,info.exec?'EXECUTE':String(dmg),info.crit?'crit':info.type);
  if(info.type==='attack') B.logf(`${src?src.name:'?'} hits ${t.name} for ${dmg}${info.crit?' (crit)':''}.`);
  if(dmg>0&&src) fire(t,'onDamaged',src,dmg,info,B);
  if(dmg>0){ alliesOf(t,B).forEach(x=>{ if(x!==t&&x.alive) fire(x,'onAllyDamaged',t,src,dmg,info,B); }); aliveEnemies(t,B).forEach(x=>fire(x,'onFoeDamaged',t,src,dmg,info,B)); }
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
  t.alive=false; t.hp=0; t.shield=0; t.st_poisonAtDeath=t.st.poison||0; t.stAtDeath=Object.assign({},t.st); t.ablazeAtDeath=t.ablaze; t.st={}; t.ablaze=false; // stAtDeath: what it died carrying, for on-death readers
  fire(t,'onDeath',B);
  if(t.alive) return;
  B.logf(`${t.name} falls.`);
  if(t.duel&&t.duel.alive&&t.duel.duel===t){ const w=t.duel; w.duel=null; B.logf(`${w.name} wins the duel.`); fire(w,'onDuelWon',t,B); } // the duel ends; the survivor may challenge again
  if(t.summon) B.vanish(t); // summons leave no card behind
  if(killer&&killer.alive){ killer.stats.kills++; fire(killer,'onKill',t,B); alliesOf(killer,B).forEach(x=>{ if(x!==killer&&x.alive) fire(x,'onAllyKill',killer,t,B); }); }
  alliesOf(t,B).forEach(x=>{ if(x.alive) fire(x,'onAllyDeath',t,B); });
  aliveEnemies(t,B).forEach(x=>fire(x,'onFoeDeath',t,B));
  if(t.side==='e'&&killer&&killer.side==='p'&&B.relics.includes('grimoire')) raiseSkeleton(B);
  if(t.side==='p'&&t.row==='front'&&B.relics.includes('marching')){ const c=B.units.filter(x=>x.side==='p'&&x.alive&&x.row==='back'&&!x.summon); if(c.length){ const n=c.reduce((m,x)=>x.hp>m.hp?x:m); if(moveUnit(n,'front',B)){ n.retreated=false; n.resting=false; addShield(n,n.maxHp,B); B.fx(n,'STEP UP','buff'); B.logf(`${n.name} steps up to hold the line.`); } } }
  if(t.side==='p') checkVanguard(B);
}
// one Poison tick: its stacks as damage, then one stack lost. Callable by skills that make Poison tick early (Venom Strike).
function tickPoison(u,B){
  const st=u.st; if(!(st.poison>0)||!u.alive) return;
  const src=u.poisonSrc; let fm=(src&&src.flags.flask&&st.burn>0)?1.5:1, crit=false;
  if(u.side==='e'&&st.chill>0&&B.flags.frostbitevenom) fm*=1.5; // Frost Stalker
  if(src&&src.flags.caustic&&streakRoll(src.crit,src,'critStreak')){ fm*=2; crit=true; } // Alchemist: her Poison can crit
  const d=dealDamage(src,u,st.poison*fm,{type:'poison',ignoreArmor:true,ignoreShield:true,crit},B);
  if(!(u.side==='e'&&B.flags.nodecay&&isFestering(u))) st.poison-=1; // Venomancer: Festering enemies' Poison holds
  if(d>0&&src){ B.units.forEach(x=>{ if(x.side===src.side&&x.alive) fire(x,'onPoisonDamage',u,d,B); }); }
}
function tickStatus(u,B){
  const st=u.st;
  tickPoison(u,B);
  if(!u.alive) return;
  if(st.burn>0){ const src=u.burnSrc; let m=(src&&src.side==='p'&&B.relics.includes('kindling'))?2:1; if(src&&src.flags.flask&&st.poison>0) m*=1.5; if(src&&src.side==='p'&&st.chill>0&&B.relics.includes('steam')) m*=2;
    const d=dealDamage(src,u,st.burn*BURN_DMG*m,{type:'burn',ignoreArmor:true},B);
    if(u.noBurnDecay) u.noBurnDecay=false; else st.burn=(src&&src.flags.slowBurn)?st.burn-1:Math.floor(st.burn/2); // Kiln skips one decay
    if(u.ablaze) st.burn=Math.max(u.side==='e'&&B.flags.firestorm?20:ABLAZE_AT,st.burn); // Ablaze holds the floor (20 under Firestorm)
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
if(typeof module!=='undefined') module.exports={closest,opposite,colOf,adjacentOf,CLASSES,STARTERS,ROOTS,newHero,trainHero,upgradeOptions,upgradesOf,promote,heroSkills,heroPath,HOOKS,rollActBoss,bossPool,bossNorm,BOSSES,enemyMult,gemLeaves,defineMergedGem,restoreMergedGems,genChoices,curAct,slotKind,HAND_SLOTS,HEROES,defaultRow,ROW_MAX,ENCOUNTERS,GEMS,BASIC_GEMS,RARE_GEMS,SLOTS,RELICS,ENEMIES,ARCH_LABEL,heroSkills,activeSkills,skillActive,needCounts,gemCounts,genEncounter,computeStats,createBattle,stepBattle,runToEnd,actOf,kindOf,FLOORS};
