const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:844}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+__dirname+'/../game/guildhall.html'); await p.waitForTimeout(400);
 await p.click('button[data-a="new"]'); await p.waitForTimeout(150);
 let ps=await p.$$('button[data-pick]'); await ps[0].click(); await p.waitForTimeout(80); ps=await p.$$('button[data-pick]:not([disabled])'); await ps[0].click(); await p.waitForTimeout(200);
 const stock=()=>p.evaluate(()=>run.shop.heroes.map(h=>h.id+(h.sold?'*':'')).join(',')+' | '+run.shop.gems.map(g=>g.id+(g.sold?'*':'')).join(','));
 await p.evaluate(()=>{ run.gold=30; renderCamp(); });
 await p.click('[data-oi="0"]'); await p.waitForTimeout(100); await p.click('button[data-x="buy"],button[data-buy]').catch(()=>{});
 console.log('before:',await stock());
 await p.click('button[data-a="freeze"]'); await p.waitForTimeout(100); await p.screenshot({path:'frozen.png',fullPage:true});
 await p.evaluate(()=>{ run.shop.gems[0].sold=true; run.floor++; run.enc=genEncounter(run.floor,run.depth); rollShop(false); renderCamp(); });
 console.log('after floor (frozen):',await stock(), 'frozen=',await p.evaluate(()=>run.frozen));
 await p.click('button[data-a="freeze"]'); await p.waitForTimeout(100);
 await p.evaluate(()=>{ run.floor++; run.enc=genEncounter(run.floor,run.depth); rollShop(false); renderCamp(); });
 console.log('after floor (unfrozen):',await stock());
 // stats
 await p.evaluate(()=>{ meta.wins=2; meta.maxDepth=2; const d=depthStats(1); d.bestEndless=15; d.bestStreak=3; d.streak=1; save(KEY_META,meta); window._depth=1; renderTitle(); });
 await p.waitForTimeout(100); await p.screenshot({path:'title_stats.png',fullPage:true});
 console.log('title text:',await p.evaluate(()=>document.querySelector('.depthstats').textContent));
 console.log('errors:',errs); await b.close();
})();
