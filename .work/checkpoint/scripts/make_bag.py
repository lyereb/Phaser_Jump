from pathlib import Path
from PIL import Image, ImageDraw
import math

ROOT = Path(r'D:\Repo\Phaser_Jump')
OUT = ROOT / 'public/assets/Checkpoint'
OUT.mkdir(parents=True, exist_ok=True)
S = 3
im = Image.new('RGBA', (512*S, 576*S))
draw = ImageDraw.Draw(im)
outline = '#483025'
paths = []

def shape(start, segments, fill, stroke=outline, width=12):
    pts = [start]
    current = start
    svg = f'M {start[0]} {start[1]}'
    for seg in segments:
        if len(seg) == 2:
            current = seg
            pts.append(current)
            svg += f' L {seg[0]} {seg[1]}'
        else:
            x1,y1,x2,y2,x3,y3 = seg
            x0,y0 = current
            for i in range(1, 33):
                t=i/32; u=1-t
                pts.append((u*u*u*x0+3*u*u*t*x1+3*u*t*t*x2+t*t*t*x3,
                            u*u*u*y0+3*u*u*t*y1+3*u*t*t*y2+t*t*t*y3))
            current=(x3,y3)
            svg += f' C {x1} {y1} {x2} {y2} {x3} {y3}'
    draw.polygon([(round(x*S),round(y*S)) for x,y in pts], fill=fill)
    if stroke:
        draw.line([(round(x*S),round(y*S)) for x,y in pts+[pts[0]]], fill=stroke, width=width*S, joint='curve')
    paths.append(f'<path d="{svg} Z" fill="{fill}" stroke="{stroke or "none"}" stroke-width="{width}" stroke-linejoin="round"/>')

# Large, plain belly deliberately leaves room for dynamically rendered metre numbers.
shape((192,159), [(175,204,104,230,87,328),(60,449,124,521,251,524),(380,527,454,457,425,334),(413,243,343,210,320,159)], '#ffe829')
shape((107,371), [(104,450,157,500,253,502),(341,502,393,465,412,406),(391,489,328,518,251,519),(160,518,94,474,107,371)], '#ffc72b', None, 0)
shape((161,269), [(131,308,120,339,125,367),(143,341,153,316,176,292),(182,278,175,270,161,269)], '#fff582', None, 0)
# Gathered yellow neck.
shape((190,143), [(181,118,163,88,161,69),(185,46,209,79,222,72),(234,42,271,47,283,76),(308,61,335,53,350,77),(339,104,326,125,315,148)], '#ffde22')
# Ribbon tails first, behind the knot and loops.
shape((234,148), [(219,187,206,225,164,257),(190,261),(211,247),(219,274),(253,236,268,190,262,155)], '#ec5143')
shape((267,149), [(282,180,297,215,340,241),(320,251),(295,235),(295,262),(266,230,247,190,249,157)], '#df4037')
# Two chunky red loops.
shape((242,128), [(211,96,152,95,115,110),(71,129,70,161,102,177),(141,195,197,170,240,154)], '#ef5648')
shape((270,128), [(309,91,361,95,405,111),(447,127,446,162,413,177),(370,197,314,174,271,154)], '#ef5648')
shape((119,128), [(151,116,194,116,219,139),(184,131,155,134,129,146)], '#ff7a63', None, 0)
shape((295,137), [(328,116,365,116,403,135),(370,129,331,133,301,151)], '#ff7a63', None, 0)
shape((235,119), [(245,106,270,107,280,121),(290,139,282,168,271,178),(255,184,237,174,232,158),(227,143,229,127,235,119)], '#d93631')
shape((244,126), [(250,119,264,119,270,128),(257,126),(247,145)], '#ff7a63', None, 0)

im = im.resize((512,576), Image.Resampling.LANCZOS)
bbox = im.getbbox()
# Keep a modest alpha margin and exact front-view proportions.
box = (max(0,bbox[0]-10),max(0,bbox[1]-10),min(512,bbox[2]+10),min(576,bbox[3]+10))
im = im.crop(box)
im.save(OUT / 'checkpoint_bag.png', optimize=True)
(OUT / 'checkpoint_bag.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s %s %s %s">%s</svg>' % (box[0],box[1],box[2]-box[0],box[3]-box[1],''.join(paths)), encoding='utf-8')
print('Saved:', OUT / 'checkpoint_bag.png', im.size, 'alpha:', im.getextrema()[3])
