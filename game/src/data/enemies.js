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
 goblinking:{name:'Goblin King',row:'front',hp:140,atk:10,spd:0.9,boss:true,ab:'Every 3s, all enemies gain +15% speed.',
  hooks:{onSecond:(u,B)=>{ if(u.secs%3===0) alliesOf(u,B).forEach(x=>{x.spd*=1.15;}); }}},
 lich:{name:'Lich',row:'back',hp:140,atk:10,spd:0.8,boss:true,apply:{poison:2},ab:'Attacks apply 2 Poison and heal the Lich for damage dealt.',
  hooks:{onHit:(u,t,dmg,B)=>heal(u,dmg,B)}},
 rifttitan:{name:'Stone Titan',row:'front',hp:210,atk:9,spd:0.6,armor:2,boss:true,ab:'+2 ATK every 3s. Every 5th attack hits everyone.',
  hooks:{onSecond:(u)=>{ if(u.secs%3===0) u.atk+=2; }, onAttack:(u,a)=>{ if(nthAttack(u,5)) a.hitAll=true; }}},
 bonedragon:{name:'Bone Dragon',row:'front',hp:160,atk:8,spd:0.7,armor:1,boss:true,ab:'Every 5th attack breathes on everyone. Heals 20 whenever another enemy dies. Takes half damage from Poison.',flags:{poisonResist:1},
  hooks:{onAttack:(u,a)=>{ if(nthAttack(u,5)) a.hitAll=true; }, onAllyDeath:(u,d,B)=>heal(u,20,B)}},
 // --- bosses added v35 (Scout's Camp picks between an act's own bosses) ---
 ratking:{name:'Rat King',row:'front',hp:130,atk:7,spd:0.9,boss:true,ab:'Every 5s, two Rats join the fight. +1 ATK for every Rat alive.',
  hooks:{onSecond:(u,B)=>{ if(u.secs%RK_EVERY===0){ for(let k=0;k<RK_N;k++) spawnEnemy(B,'rat','front'); } }, onAttack:(u,a,B)=>{ a.bonus+=B.units.filter(x=>x.alive&&x.eid==='rat').length; }}},
 broodmother:{name:'Broodmother',row:'front',hp:155,atk:8,spd:0.8,boss:true,apply:{poison:2},ab:'Attacks apply 2 Poison. Each time she loses a quarter of her HP, a Spiderling hatches.',
  hooks:{onDamaged:(u,src,d,info,B)=>{ if(u.hp<=0) return; while((u.hatched||0)<3&&u.hp<=u.maxHp*(0.75-0.25*(u.hatched||0))){ u.hatched=(u.hatched||0)+1; B.fx(u,'HATCH','buff'); for(let k=0;k<BR_N;k++) spawnEnemy(B,'spiderling','front'); } }}},
 vampirelord:{name:'Vampire Lord',row:'front',hp:125,atk:7,spd:0.9,boss:true,ab:'Heals for half the damage he deals. At half HP he becomes a bat swarm: untargetable for 3s while three Bats join the fight.',
  hooks:{onHit:(u,t,d,B)=>{ if(d>0) heal(u,Math.ceil(d/2),B); }, onDamaged:(u,src,d,info,B)=>{ if(!u.batted&&u.hp>0&&u.hp<u.maxHp/2){ u.batted=true; u.veilUntil=B.t+3; B.fx(u,'BAT SWARM','buff'); B.logf(`${u.name} dissolves into bats.`); for(let k=0;k<3;k++) spawnEnemy(B,'bat','back'); } }}},
 banshee:{name:'Banshee',row:'back',hp:110,atk:9,spd:0.9,dodge:0.3,boss:true,ab:'30% dodge. Every 4s she wails: every hero gains 2 Chill.',
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
// Depth (ascension) adds less early and more late: 4% a level through Act 1, rising to 15% by floor 12 (and in endless), so a good guild
// of starters can still take the Act 1 boss at depth 3–5, and a built guild still meets resistance.
const depthRate=floor=>floor<=4?0.04:0.04+0.11*(Math.min(floor,FLOORS)-4)/(FLOORS-4);
const enemyMult=(floor,depth)=>{ let m=0.7; for(let f=2;f<=floor;f++) m*=floorGrowth(f); return m*(1+depthRate(floor)*depth)*(floor>=9?ACT3_BOOST:1); };
const ENEMY_HP=ENV('EHP',2.1), ENEMY_ATK=ENV('EATK',1.25);
const BOSS_HP=ENV('BOSSHP',1), BOSS_ATK=ENV('BOSSATK',1); // bosses on top of the floor multiplier (tools/boss-check.js sweeps these)

const bossPool=floor=>BOSSES[floor>FLOORS?((Math.ceil(floor/4)-1)%3)+1:actOf(floor)];
const rollActBoss=floor=>pick(bossPool(floor)); // decided when an act (or endless block) begins
// a boss brought in from another act (Scout's Camp) is rescaled to this act's own bosses' average HP and ATK
function bossNorm(floor,id){ const nat=bossPool(floor); if(nat.includes(id)) return null; const d=ENEMIES[id], av=k=>nat.reduce((a,b)=>a+ENEMIES[b][k],0)/nat.length; return {hp:av('hp')/d.hp,atk:av('atk')/d.atk}; }
// Affixes: Act 2 and 3 enemies may carry one (Act 2 15%, Act 3 30%, endless 40%, +5% a depth level). Act 2/3 elites always do; bosses never.
// mod runs on the unit when it is made; hooks join its own. Spawned enemies (Necromancer skeletons, boss adds) never roll one.
const AFFIXES={
 vampiric:{name:'Vampiric',g:'bloodmage',c:'#e05d6f',d:'Heals for half the damage it deals',hooks:{onHit:(u,t,d,B)=>{ if(d>0) heal(u,Math.ceil(d/2),B,u); }}},
 thorned:{name:'Thorned',g:'thornmail',c:'#c9a26b',d:'Attackers take a quarter of the damage they deal to it',hooks:{onDamaged:(u,src,d,info,B)=>{ if(info.type==='attack'&&src&&src.alive&&src.side!==u.side) dealDamage(u,src,Math.ceil(d/4),{type:'thorns',ignoreArmor:true},B); }}},
 warded:{name:'Warded',g:'towershield',c:'#5b8cff',d:'Starts each fight with Shield equal to a third of its max HP',hooks:{onStart:(u,B)=>addShield(u,Math.round(u.maxHp/3),B)}},
 hasty:{name:'Hasty',g:'quickboots',c:'#c47bff',d:'Attacks 30% faster',mod:u=>{ u.spd*=1.3; }},
 venomous:{name:'Venomous',g:'venomvial',c:'#9be15d',d:'Attacks apply 2 Poison',mod:u=>{ u.apply.poison=(u.apply.poison||0)+2; }},
 unerring:{name:'Unerring',g:'huntersmark',c:'#ffd166',d:"Its attacks can't be dodged and find heroes who can't be targeted",mod:u=>{ u.flags.unerring=1; }},
 hunter:{name:'Hunter',g:'sniper',c:'#ff9f43',d:'Attacks the hero with the highest ATK, wherever they stand',mod:u=>{ u.targetRule=(u,foes)=>foes.length?foes.reduce((m,x)=>x.atk>m.atk?x:m):null; }},
 enraged:{name:'Enraged',g:'berserker',c:'#ff5c3a',d:'Deals 50% more damage below half HP',hooks:{onTarget:(u,t,a)=>{ if(u.hp<u.maxHp/2) a.mult*=1.5; }}},
};
const AFFIX_ODDS={2:ENV('AFFIX2',0.15),3:ENV('AFFIX3',0.30)}, AFFIX_DEPTH=0.05;
const affixOdds=(floor,depth)=>{ const a=actOf(floor); if(a<2) return 0; return Math.min(0.8,AFFIX_ODDS[a]+(floor>FLOORS?0.1:0)+AFFIX_DEPTH*depth); };
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
  const ap=affixOdds(floor,depth); if(ap>0) out.forEach(x=>{ const d=ENEMIES[x.id]; if(!d.boss&&(d.elite||Math.random()<ap)) x.affix=pick(Object.keys(AFFIXES)); });
  const norm=kind==='boss'?bossNorm(floor,list[0]):null;
  return {floor,kind,act,mult:enemyMult(floor,depth),list:out,theme:kind==='fight'?tpl.name:null,...(norm?{norm}:{})};
}
// The prologue: the run's first fight, before floor 1. It isn't a floor and ignores depth: always floor 1 strength at depth 0.
function genPrologue(){ return Object.assign(genEncounter(1,0,'fight'),{prologue:true}); }
// What the camp offers on a floor: floor 1 and bosses are fixed; every other floor is fight vs elite.
// (Events — Forge, Enchanter, Gem Cutter, Retirement, Scout's Camp — come as a bonus after each act's 2nd fight.)
function genChoices(floor,depth,opts){
  const fixed=k=>[{kind:k,enc:genEncounter(floor,depth,k,opts&&opts.boss)}];
  if(floor===1) return fixed('fight');
  if(kindOf(floor)==='boss') return fixed('boss');
  return ['fight','elite'].map(k=>({kind:k,enc:genEncounter(floor,depth,k)}));
}

