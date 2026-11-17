"""Reuse the normal box silhouette/shading; recolor red and add a speed symbol."""
from pathlib import Path
import colorsys
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
source = Image.open(ROOT / 'public/assets/Obj/mover_normal.png').convert('RGBA')
result = source.copy()
pixels = []
for r, g, b, a in source.getdata():
    h, s, l = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    if a and s > 0.12 and l > 0.10:
        rr, gg, bb = colorsys.hls_to_rgb(0.99, l, max(s, 0.68))
        r, g, b = round(rr * 255), round(gg * 255), round(bb * 255)
    pixels.append((r, g, b, a))
result.putdata(pixels)
# Supersampled cream-white double chevron, fully inside the opaque front face.
scale = 4
mark = Image.new('RGBA', (256 * scale, 192 * scale))
draw = ImageDraw.Draw(mark)
for x in (103, 130):
    shape = [(x, 88), (x + 13, 88), (x + 30, 111), (x + 13, 134), (x, 134), (x + 17, 111)]
    draw.polygon([(px * scale, (py + 2) * scale) for px, py in shape], fill=(124, 29, 40, 230))
    draw.polygon([(px * scale, py * scale) for px, py in shape], fill=(255, 248, 225, 255))
mark = mark.resize(source.size, Image.Resampling.LANCZOS)
result = Image.alpha_composite(result, mark)
# Never enlarge the collision silhouette or change the source transparency.
result.putalpha(source.getchannel('A'))
target = ROOT / 'public/assets/Special/speed_box.png'
result.save(target, optimize=True)
assert result.size == (256, 192)
assert result.getchannel('A').tobytes() == source.getchannel('A').tobytes()
print(f'Created {target}; size={result.size}; bbox={result.getbbox()}')
