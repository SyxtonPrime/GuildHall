const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:844}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+__dirname+'/../game/guildhall.html'); await p.waitForTimeout(400);
 await p.click('button[data-a="new"]'); await p.waitForTimeout(150);
 let ps=await p.$$('button[data-pick]'); await ps[0].click(); await p.waitForTimeout(80); ps=await p.$$('button[data-pick]:not([disabled])'); await ps[0].click(); await p.waitForTimeout(200);
 await p.evaluate(()=>{ run.gold=30; run.heroes[0]={id:'knight',lv:3,gems:['edge','frost',null,null],open:[0,1,2,3],row:'front',kills:0}; run.bag=['venom','swift']; renderGems(0); document.querySelector('#s-gems details').open=true; });
 await p.waitForTimeout(150); await p.screenshot({path:'gk0.png',fullPage:true});
 // hold on slotted frost (armor) -> sheet
 await p.evaluate(()=>gemSheet('frost','slot',1)); await p.waitForTimeout(100); await p.screenshot({path:'gk1.png'});
 console.log('sheet:',await p.evaluate(()=>document.querySelector('#sheet').innerText.replace(/\n/g,' | ').slice(0,200)));
 await p.evaluate(()=>{ closeModal(); renderCamp(); }); await p.waitForTimeout(100);
 console.log('camp statline:',await p.evaluate(()=>document.querySelector('#s-camp .cell.filled .st').innerText.replace(/\n/g,' ')));
 await p.evaluate(()=>{ run.enc=genEncounter(6,0); startBattle(); speed=99; }); await p.waitForTimeout(300);
 await p.evaluate(()=>{ if(loop){clearInterval(loop);loop=null;} runToEnd(battle); endBattle(); }); await p.waitForTimeout(200);
 console.log('errors:',errs); await b.close();
})();
