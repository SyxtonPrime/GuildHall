# Sprite editing brief

Sprites live as text grids in art/sprites/sprites.py (dict HEROES / ENEMIES: id -> (name, grid string)).
One char = one pixel, '.' = transparent. Palette letters and hex values are in PALETTE at the top of that file.
Heroes face RIGHT, enemies face LEFT. Regular units are 16x16, elites/bosses 24x24 — keep the size.

DO NOT edit sprites.py. Instead write your new grid for a sprite to art/sprites/fixes/<id>.txt
(just the grid rows, one per line, no quotes). It automatically overrides the original.

To check your work: `cd art/sprites && python3 preview.py out/p_<yourname>.png id1 id2 ...`
then Read the PNG (8x plus a 2x thumbnail so you can judge readability at game size). Iterate until it reads well;
a sprite that looks good at 2x is the bar. Every row must be the same width; the script errors on unknown palette letters.

Rules of thumb (from the art critique):
- No solid black (K) rows for hat brims: brims use the hat's dark shade, K only at the two ends.
- Hand-held props (bows, swords, staffs, flasks): draw them WITHOUT a K outline box; the hand pixel touches the prop directly.
- Bows are 1px arcs with a straight string on the body side. Blades are W/G, hilts T/Y.
- Keep silhouettes distinct from each other; give each unit one clear "tell" (weapon or headgear).
- Keep the existing style: K outlines around body/head, 2-tone shading, same palette. Don't add new palette letters.

## Facing angle (pass 3)
The game author wants every unit to face the viewer with only a SLIGHT turn to the side. Enemies turn slightly LEFT, heroes slightly RIGHT.
Reference for the right angle: skeleton, cultist, wraith, lich, rifttitan (see out/ref_angle.png). Note what they have in common:
- torso and head seen from the front (symmetrical-ish outline, both shoulders/arms visible);
- BOTH eyes visible, with the face features shifted 1px toward the facing side (or the far eye 1px narrower);
- the weapon/prop held out on the facing side, the other arm hanging by the body;
- feet side by side, not one behind the other.
Profile cues to remove: a single visible eye, a long snout/beak in profile, a nose/ear silhouette poking out one side, a body that is a horizontal blob.
Quadrupeds (warg) and the multi-headed hydra: draw them 3/4 from the front — chest and both forelegs toward the viewer, heads turned slightly left.

## New enemies (pass 4)
New enemy ids exist in sprites.py as blank placeholders; write your grid to fixes/<id>.txt as before. They are ENEMIES: face the viewer with a slight turn LEFT (see the facing-angle section). Look at out/review_sheet.png to match the style, weight and outline conventions of the existing enemies, and keep silhouettes distinct from them (no second goblin, no second skeleton).

## New bosses (pass 5)
Five bosses were added to the game with rough placeholder art: ratking, broodmother, vampirelord, banshee, pitlord.
Their current grids are in placeholders/<id>.txt (sprites.py loads them); your finished grid goes in fixes/<id>.txt as usual.
- 24x24, ENEMY facing (front view, slight turn LEFT — see "Facing angle").
- Match the weight of the existing bosses: goblinking, lich, rifttitan, bonedragon (and elites ogre, minotaur, hydra).
  Render them with preview.py next to yours to compare. Bosses fill most of the 24x24 box (feet on the bottom 1–2 rows, ~20–23 px tall).
- Each boss must read at 2x (≈ 48 px in game, often 32 px). One big clear tell, a strong silhouette, 2-tone shading plus a highlight.
- Must be distinct from existing sprites — especially from its own minions (rat, spider, bat) and from goblinking (who already has a gold crown + staff).

## Class sprites (pass 6)
Every class in the promotion tree has its own 16x16 hero sprite, id = class name in lowercase letters (see README). When drawing or revising one:
- Keep a visible link to each class that promotes into it (same body, prop, hat or essence colours), so a promotion reads as the same hero dressed up.
- Essence colours: frost C/c/U, ember R/O/Y, venom N/n/L, vital M/m/R, ward B/b, edge W/G steel, swift P/p, gilt Y/y.
- Ornament grows with tier: starters plain with one prop; tier 3 a bigger prop, trim or cape; capstones a crown, halo, aura or twin props. Still 16x16, still one clear tell.
- Each sprite needs an `equipspec/<id>.json` (stone + tint region per gear slot); check it with `equip.py preview`.
