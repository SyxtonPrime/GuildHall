const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:844}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+__dirname+'/../game/guildhall.html'); await p.waitForTimeout(400);
 await p.click('button[data-a="new"]'); await p.waitForTimeout(150);
 let ps=await p.$$('button[data-pick]'); await ps[0].click(); await p.waitForTimeout(80); ps=await p.$$('button[data-pick]:not([disabled])'); await ps[0].click(); await p.waitForTimeout(200);
 await p.evaluate(()=>{ run.relics=Object.keys(RELICS); run.floor=16; run.endless=true; run.cleared=true; rollShop(false); renderCamp(); });
 console.log('shop relic:',await p.evaluate(()=>JSON.stringify(run.shop.relic)));
 await p.evaluate(()=>freePick('relic',()=>{ window._after=1; renderCamp(); }));
 await p.waitForTimeout(200); await p.screenshot({path:'allrel.png'});
 await p.click('button[data-fp-ok]').catch(()=>{}); await p.waitForTimeout(150); console.log('after ran:',await p.evaluate(()=>!!window._after),'gold',await p.evaluate(()=>run.gold),'modal hidden',await p.evaluate(()=>$('#modal').hidden)); console.log('pick modal buttons:',await p.evaluate(()=>document.querySelectorAll('#sheet button').length),'text:',await p.evaluate(()=>document.querySelector('#sheet').innerText.slice(0,120).replace(/\n/g,' | ')));
 await p.screenshot({path:'allrel.png'});
 console.log('errors:',errs); await b.close();
})();
