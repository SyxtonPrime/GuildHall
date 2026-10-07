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


