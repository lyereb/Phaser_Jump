"""Regression checks for the white speed-box texture defect."""
from pathlib import Path
from PIL import Image
import hashlib
import json

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / '.work/speed-color-fix'
source_path = ROOT / 'public/assets/Special/speed_box.png'
image = Image.open(source_path).convert('RGBA')
normal = Image.open(ROOT / 'public/assets/Obj/mover_normal.png').convert('RGBA')
old = Image.open(WORK / 'backups/speed_box.png').convert('RGBA')
results = []

def check(name, condition):
    assert condition, name
    results.append(name)
    print('PASS', name)

def red_body(im):
    for point in [(80, 80), (180, 80), (80, 130), (180, 130), (130, 60)]:
        r, g, b, a = im.getpixel(point)
        if not (a > 200 and r > 180 and r > g * 1.5 and r > b * 1.5):
            return False
    return True

check('corrected lid and front body samples are red, not near-white', red_body(image))
check('known broken old texture is rejected by the same color check', not red_body(old))
check('source canvas remains 256 x 192', image.size == (256, 192))
check('complete alpha channel remains identical to normal box', image.getchannel('A').tobytes() == normal.getchannel('A').tobytes())
check('opaque silhouette bounds remain unchanged', image.getbbox() == (5, 29, 253, 168))
solid = [(r, g, b) for r, g, b, a in image.get_flattened_data() if a > 200]
red_fraction = sum(r > 180 and r > g * 1.5 and r > b * 1.5 for r, g, b in solid) / len(solid)
check('red is the dominant opaque surface color', red_fraction > 0.5)
original_hashes = json.loads((WORK / 'validation/preserved-hashes.json').read_text(encoding='utf-8'))
check('ordinary, coin, shield and spring textures are unchanged', all(hashlib.sha256((ROOT / p).read_bytes()).hexdigest() == digest for p, digest in original_hashes.items()))
check('production texture exactly matches corrected source', (ROOT / 'dist/assets/Special/speed_box.png').read_bytes() == source_path.read_bytes())
preloader = (ROOT / 'src/game/scenes/Preloader.ts').read_text(encoding='utf-8')
check('speed-box request has a new cache version', "Special/speed_box.png?v=red-v2" in preloader)
output = {'passed': len(results), 'redFraction': red_fraction, 'tests': results, 'bodySamples': [list(image.getpixel(p)) for p in [(80, 80), (180, 80), (80, 130), (180, 130), (130, 60)]]}
(WORK / 'validation/asset-results.json').write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'{len(results)} asset checks passed.')
