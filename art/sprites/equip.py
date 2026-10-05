"""Gem-in-equipment mockups. Slot unlock order: weapon, body, head, off (offhand or 2nd weapon socket)."""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
import sprites
from sprites import PALETTE, HEROES, parse

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'equip'); os.makedirs(OUT, exist_ok=True)
hexrgb = lambda h: tuple(int(h[i:i+2], 16) for i in (1, 3, 5))
def mix(a, b, t): return tuple(round(a[i]*(1-t)+b[i]*t) for i in range(3))
DARKBG = hexrgb('#1b1530')
GEMC = {'venom':'#9be15d','ember':'#ff9a4d','frost':'#7fc8ff','ward':'#5ee0c8','edge':'#f2c14e','vital':'#6fe3a5','swift':'#c9a3ff','gilt':'#ffd166'}
RARE = {'hearthstone':['ember','ward']}
def ramp(g):  # light, main, dark
    m = hexrgb(GEMC[g]); return mix(m, (255,255,255), .55), m, mix(m, DARKBG, .45)
EMPTY = hexrgb('#262138')

def grid(h): return parse(HEROES[h][1])
def pick(g, box, chars):  # (r0,r1,c0,c1) inclusive
    r0, r1, c0, c1 = box
    return [(r, c) for r in range(r0, r1+1) for c in range(c0, c1+1) if g[r][c] in chars]

SPECDIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'equipspec')
DEFAULT_GEMS = {'knight':['ward','vital','ward','hearthstone'],'ranger':['swift','edge','swift','ember'],'rogue':['edge','swift','edge','venom'],'cleric':['vital','ward','vital','ember'],'berserker':['ember','vital','ember','swift']}
def resolve(g, items):
    pts = []
    for it in items:
        if isinstance(it, dict): pts += pick(g, tuple(it['box']), it['chars'])
        else: pts.append(tuple(it))
    return pts
def spec(h):
    g = grid(h)
    p = os.path.join(SPECDIR, h + '.json')
    if os.path.exists(p):
        d = json.load(open(p))
        return dict(hand=d.get('kit',''), off_label=d.get('labels',{}).get('off',''), labels=d.get('labels',{}),
                    sock={k: [tuple(x) for x in d['sock'].get(k, [])] for k in SLOTS},
                    reg={k: resolve(g, d['reg'].get(k, [])) for k in SLOTS},
                    gems=DEFAULT_GEMS.get(h, ['ember','ward','swift','hearthstone']))
    return spec_legacy(h)
def spec_legacy(h):
    g = grid(h)
    if h == 'knight':
        return dict(hand='Sword + shield', off_label='Shield',
            sock=dict(weapon=[(5,2)], body=[(8,7),(8,8)], head=[(1,7),(1,8)], off=[(8,12),(9,12)]),
            reg=dict(weapon=pick(g,(0,4,2,2),'Ww'), body=pick(g,(7,9,6,9),'gG'),
                     head=pick(g,(1,1,5,10),'Gw'), off=pick(g,(7,10,11,14),'Y')),
            gems=['ward','vital','ward','hearthstone'])
    if h == 'ranger':
        return dict(hand='Bow (two-handed)', off_label='Bow, 2nd socket',
            sock=dict(weapon=[(7,15)], body=[(11,7),(11,8)], head=[(2,7)], off=[(9,15)]),
            reg=dict(weapon=[(3,13),(4,14),(5,14),(6,15),(7,15),(8,15)], off=[(9,15),(10,15),(11,14),(12,14),(13,13)],
                     body=pick(g,(11,11,6,9),'T'), head=pick(g,(2,2,5,9),'N')),
            gems=['swift','edge','swift','ember'])
    if h == 'rogue':
        return dict(hand='Twin daggers', off_label='Off-hand dagger',
            sock=dict(weapon=[(9,13)], body=[(12,7),(12,8)], head=[(4,8)], off=[(9,2)]),
            reg=dict(weapon=[(10,13),(11,14)], off=[(7,2),(8,2)], body=pick(g,(12,12,6,9),'T'), head=pick(g,(4,4,6,10),'h')),
            gems=['edge','swift','edge','venom'])
    if h == 'cleric':
        return dict(hand='Staff (two-handed)', off_label='Staff, 2nd socket',
            sock=dict(weapon=[(1,3)], body=[(8,8)], head=[(3,8)], off=[(6,2)]),
            reg=dict(weapon=pick(g,(0,2,1,4),'Y'), off=pick(g,(3,7,2,2),'T'), body=pick(g,(7,7,6,10),'w')+pick(g,(8,12,6,10),'Y'),
                     head=pick(g,(3,3,6,10),'W')),
            gems=['vital','ward','vital','ember'])
    if h == 'berserker':
        return dict(hand='Greataxe (two-handed)', off_label='Axe, 2nd socket',
            sock=dict(weapon=[(3,14)], body=[(7,6)], head=[(3,6),(3,7)], off=[(8,12)]),
            reg=dict(weapon=pick(g,(1,5,13,15),'G'), off=pick(g,(6,12,11,12),'T'), body=pick(g,(7,7,4,8),'tT'),
                     head=pick(g,(3,3,3,9),'OS')),
            gems=['ember','vital','ember','swift'])
