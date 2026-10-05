const E=require('../game/engine.js');
function mk(gems){ return {id:'rogue',lv:3,gems,open:[0,1,2,3],row:'front'}; }
// Death Blossom: KKKK; force 100% crit via stats
const h=mk(['edge','edge','edge','edge']);
const s=E.computeStats(h,[]); console.log('rogue crit',s.crit.toFixed(2),'skills',s.skills.map(x=>x.name||x.ref).join(', '));
const enc=E.genEncounter(10,0); enc.list=[{id:'ogre',row:'front'},{id:'ogre',row:'front'},{id:'ogre',row:'front'}];
const B=E.createBattle([h],enc,[]);
const rogue=B.units.find(u=>u.hero); rogue.crit=1; rogue.dodge=1; // never dies
B.units.filter(u=>u.side==='e').forEach(u=>{u.hp=u.maxHp=100000;u.atk=1;});
// count attacks per natural attack: attacks counter after each tick
let last=0, per=[];
for(let i=0;i<400&&!B.over;i++){ E.stepBattle(B,0.05); if(rogue.attacks!==last){ per.push(rogue.attacks-last); last=rogue.attacks; } }
console.log('attacks per natural attack (100% crit, Death Blossom):',[...new Set(per)]);
// kill chain: weak enemies
const enc2=E.genEncounter(1,0); enc2.list=Array(6).fill({id:'kobold',row:'front'});
const B2=E.createBattle([mk([null,null,null,null])],enc2,[]);
const r2=B2.units.find(u=>u.hero); r2.atk=1000; r2.dodge=1;
last=0; per=[]; for(let i=0;i<400&&!B2.over;i++){ E.stepBattle(B2,0.05); if(r2.attacks!==last){ per.push(r2.attacks-last); last=r2.attacks; } }
console.log('kill chain attacks per natural attack vs 6 kobolds:',per,'winner',B2.winner,'t',B2.t.toFixed(2));
// dodge cap
const monk={id:'monk',lv:3,gems:['swift','swift','swift','swift'],open:[0,1,2,3],row:'front'};
console.log('monk dodge w/ 4 swift + cloak + boots:',E.computeStats(monk,['cloak','boots']).dodge);
