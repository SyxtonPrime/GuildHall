const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:844}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+__dirname+'/../game/guildhall.html'); await p.waitForTimeout(400);
 await p.click('button[data-a="new"]'); await p.waitForTimeout(150);
 let ps=await p.$$('button[data-pick]'); await ps[0].click(); await p.waitForTimeout(80); ps=await p.$$('button[data-pick]:not([disabled])'); await ps[0].click(); await p.waitForTimeout(200);
 const fight=(floor,win)=>p.evaluate(([floor,win])=>{ run.floor=floor; run.enc=genEncounter(floor,run.depth); battle=createBattle(run.heroes,run.enc,run.relics); battle.units.forEach(u=>{ if(u.side===(win?'e':'p')){ u.alive=false; u.hp=0; } }); battle.over=true; battle.winner=win?'p':'e'; endBattle(); return JSON.stringify(depthStats(run.depth))+' cleared='+run.cleared; },[floor,win]);
 console.log('win 12:',await fight(12,true));
 console.log('endless 14 loss:',await fight(14,false));
 await p.evaluate(()=>{ delete $('#modal').dataset.lock; $('#sheet').onclick=null; closeModal(); newRun(0); run.startPick=false; addHero("knight"); closeModal(); });
 console.log('new run, loss on 5:',await fight(5,false));
 console.log('errors:',errs); await b.close();
})();
