"""Usage: python3 preview.py out.png id1 id2 ...  -> renders the named sprites at 8x (and 2x beside) with labels."""
import sys, os, importlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
import sprites; importlib.reload(sprites)
from sprites import PALETTE, HEROES, ENEMIES, parse
out=sys.argv[1]; ids=sys.argv[2:]
def hexrgb(h): return tuple(int(h[i:i+2],16) for i in (1,3,5))
def render(grid, scale):
    h=len(grid); w=len(grid[0]); im=Image.new('RGBA',(w,h),(0,0,0,0)); px=im.load()
    for y,row in enumerate(grid):
        for x,ch in enumerate(row):
            if ch!='.':
                if ch not in PALETTE: raise SystemExit(f'unknown palette char {ch!r} in row {y}')
                px[x,y]=hexrgb(PALETTE[ch])+(255,)
    return im.resize((w*scale,h*scale),Image.NEAREST)
cell=24*8+8; W=cell+24*2+24
sheet=Image.new('RGB',(W*len(ids)+8, cell+24),(0x1f,0x1a,0x33)); d=ImageDraw.Draw(sheet)
for i,k in enumerate(ids):
    name,s=(HEROES.get(k) or ENEMIES[k]); g=parse(s)
    bad=[len(r) for r in g if len(r)!=len(g[0])]
    big=render(g,8); small=render(g,2)
    x=8+i*W; sheet.paste(big,(x,cell-big.height),big); sheet.paste(small,(x+cell+8,cell-small.height),small)
    d.text((x,cell+4),f'{name} {len(g[0])}x{len(g)}',fill=(230,225,245))
sheet.save(out); print('wrote',out)
