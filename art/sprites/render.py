import sys, json, os
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
import importlib, sprites; importlib.reload(sprites)
from sprites import PALETTE, all_sprites

OUT = os.path.join(os.path.dirname(__file__), 'out'); PNG = os.path.join(OUT, 'png'); os.makedirs(PNG, exist_ok=True)
BG = (0x14,0x11,0x26)

def hexrgb(h): return tuple(int(h[i:i+2],16) for i in (1,3,5))

def render(grid, scale=1):
    h=len(grid); w=len(grid[0])
    im=Image.new('RGBA',(w,h),(0,0,0,0))
    px=im.load()
    for y,row in enumerate(grid):
        for x,ch in enumerate(row):
            if ch!='.':
                if ch not in PALETTE: raise SystemExit(f'unknown char {ch!r}')
                px[x,y]=hexrgb(PALETTE[ch])+(255,)
    if scale>1: im=im.resize((w*scale,h*scale),Image.NEAREST)
    return im

def main():
    sp=all_sprites()
    bad=[(k,len(r)) for k,n,t,g in sp for r in g if len(r) not in (16,24)]
    if bad: print('WIDTH PROBLEMS', bad)
    # individual pngs (1x and 8x)
    for k,n,t,g in sp:
        render(g).save(f'{PNG}/{k}.png')
        render(g,8).save(f'{PNG}/{k}@8x.png')
    # review sheet with labels
    S=6; cell=24*S+8; cols=7
    from math import ceil
    rows=ceil(len(sp)/cols)
    sheet=Image.new('RGB',(cols*cell+16, rows*(cell+18)+16),BG)
    d=ImageDraw.Draw(sheet)
    for i,(k,n,t,g) in enumerate(sp):
        cx=8+(i%cols)*cell; cy=8+(i//cols)*(cell+18)
        im=render(g,S)
        ox=cx+(cell-im.width)//2; oy=cy+(cell-im.height)
        sheet.paste(im,(ox,oy),im)
        d.text((cx+4,cy+cell+2),n,fill=(230,225,245))
    sheet.save(f'{OUT}/review_sheet.png')
    # clean 1x sprite sheet
    x=0; ims=[render(g) for _,_,_,g in sp]
    sh=Image.new('RGBA',(sum(i.width for i in ims),24),(0,0,0,0)); meta={}
    for (k,n,t,g),im in zip(sp,ims):
        sh.paste(im,(x,24-im.height)); meta[k]={'x':x,'y':24-im.height,'w':im.width,'h':im.height,'name':n,'kind':t}; x+=im.width
    sh.save(f'{OUT}/spritesheet.png'); json.dump(meta,open(f'{OUT}/spritesheet.json','w'),indent=1)
    # JS data for artifact
    data={k:{'name':n,'kind':t,'rows':g} for k,n,t,g in sp}
    open(f'{OUT}/sprites.js','w').write('const PALETTE='+json.dumps(PALETTE)+';\nconst SPRITES='+json.dumps(data)+';\n')
    print('ok', len(sp))
main()
