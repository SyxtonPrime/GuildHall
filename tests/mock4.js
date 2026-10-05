const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:844}});
 await p.goto('file://'+__dirname+'/../game/guildhall.html'); await p.waitForTimeout(400);
 await p.click('button[data-a="new"]'); await p.waitForTimeout(150);
 let ps=await p.$$('button[data-pick]'); await ps[0].click(); await p.waitForTimeout(80); ps=await p.$$('button[data-pick]:not([disabled])'); await ps[0].click(); await p.waitForTimeout(200);
 await p.evaluate(()=>{ run.floor=9; run.partyMax=6; run.heroes=[{id:'shieldmaiden',lv:3,row:'front',gems:['ward','ward','venom'],bonusHp:0},{id:'berserker',lv:2,row:'front',gems:['ember'],bonusHp:0},{id:'plaguedoctor',lv:1,row:'front',gems:['venom'],bonusHp:0},{id:'monk',lv:2,row:'front',gems:['swift','swift'],bonusHp:0},{id:'cleric',lv:2,row:'back',gems:['vital'],bonusHp:0},{id:'frostmage',lv:1,row:'back',gems:['frost'],bonusHp:0}]; run.enc=genEncounter(9,0); startBattle();
   speed=2; });
 await p.waitForTimeout(2500); await p.screenshot({path:'mock4.png'});
 // camp view with 4 columns
 await p.evaluate(()=>{ if(loop){clearInterval(loop);loop=null;} battle=null; renderCamp();  });
 await p.waitForTimeout(200); await p.screenshot({path:'mock4camp.png'});
 await b.close();
})();
