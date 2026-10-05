const {chromium}=require('playwright');
(async()=>{ const b=await chromium.launch(); const p=await b.newPage({viewport:{width:360,height:780},deviceScaleFactor:2});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+__dirname+'/../game/guildhall.html'); await p.waitForTimeout(400);
 await p.click('button[data-a="new"]'); await p.waitForTimeout(150);
 let ps=await p.$$('button[data-pick]'); await ps[0].click(); await p.waitForTimeout(80); ps=await p.$$('button[data-pick]:not([disabled])'); await ps[0].click(); await p.waitForTimeout(200);
 await p.evaluate(()=>{ run.floor=3; run.bosses={1:'goblinking'}; run.bonus={opts:['scout','forge']}; offerPaths(); renderCamp(); openScout(); });
 await p.waitForTimeout(150); await (await p.$('#sheet')).screenshot({path:'./out/scout-act1.png'});
 await p.evaluate(()=>closeModal());
 for(const [boss,fl,t] of [['banshee',8,9],['pitlord',12,7]]){
   await p.evaluate(({boss,fl})=>{ delete document.getElementById('modal').dataset.lock; document.getElementById('sheet').onclick=null; closeModal(); run.floor=fl; run.bonus=null; run.bosses={}; run.bosses[Math.ceil(fl/4)]=boss; run.heroes.forEach(h=>{h.lv=3;h.open=[0,1,2,3];}); offerPaths(); renderCamp(); },{boss,fl});
   await p.click('.fightbar button'); await p.waitForTimeout(200);
   if(boss==='vampirelord'){ await p.evaluate(()=>{ const v=battle.units.find(u=>u.eid==='vampirelord'); v.hp=Math.floor(v.maxHp*0.55); }); for(let i=0;i<120;i++){ const st=await p.evaluate(()=>{const v=battle.units.find(u=>u.eid==='vampirelord'); return v.veilUntil>battle.t;}); if(st) break; await p.waitForTimeout(100);} }
   else await p.evaluate(t=>{ for(let i=0;i<t*20;i++) stepBattle(battle,0.05); renderUnits(); },t);
   await p.waitForTimeout(250);
   const info=await p.evaluate(()=>battle.units.filter(u=>u.side==='e'&&u.alive).map(u=>u.eid+(u.veilUntil>battle.t?'(veiled)':'')).join(','));
   console.log(boss,'→',info);
   await p.screenshot({path:`./out/boss-${boss}.png`});
   await p.evaluate(()=>{ if(loop){clearInterval(loop);loop=null;} battle._ended=true; battle=null; });
 }
 console.log('errors',errs); await b.close(); })();
