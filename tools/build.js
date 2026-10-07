// Builds the game from game/src (the source of truth):
//   game/guildhall.html             the single-file game
//   game/engine.js                  the DOM-free engine script, for the node tools
//   game/Guildhall-standalone.html  the same body under the standalone <head>
//   game/dev.html                   the same source files loaded directly, for working without a build step
// Run after every edit: `node tools/build.js` (or `npm run build`).
const fs=require('fs'), path=require('path');
const G=path.join(__dirname,'../game'), S=path.join(G,'src');
const read=f=>fs.readFileSync(path.join(S,f),'utf8');
// order matters: these are classic scripts sharing one scope, so a file may only use what earlier files define
const ENGINE=['engine/core.js','data/heroes.js','data/traits.js','data/fusions.js','data/gems.js','data/relics.js','data/enemies.js','engine/stats.js','engine/battle.js'];
const UI=['ui/dom.js','ui/sprites.js','ui/run.js','ui/screens.js','ui/camp.js','ui/forge.js','ui/events.js','ui/gems.js','ui/battle.js','ui/codex.js','ui/boot.js'];
const engine='\n'+ENGINE.map(read).join(''), ui='\n'+UI.map(read).join('');
const body=read('app.html')+'<script id="engine">'+engine+'</script>\n\n<script id="ui">'+ui+'</script>\n\n</body></html>';
const html=read('head.html')+'<style>\n'+read('style.css')+'</style>\n'+body;
fs.writeFileSync(path.join(G,'guildhall.html'),html);
fs.writeFileSync(path.join(G,'engine.js'),engine);
// the standalone keeps its own <head>; everything after guildhall.html's <body> tag (title, link, style, markup, scripts) follows it
const standalone=path.join(G,'Guildhall-standalone.html');
const afterBody=s=>s.slice(s.indexOf('<body>')+6);
fs.writeFileSync(standalone,fs.readFileSync(standalone,'utf8').slice(0,fs.readFileSync(standalone,'utf8').indexOf('<body>')+6)+afterBody(html));
const tag=f=>`<script src="src/${f}"></script>`;
fs.writeFileSync(path.join(G,'dev.html'),read('head.html')+'<link rel="stylesheet" href="src/style.css">\n'+read('app.html')+ENGINE.concat(UI).map(tag).join('\n')+'\n</body></html>\n');
console.log('wrote game/guildhall.html, game/engine.js, game/Guildhall-standalone.html and game/dev.html');