HEROS = ['knight', 'ranger', 'rogue', 'cleric', 'berserker']
SLOTS = ['weapon', 'body', 'head', 'off']
STAGES = [('★ · no gems', 2, 0), ('★ · 2 gems', 2, 2), ('★★ · 3 gems', 3, 3), ('★★★ · 4 gems', 4, 4)]

def base_img(g):
    im = Image.new('RGBA', (len(g[0]), len(g)), (0,0,0,0)); px = im.load()
    for y, row in enumerate(g):
        for x, ch in enumerate(row):
            if ch != '.': px[x, y] = hexrgb(PALETTE[ch]) + (255,)
    return im

def gem_colors(gem, i=0):
    parts = RARE.get(gem, [gem]); return ramp(parts[min(i, len(parts)-1)])

def render(h, variant, unlocked, filled):
    g = grid(h); s = spec(h); im = base_img(g); px = im.load()
    for k, slot in enumerate(SLOTS):
        if k >= unlocked: continue
        gem = s['gems'][k] if k < filled else None
        if variant == 'stones':
            pts = s['sock'][slot]
            for j, (r, c) in enumerate(pts):
                if gem is None: px[c, r] = EMPTY + (255,); continue
                parts = RARE.get(gem, [gem])
                lt, mn, dk = ramp(parts[j % len(parts)]) if len(parts) > 1 else ramp(gem)
                px[c, r] = (lt if (len(pts) > 1 and j == 0 and len(parts) == 1) else mn) + (255,)
        elif variant in ('imbued', 'tinted') and gem:
            pts = s['reg'][slot]; parts = RARE.get(gem, [gem])
            rows = sorted({r for r, c in pts}); mid = rows[len(rows)//2] if rows else 0
            lum = lambda o: (0.299*o[0]+0.587*o[1]+0.114*o[2])/255
            tones = sorted({lum(hexrgb(PALETTE[g[r][c]])) for r, c in pts})
            for (r, c) in pts:
                gm = parts[0] if (len(parts) == 1 or r < mid or variant == 'tinted') else parts[1]
                lt, mn, dk = ramp(gm); o = hexrgb(PALETTE[g[r][c]]); L = lum(o)
                if variant == 'tinted':
                    px[c, r] = mix(o, mn, .5) + (255,); continue
                if len(tones) == 1: col = lt if L > .72 else mn
                elif L == tones[-1]: col = lt if L > .6 else mn
                elif L == tones[0]: col = dk
                else: col = mn
                px[c, r] = col + (255,)
            if variant == 'tinted':
                for j, (r, c) in enumerate(s['sock'][slot]):
                    lt, mn, dk = ramp(parts[j % len(parts)]); px[c, r] = (lt if j == 0 and len(s['sock'][slot]) > 1 and len(parts) == 1 else mn) + (255,)
    return im

GEM_ICON = ["...K...", "..KHK..", ".KHHMK.", "KHMMMDK", ".KMMDK.", "..KDK..", "...K..."]
def gem_icon(gem):
    im = Image.new('RGBA', (7, 7), (0,0,0,0)); px = im.load(); parts = RARE.get(gem, [gem])
    for y, row in enumerate(GEM_ICON):
        for x, ch in enumerate(row):
            if ch == '.': continue
            gm = parts[0] if (len(parts) == 1 or x + y < 6) else parts[1]
            lt, mn, dk = ramp(gm)
            px[x, y] = (hexrgb('#1b1530') if ch == 'K' else lt if ch == 'H' else mn if ch == 'M' else dk) + (255,)
    return im

def preview(out, ids):
    builds = [['ember','ward','swift','venom'], ['frost','edge','vital','hearthstone'], ['venom','swift','ember','ward'], ['gilt','frost','edge','ember']]
    S = 8; cw = 16*S + 10
    im = Image.new('RGB', (cw*5 + 20, len(ids)*(16*S + 64) + 10), (0x1f, 0x1a, 0x33)); d = ImageDraw.Draw(im)
    for ri, h in enumerate(ids):
        y = 8 + ri*(16*S + 64); s = spec(h)
        # sanity checks
        allpts = {}
        for k in SLOTS:
            for p in s['reg'][k] + s['sock'][k]:
                r, c = p
                ch = grid(h)[r][c]
                if ch in '.K': d.text((8, y+16*S+34), f'WARN {k} {p} on {ch!r}', fill=(255,120,120))
            for p in s['reg'][k]:
                if p in allpts and allpts[p] != k: d.text((8, y+16*S+48), f'WARN overlap {k}/{allpts[p]} at {p}', fill=(255,120,120))
                allpts[p] = k
        frames = [base_img(grid(h))]
        for b in builds:
            s['gems'] = b; frames.append(render_spec(h, s, 4, 4))
        for i, f in enumerate(frames):
            big = f.resize((16*S, 16*S), Image.NEAREST); im.paste(big, (8 + i*cw, y), big)
            sm = f.resize((32, 32), Image.NEAREST); im.paste(sm, (8 + i*cw + 48, y + 16*S + 4), sm)
        d.text((8, y + 16*S + 20), f"{h}: {s['hand']} | " + ' · '.join(f"{k}={s.get('labels',{}).get(k,'')}" for k in SLOTS), fill=(230,225,245))
    im.save(out); print('wrote', out)

def render_spec(h, s, unlocked, filled):
    global spec
    orig = spec
    try:
        spec = lambda _h: s
        return render(h, 'tinted', unlocked, filled)
    finally:
        spec = orig

def export_js():
    out = {}
    for f in sorted(os.listdir(SPECDIR)):
        if not f.endswith('.json'): continue
        h = f[:-5]; s = spec(h)
        out[h] = {'s': [[list(p) for p in s['sock'][k]] for k in SLOTS], 'r': [[list(p) for p in s['reg'][k]] for k in SLOTS], 'l': [s['labels'].get(k, '') for k in SLOTS]}
    return 'const EQUIP=' + json.dumps(out, separators=(',', ':')) + ';'

if __name__ == '__main__' and len(sys.argv) > 1 and sys.argv[1] == 'preview':
    preview(sys.argv[2], sys.argv[3:]); sys.exit()
if __name__ == '__main__' and len(sys.argv) > 1 and sys.argv[1] == 'export':
    print(export_js()); sys.exit()
if __name__ == '__main__':
    files = []
    for h in HEROS:
        for v in ('stones', 'tinted', 'imbued'):
            for i, (_, u, f) in enumerate(STAGES):
                p = f'{OUT}/{h}_{v}_{i}.png'; render(h, v, u, f).save(p); files.append(p)
    for gm in list(GEMC) + list(RARE):
        gem_icon(gm).save(f'{OUT}/gem_{gm}.png')
    # review sheet: rows = hero, cols = stones stages | imbued stages, at 6x, plus 2x strip
    S = 6; cw = 16*S + 12
    sheet = Image.new('RGB', (cw*12 + 60, len(HEROS)*(16*S + 60) + 20), (0x1f, 0x1a, 0x33)); d = ImageDraw.Draw(sheet)
    for ri, h in enumerate(HEROS):
        y = 10 + ri*(16*S + 60)
        for vi, v in enumerate(('stones', 'tinted', 'imbued')):
            for i in range(4):
                x = 10 + (vi*4 + i)*cw + vi*20
                im = render(h, v, STAGES[i][1], STAGES[i][2])
                sheet.paste(im.resize((16*S, 16*S), Image.NEAREST), (x, y), im.resize((16*S, 16*S), Image.NEAREST))
                sm = im.resize((32, 32), Image.NEAREST); sheet.paste(sm, (x + 30, y + 16*S + 8), sm)
        d.text((10, y + 16*S + 44), f'{h}: stones | stones + tint | imbued', fill=(220, 215, 240))
    sheet.save(f'{OUT}/review.png'); print('ok', len(files))
