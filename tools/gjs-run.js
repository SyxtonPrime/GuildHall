// Runs one of the node tools under gjs (SpiderMonkey) when node is not installed:
//   gjs tools/gjs-run.js tools/tune.js 300
// Shims require() for the engine, process.env/argv and console; nothing else from node is needed by the tools.
const GLib=imports.gi.GLib;
const read=p=>{ const [ok,bytes]=GLib.file_get_contents(p); if(!ok) throw new Error('cannot read '+p); return new TextDecoder().decode(bytes); };
const script=ARGV[0]; const dir=GLib.path_get_dirname(script);
globalThis.process={env:Object.fromEntries(GLib.listenv().map(k=>[k,GLib.getenv(k)])),argv:['gjs',script,...ARGV.slice(1)]};
globalThis.require=p=>{ const file=p.startsWith('.')?GLib.build_filenamev([dir,p]):p; const module={exports:{}}; new Function('module','exports',read(file))(module,module.exports); return module.exports; };
new Function('module','exports',read(script))({exports:{}},{});
