const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:844}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+__dirname+'/../game/guildhall.html'); await p.waitForTimeout(400);
 await p.click('button[data-a="new"]'); await p.waitForTimeout(150);
 let ps=await p.$$('button[data-pick]'); await ps[0].click(); await p.waitForTimeout(80); ps=await p.$$('button[data-pick]:not([disabled])'); await ps[0].click(); await p.waitForTimeout(200);
 await p.evaluate(()=>{ run.floor=6; run.relics=['grimoire']; run.heroes=[{id:'knight',lv:2,row:'front',gems:['ward'],bonusHp:0},{id:'berserker',lv:2,row:'front',gems:['ember'],bonusHp:0},{id:'cleric',lv:2,row:'back',gems:['vital'],bonusHp:0},{id:'ranger',lv:2,row:'back',gems:['swift'],bonusHp:0}];
   run.enc=genEncounter(6,0); run.enc.list=[{id:'necromancer',row:'back'},{id:'slime',row:'front'},{id:'slime',row:'front'},{id:'skeleton',row:'front'}]; startBattle(); speed=3; });
 let maxE=0,maxP=0,deadSummonCards=0,shot=0;
 for(let i=0;i<400;i++){ await p.waitForTimeout(60);
   const st=await p.evaluate(()=>{ const rows=s=>[...document.querySelectorAll(s+' .grid4')].map(g=>g.children.length);
     const ds=battle.units.filter(u=>u.summon&&!u.alive&&document.getElementById('u'+u.uid)&&!document.getElementById('u'+u.uid).classList.contains('vanishing')).length;
     return {e:rows('#eside'),p:rows('#pside'),ds,over:battle.over,sp:battle.units.filter(u=>u.summon).length}; });
   maxE=Math.max(maxE,...st.e,0); maxP=Math.max(maxP,...st.p,0); deadSummonCards=Math.max(deadSummonCards,st.ds);
   if(!shot&&st.sp>=4){ await p.screenshot({path:'van.png'}); shot=1; }
   if(st.over) break; }
 const log=await p.evaluate(()=>battle.log.filter(s=>/joins|Risen/.test(s)).length);
 console.log('max cards/row enemy',maxE,'hero',maxP,'| dead summon cards lingering (not fading):',deadSummonCards,'| summon spawns logged',log,'| errors',errs);
 await b.close();
})();
