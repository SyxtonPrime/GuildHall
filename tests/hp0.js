const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:844}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+__dirname+'/../game/guildhall.html'); await p.waitForTimeout(400);
 await p.click('button[data-a="new"]'); await p.waitForTimeout(150);
 let ps=await p.$$('button[data-pick]'); await ps[0].click(); await p.waitForTimeout(80); ps=await p.$$('button[data-pick]:not([disabled])'); await ps[0].click(); await p.waitForTimeout(200);
 await p.evaluate(()=>{ run.heroes[0]={id:'pyromancer',lv:1,gems:['stormheart',null],open:[0,1],row:'back',kills:0}; run.bag=['stormheart','chaosshard']; renderGems(0); });
 const st=()=>p.evaluate(()=>JSON.stringify({gems:run.heroes[0].gems,bag:run.bag,hp:computeStats(run.heroes[0],run.relics).maxHp,toast:[...document.querySelectorAll('.toast')].map(t=>t.textContent).pop()||''}));
 console.log('start',await st());
 await p.click('[data-bag="0"]'); await p.waitForTimeout(100); await p.click('[data-slot="1"]'); await p.waitForTimeout(150);
 console.log('2nd stormheart',await st());
 // vital case: equip vital then stormheart then try removing vital
 await p.evaluate(()=>{ run.heroes[0].gems=['stormheart','vital']; run.heroes[0].lv=2; run.heroes[0].open=[0,1,2]; run.heroes[0].gems=['stormheart','vital',null]; run.bag=['stormheart']; renderGems(0); });
 await p.click('[data-bag="0"]'); await p.waitForTimeout(150);
 console.log('stormheart with vital',await st());
 await p.click('[data-slot="1"]'); await p.waitForTimeout(150);
 console.log('remove vital',await st());
 console.log('errors',errs); await b.close();
})();
