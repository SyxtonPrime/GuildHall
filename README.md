# Guildhall

A phone-portrait autobattler roguelike, built into a single HTML file. Hire a guild, socket gems into their gear to unlock skills, and descend 12 floors (plus endless).

Play it: https://syxtonprime.github.io/GuildHall/ (redeploys on every push to `main`).

Snapshot: v35.1 with the art chat's boss sprites (artifact version 1791123116-fe7e, 4 Oct 2026).

## Layout

```
game/
  src/                        The source, and the only files you edit. Classic scripts sharing one scope, concatenated
                              in the order tools/build.js lists them:
    head.html, style.css, app.html     page head, stylesheet, markup
    engine/core.js                     helpers, tuning knobs and the status rules
    data/gems.js, relics.js, enemies.js  gems, relics, enemies and encounters
    data/classes.js                    GENERATED from design/gem-recipe-bench/recipes.json: the class tree and every skill's text
    engine/classes.js                  the class tree in use: roles and route stats, hiring, training and promotion, and HOOKS
                                       (each skill's effect, keyed by class name then skill name; empty entries do nothing yet)
    engine/stats.js, engine/battle.js  computeStats, the battle loop, statuses, hooks (DOM-free)
    ui/*.js                            sprites, run state, screens, camp, forge, events, gems, battle view, codex, boot
  dev.html                    Generated: loads game/src directly, for working without a build step.
  guildhall.html              Generated: the single-file game. Opens directly in a browser. Don't edit by hand.
  Guildhall-standalone.html   Generated: same body under a phone-friendly <head>. Don't edit by hand.
  engine.js                   Generated: the DOM-free engine script, for the node tools. Don't edit by hand.
tools/                        Node tools (no dependencies).
  build.js                    Builds the generated files from game/src and the bench snapshot. Run after every edit to the game.
  pybuild.py                  The same build in Python, for machines without node (`python3 tools/pybuild.py`). Keep in step.
  tune.js                     Balance bot: `node tune.js <runs> [depth]`. Prints win rate, per-enemy/hero/relic/gem/skill
                              tables and deaths by floor. Env: ELITE_P, NOEVENT, ENDLESS=1 (play on past floor 12),
                              BOSS=<id> (force a boss), G1 G2 G3 GE ACT3 (difficulty curve), NAIVE, FORCE_RELIC, EVEN.
  slotab.js, arena.js, chain.js  Older checks written against the pre-class-tree heroes; they need rewriting before they run again.
  floor-check.js              Engine-only check: random fixed parties against one floor's encounters (`[floor] [trials]`),
                              for comparing rule changes without the bot's decisions in the way. Env: ENGINE, PARTY, GEMS.
  gjs-run.js                  Runs any of the node tools under gjs when node isn't installed: `gjs tools/gjs-run.js tools/tune.js 300`.
tests/                        Playwright screenshot/flow scripts (need `npm i playwright` + a Chromium).
                              Each loads ../game/guildhall.html; run them from tests/ (`mkdir -p out` first). Screenshots
                              are gitignored.
                              ev.js = all five bonus events, boss.js = new bosses + Scout's Camp, bt.js = battle layout,
                              mkt*.js / gemmock.js = market and gem-icon mock-ups, others = older feature checks.
art/
  sprites/                    The pixel-art pipeline (Python 3 + Pillow): palette, sprite grids, gem-socket specs, gallery
                              page and rendered PNGs. See art/sprites/README.md.
  boss-placeholders/          The placeholder boss grids drawn in the game chat (superseded in-game by art/sprites).
  gem-sockets-design/         The gear-socket design canvas from the art chat (.dc.html artboards; images point at that
                              canvas's hosted uploads, so they only render inside the original canvas).
design/
  gem-recipe-bench/           The class tree / gem recipe design tool. Open index.html in a browser; recipes.json is the
                              latest exported snapshot (load it via the tool's snapshot import, re-export to update it).
docs/
  design-notes.md             Full design + balance notes (systems, numbers, history, tooling).
  new-enemy-sprites.md        Pixel-art format, palette and the enemy sprite grids.
  mockups/                    Market and gem-icon mock-ups.
```

## Working on it

Needs Node 18+ for the tools (nothing to install), and Python 3 + Pillow only if you touch the art.

1. Branch off `main` (`git switch -c my-change`).
2. Edit the files in `game/src/` (open `game/dev.html` in a browser to try changes without building). Class and skill text lives
   in the gem recipe bench (`design/gem-recipe-bench/recipes.json`); effects live in `HOOKS` in `game/src/engine/classes.js`.
3. `npm run build` to regenerate `game/guildhall.html`, `game/engine.js` and `game/Guildhall-standalone.html`, then e.g. `node tools/tune.js 1500`
   to check balance.
4. Commit the source and the generated files together, push, and open a pull request. CI fails the PR if the generated files
   are stale (`npm run check` does the same locally).

Keep branches short-lived, pull `main` before starting, and say which system you're in. If a merge conflicts in the
generated files, resolve `game/src/` only and re-run `npm run build`.

Art changes: edit `art/sprites/fixes/<id>.txt`, run `python3 render.py` in `art/sprites/`, then copy the grid into `SPR` in
the game (and `python3 equip.py export` for `EQUIP`).

To publish to the Claude artifact, paste `game/guildhall.html` into it.
