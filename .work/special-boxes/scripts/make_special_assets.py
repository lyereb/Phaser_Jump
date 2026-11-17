from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import colorsys, math

ROOT=Path(r'D:\Repo\Phaser_Jump')
OUT=ROOT/'public/assets/Special'
OUT.mkdir(parents=True,exist_ok=True)
base=Image.open(ROOT/'public/assets/Obj/mover_normal.png').convert('RGBA')
S=4
palette={'coin':(0.36,(63,205,91)), 'shield':(0.57,(47,162,244)), 'spring':(0.105,(255,176,28))}
for kind,(hue,fill) in palette.items():
    source=ROOT/f'.work/special-boxes/assets/{kind}_box_source.png'
    if source.exists():
        src=Image.open(source).convert('RGBA');box=src.getbbox()
        src=src.crop(box).resize((247,138),Image.Resampling.LANCZOS)
        im=Image.new('RGBA',(256,192));im.alpha_composite(src,(5,29))
        im.save(OUT/f'{kind}_box.png',optimize=True)
        print(kind,'uses downloaded AI image')
        continue
    im=base.copy();pixels=im.load()
    for y in range(im.height):
        for x in range(im.width):
            r,g,b,a=pixels[x,y]
            if a and r>140 and g>90 and b<150 and r>b*1.5:
                old_h,l,s=colorsys.rgb_to_hls(r/255,g/255,b/255)
                rr,gg,bb=colorsys.hls_to_rgb(hue,l*0.96,min(s,0.87))
                pixels[x,y]=(round(rr*255),round(gg*255),round(bb*255),a)
            if a and 70<x<205 and 76<y<153 and r>210 and g>210 and b>180:
                pixels[x,y]=(*fill,a)
    body_fill=im.getpixel((70,110))
    im=im.resize((256*S,192*S),Image.Resampling.LANCZOS)
    lid_strip=im.crop((0,0,256*S,92*S))
    d=ImageDraw.Draw(im)
    d.rectangle((73*S,79*S,195*S,154*S),fill=body_fill)
    im.paste(lid_strip,(0,0))
    def ell(box,fill_,outline=None,width=2):d.ellipse(tuple(round(v*S) for v in box),fill=fill_,outline=outline,width=width*S)
    def poly(points,fill_,outline='#263238',width=3):
        p=[(round(x*S),round(y*S)) for x,y in points];d.polygon(p,fill=fill_);d.line(p+[p[0]],fill=outline,width=width*S,joint='curve')
    if kind=='coin':
        ell((102,96,154,148),'#ffcf24','#775414',3);ell((108,102,148,142),'#ffe657','#c68b15',2)
        try:font=ImageFont.truetype(r'C:\Windows\Fonts\arialbd.ttf',32*S)
        except OSError:font=ImageFont.load_default(size=32*S)
        d.text((128*S,121*S),'$',font=font,fill='#ba7c14',anchor='mm',stroke_width=0)
    elif kind=='shield':
        poly([(105,97),(151,97),(148,129),(128,148),(108,129)],'#e6faff','#15456e',3)
        poly([(128,105),(143,105),(140,126),(128,138)],'#88dfff','#88dfff',1)
    else:
        points=[]
        for i in range(181):
            t=i/180;points.append(((128+22*math.sin(t*math.pi*6))*S,(99+t*43)*S))
        d.line(points,fill='#594019',width=9*S,joint='curve')
        d.line(points,fill='#fff082',width=4*S,joint='curve')
        d.line([(108*S,97*S),(147*S,97*S)],fill='#594019',width=5*S)
        d.line([(108*S,145*S),(147*S,145*S)],fill='#594019',width=5*S)
    im=im.resize((256,192),Image.Resampling.LANCZOS)
    im.save(OUT/f'{kind}_box.png',optimize=True)
    print(kind,'uses locally adapted original sprite',im.size)

# A catalog preview for inspecting all three usable game textures.
preview=Image.new('RGBA',(768,192),(235,246,255,255))
for index,kind in enumerate(palette):preview.alpha_composite(Image.open(OUT/f'{kind}_box.png').convert('RGBA'),(256*index,0))
preview.save(ROOT/'.work/special-boxes/validation/asset-preview.png')
