const {chromium}=require('playwright');
(async()=>{ const b=await chromium.launch(); const p=await b.newPage({viewport:{width:400,height:900},deviceScaleFactor:2});
 await p.goto('file://'+__dirname+'/../game/guildhall.html'); await p.waitForTimeout(400);
 await p.evaluate(()=>{
  const basics=['venom','ember','frost','ward','edge','vital','swift','gilt'];
  const rares=Object.keys(GEMS).filter(k=>GEMS[k].rare&&!GEMS[k].merged);
  const row=(title,fn,ids)=>`<div class="eyebrow" style="margin:10px 0 4px">${title}</div><div style="display:flex;flex-wrap:wrap;gap:8px">${ids.map(id=>`<div style="display:flex;flex-direction:column;align-items:center;gap:3px;width:42px;font-size:9px;color:var(--muted);text-align:center;line-height:1.1">${fn(id)}<span>${GEMS[id].name.replace("'s",'')}</span></div>`).join('')}</div>`;
  let html=row('Current · basics',id=>ic(id,'g',34),basics)+row('Current · 2 & 3 essence',id=>ic(id,'g',34),rares);
  // ---- proposal ----
  const NEWC={poison:'#9be15d',burn:'#ff5c3a',chill:'#8fe3ff',shield:'#5b8cff',crit:'#f0f0f8',heal:'#ff7ab8',speed:'#c47bff',gold:'#ffd166'};
  Object.assign(ARCH_C,NEWC);
  GEM_G.edge='execedge';
  Object.assign(GLYPH,{
   bloodstone:'M12 3c3 5 6 8 6 12a6 6 0 0 1-12 0c0-4 3-7 6-12z M10 14a2 2 0 0 0 2 2',
   hearthstone:'M4 20h16 M6 20v-8l6-5 6 5v8 M12 17c-2-1-3-3-1-5 0 1 1 2 1 2 0-2 1-3 2-3 0 2 1 3-2 6z',
   rimeheart:'M12 20c-5-4-8-7-8-11a4 4 0 0 1 8-2 4 4 0 0 1 8 2c0 4-3 7-8 11z M12 7v9 M9 10l3 2 3-2',
   sunstone:'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
   quicksilver:'M13 2L5 14h6l-1 8 9-13h-6z',
   moonstone:'M15 3a9 9 0 1 0 6 15 7 7 0 0 1-6-15z',
   ambergold:'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M12 7l1.5 3 3 .5-2 2 .5 3-3-1.5-3 1.5.5-3-2-2 3-.5z',
   verdigris:'M12 3a7 7 0 0 0-7 7c0 3 2 4 2 6h10c0-2 2-3 2-6a7 7 0 0 0-7-7z M9 20h6 M9 11h1 M14 11h1',
   chaosshard:'M12 2l4 6-2 4 5 2-7 8-4-6 2-4-5-2z M12 2v20',
   titanseye:'M2 12c3-5 7-7 10-7s7 2 10 7c-3 5-7 7-10 7s-7-2-10-7z M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',
   stormheart:'M7 16a4 4 0 0 1 0-8 5 5 0 0 1 10 0 4 4 0 0 1 0 8 M13 12l-3 5h4l-2 4',
   hollowpearl:'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16z M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',
   midasheart:'M12 20c-5-4-8-7-8-11a4 4 0 0 1 8-2 4 4 0 0 1 8 2c0 4-3 7-8 11z M12 7v8 M10 9h3a1.5 1.5 0 0 1 0 3h-2a1.5 1.5 0 0 0 0 3h3',
  });
  document.querySelector('svg[style*="display:none"]').remove(); buildSprite();
  const HEX='polygon(50% 0,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)', OCT='polygon(30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%)';
  const icN=(id,size)=>{ const gd=GEMS[id]; if(!gd.rare) return ic(id,'g',size);
    const cs=gd.ess.map(e=>ARCH_C[GEMS[e].arch]); const n=cs.length; const stops=cs.map((c,i)=>`${c}cc ${Math.round(100*i/n)}% ${Math.round(100*(i+1)/n)}%`).join(',');
    return `<span class="ico g rare" style="--s:${size}px;--c:#fff;clip-path:${n===2?HEX:OCT};background:conic-gradient(from ${n===2?'0deg':'90deg'},${stops})"><svg viewBox="0 0 24 24"><use href="#g-${GLYPH[id]?id:'sparkgem'}"/></svg></span>`; };
  html+=`<div style="border-top:1px solid var(--line);margin:14px 0"></div>`+row('Proposed · basics (edge → blade glyph)',id=>icN(id,34),basics)+row('Proposed · 2-essence = hexagon, 3-essence = octagon, own glyphs',id=>icN(id,34),rares);
  html+=row('Proposed at market/socket size (28px)',id=>icN(id,28),basics.concat(rares));
  document.querySelectorAll('.screen').forEach(e=>e.hidden=true); const d=document.createElement('div'); d.id='mock'; d.style.cssText='padding:4px 0'; d.innerHTML=html; document.getElementById('app').appendChild(d);
 });
 await p.waitForTimeout(200); await (await p.$('#mock')).screenshot({path:'./out/gem-icons-mockup.png'}); await b.close(); })();
