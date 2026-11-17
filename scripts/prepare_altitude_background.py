"""Prepare three ordinary-size scrolling segments; original city art stays unchanged."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / '.work' / 'altitude-background' / 'raw'
TARGET = ROOT / 'public' / 'assets' / 'Altitude'
TARGET.mkdir(parents=True, exist_ok=True)
WIDTH, HEIGHT, OVERLAP = 720, 1280, 0.24
for name in ('clouds', 'atmosphere', 'moon-space'):
    image = Image.open(SOURCE / f'{name}.png').convert('RGBA').resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    # The upper segment overlays the preceding tile. Its bottom overlap fades to transparent.
    # RGB pixels remain the generated painting; this only adds an ordinary compositing alpha ramp.
    start = int(HEIGHT * (1 - OVERLAP))
    alpha = Image.new('L', (WIDTH, HEIGHT), 255)
    pixels = alpha.load()
    for y in range(start, HEIGHT):
        t = (y - start) / (HEIGHT - 1 - start)
        smooth = t * t * (3 - 2 * t)
        a = round(255 * (1 - smooth))
        for x in range(WIDTH):
            pixels[x, y] = a
    image.putalpha(alpha)
    image.save(TARGET / f'{name}.png', optimize=True)
    print(name, image.size, (TARGET / f'{name}.png').stat().st_size)
