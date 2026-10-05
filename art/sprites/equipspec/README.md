# Gem-in-gear specs (style B: "stones + tint")
One JSON file per hero id (same ids as sprites.py HEROES). Grid coords are [row, col], 0-indexed, on the hero's 16x16 grid.

{
 "kit": "Sword + shield",                         // short loadout description
 "labels": {"weapon":"Sword","body":"Breastplate","head":"Helm","off":"Shield"},
 "sock": {"weapon":[[5,2]], "body":[[8,7],[8,8]], ...},   // 1-2 pixels: the jewel itself
 "reg":  {"weapon":[[0,2],[1,2],...] or [{"box":[r0,r1,c0,c1],"chars":"Ww"}], ...}  // pixels tinted 50% toward the gem colour
}

Slots unlock in this order: weapon (★), body (★), head (★★), off (★★★).
- weapon: the main weapon. Stone on the hilt/guard/grip/head; region = the blade/head/limb.
- body: a clear piece of torso gear (breastplate, belt, harness, robe trim). Region should be a compact shape, not a stripe running into the legs.
- head: helm crest, hood rim, headband, hat band, circlet. The stone sits INSIDE the tinted band.
- off: one-handed heroes = the off-hand item (shield, second dagger, flask, orb, book...). Two-handed heroes = a second socket on the same weapon (the other half of the bow/staff/axe haft).
Rules: never put a stone or region on K outline pixels or on skin/face; stones must not be adjacent to each other across slots; a region is 3-14 pixels; regions of different slots must not overlap. Rare (two-colour) gems tint with their first colour and the stone alternates the two colours, so 2-pixel stones are preferred for body/off.
Preview: `cd art/sprites && python3 equip.py preview out/equip/p_<name>.png id1 id2 ...` then Read the PNG.
It shows each hero: base, then 4 test builds with all four slots filled, at 8x, plus 2x thumbnails. The stone+tint must be visible at 2x.
