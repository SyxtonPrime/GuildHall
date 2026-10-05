const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:844}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+__dirname+'/../game/guildhall.html'); await p.waitForTimeout(400);
 await p.click('button[data-a="new"]'); await p.waitForTimeout(150);
 let ps=await p.$$('button[data-pick]'); await ps[0].click(); await p.waitForTimeout(80); ps=await p.$$('button[data-pick]:not([disabled])'); await ps[0].click(); await p.waitForTimeout(200);
 await p.evaluate(()=>{ run.relics=Object.keys(RELICS); run.floor=16; run.endless=true; run.cleared=true; run.enc=genEncounter(16,0); run.enc.kind='boss';
   battle=createBattle(run.heroes,run.enc,run.relics); battle.units.forEach(u=>{ if(u.side==='e'){u.alive=false;u.hp=0;} }); battle.over=true; battle.winner='p'; endBattle(); });
 await p.waitForTimeout(200); await p.click('#sheet button[data-next]'); await p.waitForTimeout(200);
 await p.click('#sheet button[data-fp-ok]'); await p.waitForTimeout(200);
 console.log('now on floor',await p.evaluate(()=>run.floor),'camp visible',await p.evaluate(()=>!$('#s-camp').hidden),'modal hidden',await p.evaluate(()=>$('#modal').hidden),'errors',errs);
 await b.close();
})();
