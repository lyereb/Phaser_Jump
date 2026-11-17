from pathlib import Path
from PIL import Image
import json
ROOT = Path(__file__).resolve().parents[2]
report = []
for name in ['sunny', 'ocean', 'chicken', 'coffee', 'cake', 'royal']:
    raw = Image.open(ROOT / f'.work/skin-shop/raw/{name}.png').convert('RGBA')
    alpha = raw.getchannel('A')
    assert alpha.getextrema()[0] == 0, f'{name}: no native transparent background'
    # Ignore extremely faint alpha noise in the transparent margin; retain the complete object.
    bounds = alpha.point(lambda a: 255 if a >= 24 else 0).getbbox()
    assert bounds, name
    crop = raw.crop(bounds).resize((248, 139), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (256, 192), (0, 0, 0, 0))
    canvas.alpha_composite(crop, (5, 29))
    target = ROOT / f'public/assets/Skins/{name}.png'
    canvas.save(target, optimize=True)
    report.append({'skin': name, 'sourceBounds': bounds, 'size': canvas.size, 'bbox': canvas.getbbox(), 'path': str(target)})
    assert canvas.getbbox() == (5, 29, 253, 168), (name, canvas.getbbox())
    print(target)
(ROOT / '.work/skin-shop/validation/assets.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
