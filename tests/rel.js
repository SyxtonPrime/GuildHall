const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:844}});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+__dirname+'/../game/guildhall.html'); await p.waitForTimeout(400);
 await p.click('button[data-a="new"]'); await p.waitForTimeout(150);
 let ps=await p.$$('button[data-pick]'); await ps[0].click(); await p.waitForTimeout(80); ps=await p.$$('button[data-pick]:not([disabled])'); await ps[0].click(); await p.waitForTimeout(200);
 // camp with relics + legendary in shop
 await p.evaluate(()=>{ run.gold=40; run.relics=['warhorn','cloak','grimoire','contract']; run.shop.relic={id:'smoke',sold:false}; renderCamp(); });
 await p.waitForTimeout(150); await p.screenshot({path:'rel_camp.png',fullPage:true});
 console.log('header:',await p.evaluate(()=>document.querySelector('#s-camp .eyebrow').textContent), '| reroll:',await p.evaluate(()=>document.querySelector('[data-a=reroll]').textContent));
 // boss pick
 await p.evaluate(()=>{ freePick('relic',()=>renderCamp()); }); await p.waitForTimeout(150); await p.screenshot({path:'rel_pick.png'});
 console.log('pick tiers:',await p.evaluate(()=>[...document.querySelectorAll('#sheet [data-fp] .pill')].map(x=>x.textContent).join(',')));
 await p.evaluate(()=>{ $('#sheet').onclick=null; delete $('#modal').dataset.lock; closeModal(); });
 // battle with grimoire + smoke
 await p.evaluate(()=>{ run.floor=9; run.relics=['grimoire','smoke','contract']; run.heroes=[{id:'knight',lv:2,row:'front',gems:['ward'],bonusHp:0},{id:'berserker',lv:2,row:'front',gems:['ember'],bonusHp:0},{id:'cleric',lv:2,row:'back',gems:['vital'],bonusHp:0},{id:'ranger',lv:2,row:'back',gems:['swift'],bonusHp:0}]; run.enc=genEncounter(9,0); startBattle(); speed=3; });
 let shot=0, sums=0, veils=0;
 for(let i=0;i<300;i++){ await p.waitForTimeout(80); const st=await p.evaluate(()=>({s:document.querySelectorAll('#pside .unit.summon').length,v:document.querySelectorAll('#pside .unit.veiled').length,over:battle.over,rows:[...document.querySelectorAll('#pside .grid4')].map(g=>g.children.length)}));
   sums=Math.max(sums,st.s); veils=Math.max(veils,st.v); if(st.rows.some(n=>n>4)) console.log('ROW OVERFLOW',st.rows);
   if(!shot&&st.s>=2){ await p.screenshot({path:'rel_battle.png'}); shot=1; } if(st.over) break; }
 console.log('max summons shown',sums,'veiled seen',veils);
 await p.waitForTimeout(900);
 console.log('end modal:', await p.evaluate(()=>document.querySelector('#sheet h2')&&document.querySelector('#sheet h2').textContent));
 // codex relic tab
 await p.evaluate(()=>{ closeModal(); meta.seen.r=Object.keys(RELICS); showCodex('r'); }); await p.waitForTimeout(150); await p.screenshot({path:'rel_codex.png'});
 console.log('errors:',errs); await b.close();
})();
