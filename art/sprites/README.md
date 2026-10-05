# Guildhall pixel art — source

Pixel sprites for the Guildhall autobattler: 18 heroes and 39 enemies (16×16 regular units, 24×24 elites and bosses), on one 30-colour palette.

## Layout
- `sprites.py` — the palette (`PALETTE`) and the base grids (`HEROES`, `ENEMIES`). One character = one pixel, `.` = transparent.
- `fixes/<id>.txt` — the finished grid for each sprite. These override the base grids in `sprites.py` when it's imported, so **this folder holds the current art**.
- `placeholders/` — the rough placeholder grids for the five v35 bosses (Rat King, Broodmother, Vampire Lord, Banshee, Pit Lord), kept for reference.
- `equipspec/<hero>.json` + `equip.py` — gem sockets drawn into hero gear (stone pixels, tinted regions and slot labels per gear slot). See `equipspec/README.md`.
- `EDITOR_BRIEF.md` — the style rules used for every sprite (facing angle, outlines, props, bosses).
- `gallery.html` — the sprite gallery page (open in a browser).
- `out/` — rendered output: `sprites.js` (palette + grids, as used by the game), `spritesheet.png/.json`, `review_sheet.png`, and per-sprite PNGs in `out/png/` (1× and @8x).

## Commands (Python 3 + Pillow)
- `python3 preview.py preview.png ratking lich knight` — 8× and 2× preview of the named sprites.
- `python3 render.py` — rebuild everything in `out/`.
- `python3 equip.py preview gems.png knight ranger` — preview gem sockets; `python3 equip.py export` prints the game's `const EQUIP=…;`.

## Into the game
The game's `const SPR={…}` holds the same grids (`id:[row, row, …]`) and `const EQUIP=…` comes from `equip.py export`.
