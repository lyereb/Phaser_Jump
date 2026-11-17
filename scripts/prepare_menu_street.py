"""Normalize generated facade textures and split the fixed sky/city plate.
Run from the project root: python scripts/prepare_menu_street.py
Original menu.png and generation masters are never overwritten.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / '.work' / 'menu-street' / 'raw'
TARGET = ROOT / 'public' / 'assets' / 'MenuStreet'
TARGET.mkdir(parents=True, exist_ok=True)

plate = Image.open(SOURCE / 'sky-city.png').convert('RGB')
# Measured fixed skyline base at y=1676, not the prompt's requested 59%.
# Separate crops let runtime place its base at the actual road vanishing point.
plate.crop((0, 0, 1440, 980)).resize((864, 588), Image.Resampling.LANCZOS).save(TARGET / 'sky.jpg', quality=90)
plate.crop((0, 980, 1440, 1678)).resize((1080, 524), Image.Resampling.LANCZOS).save(TARGET / 'city.jpg', quality=91)
for name in ('shop-peach', 'shop-teal', 'shop-cream'):
    Image.open(SOURCE / f'{name}.png').convert('RGB').resize((512, 512), Image.Resampling.LANCZOS).save(TARGET / f'{name}.jpg', quality=92)
for p in TARGET.iterdir():
    with Image.open(p) as image:
        print(p.name, image.size, p.stat().st_size)
