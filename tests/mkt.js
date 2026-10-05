const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:360,height:900},deviceScaleFactor:2});
 await p.goto('file://'+__dirname+'/../game/guildhall.html'); await p.waitForTimeout(400);
 await p.click('button[data-a="new"]'); await p.waitForTimeout(150);
 let ps=await p.$$('button[data-pick]'); await ps[0].click(); await p.waitForTimeout(80); ps=await p.$$('button[data-pick]:not([disabled])'); await ps[0].click(); await p.waitForTimeout(200);
 await p.evaluate(()=>{ run.gold=18; run.shop.heroes=[{id:'cleric'},{id:'berserker'},{id:'rogue'}].map(x=>({id:x.id,sold:false})); run.shop.gems=[{id:'venom',sold:false},{id:'rimeheart',sold:false},{id:'ward',sold:true}]; run.shop.relic={id:'huntinghorn',sold:false}; renderCamp(); });
 const T=`.mk .gt{background:var(--panel);border:1px solid var(--line);border-radius:10px;cursor:pointer}.mk .gt.sold{opacity:.4}.mk .gt.rare{border-color:#8a6fd1}.mk .gt.relic{border-color:#7a6220}.mk .c{font-weight:700;color:var(--gold)}.mk .sold .c{color:var(--muted)}`;
 const variants={
  current: null,
  A_gems_and_relic_one_row: `<style>${T}
   .mk .g{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.mk .gt{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 3px 4px;font-size:10px;text-align:center;min-width:0}.mk .n{font-weight:600;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}</style>
   <div class="g">
    <div class="gt">ICON(venom,30)<div class="n">Venom</div><div class="c">3g</div></div>
    <div class="gt rare">ICON(rimeheart,30)<div class="n">Rimeheart <span class="good">+3</span></div><div class="c">5g</div></div>
    <div class="gt sold">ICON(ward,30)<div class="n">Ward</div><div class="c">bought</div></div>
    <div class="gt relic">RICON(huntinghorn,30)<div class="n">Hunting Horn</div><div class="c">6g</div></div>
   </div>`,
  B_icon_strip_with_relic_name: `<style>${T}
   .mk .g{display:flex;gap:6px}.mk .gt{flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:5px 6px;font-size:11px;min-height:42px;min-width:0}
   .mk .gt.relic{flex:2.2;justify-content:flex-start}.mk .n{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1}</style>
   <div class="g">
    <div class="gt">ICON(venom,28)<span class="c">3g</span></div>
    <div class="gt rare">ICON(rimeheart,28)<span class="c">5g</span></div>
    <div class="gt sold">ICON(ward,28)<span class="c">—</span></div>
    <div class="gt relic">RICON(huntinghorn,28)<span class="n">Hunting Horn <span class="pill tier-common" style="font-size:9px;padding:0 4px">Common</span></span><span class="c">6g</span></div>
   </div>`,
  C_horizontal_gem_tiles_plus_slim_relic: `<style>${T}
   .mk .g{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.mk .gt{display:flex;align-items:center;gap:5px;padding:5px 6px;font-size:11px;min-height:40px;min-width:0}.mk .n{font-weight:600;line-height:1.1;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
   .mk .rl{display:flex;align-items:center;gap:8px;padding:5px 8px;margin-top:6px;font-size:12px}.mk .rl .d{color:var(--muted);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}</style>
   <div class="g">
    <div class="gt">ICON(venom,26)<div class="n">Venom</div><div class="c">3g</div></div>
    <div class="gt rare">ICON(rimeheart,26)<div class="n">Rimeh… <span class="good">+3</span></div><div class="c">5g</div></div>
    <div class="gt sold">ICON(ward,26)<div class="n">Ward</div><div class="c">—</div></div>
   </div>
   <div class="gt relic rl">RICON(huntinghorn,26)<b>Hunting Horn</b><span class="d">Back-row heroes attack faster</span><span class="c">6g</span></div>`,
  D_everything_in_two_rows: `<style>${T}
   .mk .g{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.mk .gt{display:flex;flex-direction:column;align-items:center;gap:1px;padding:5px 3px 4px;font-size:10px;text-align:center;min-width:0}.mk .n{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;color:var(--muted)}.mk .gt.hero .n{font-family:var(--num,inherit)}</style>
   <div class="g" style="margin-bottom:6px">
    <div class="gt hero">HICON(cleric,30)<div class="n">back · 38/4</div><div class="c">3g</div></div>
    <div class="gt hero">HICON(berserker,30)<div class="n">front · 48/6</div><div class="c">3g</div></div>
    <div class="gt hero">HICON(rogue,30)<div class="n">mid · 38/6</div><div class="c">3g</div></div>
    <div class="gt relic">RICON(huntinghorn,30)<div class="n" style="color:inherit;font-weight:600">Hunting Horn</div><div class="c">6g</div></div>
   </div>
   <div class="g">
    <div class="gt">ICON(venom,30)<div class="n">Venom</div><div class="c">3g</div></div>
    <div class="gt rare">ICON(rimeheart,30)<div class="n">Rimeheart <span class="good">+3</span></div><div class="c">5g</div></div>
    <div class="gt sold">ICON(ward,30)<div class="n">Ward</div><div class="c">bought</div></div>
    <div class="gt" style="visibility:hidden"></div>
   </div>`,
 };
 const out=[];
 for(const [name,html] of Object.entries(variants)){
   const h=await p.evaluate(({html})=>{
     const shop=document.querySelector('.shop'); if(!html) return shop.getBoundingClientRect().height;
     const hdr=shop.firstElementChild.outerHTML;
     let body=html.replace(/(?<![RH])ICON\((\w+),(\d+)\)/g,(m,id,sz)=>ic(id,'g',+sz,GEMS[id].name)).replace(/RICON\((\w+),(\d+)\)/g,(m,id,sz)=>ic(id,'r',+sz,RELICS[id].name)).replace(/HICON\((\w+),(\d+)\)/g,(m,id,sz)=>ic(id,'h',+sz,HEROES[id].name));
     const heroesRow=html.includes('HICON')?'':shop.querySelectorAll('.grid3')[0].outerHTML;
     shop.innerHTML=hdr+heroesRow+`<div class="mk" style="margin-top:6px">${body}</div>`; return shop.getBoundingClientRect().height; },{html});
   const el=await p.$('.shop'); const path=`mkt_${name}.png`; await el.screenshot({path}); out.push(name+' shop height='+Math.round(h)+'px');
   await p.evaluate(()=>renderCamp());
 }
 console.log(out.join('\n'));
 await b.close();
})();
