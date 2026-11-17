from pathlib import Path
from PIL import Image
import json, shutil, hashlib

ROOT = Path(r'D:\Repo\Phaser_Jump')
WORK = ROOT / '.work/ai-assets-1512'
RAW = WORK / 'raw'
STAGE = WORK / 'normalized'
STAGE.mkdir(parents=True, exist_ok=True)
SPECS = {
    'checkpoint_bag': ('public/assets/Checkpoint/checkpoint_bag.png', (395, 510), (10, 10, 385, 500)),
    'coin_box': ('public/assets/Special/coin_box.png', (256, 192), (5, 29, 253, 168)),
    'shield_box': ('public/assets/Special/shield_box.png', (256, 192), (5, 29, 253, 168)),
    'spring_box': ('public/assets/Special/spring_box.png', (256, 192), (5, 29, 253, 168)),
}

# Validate every available source before changing any project asset; explicitly retain missing types.
records = []
missing = []
for kind, (relative, size, target) in SPECS.items():
    p = RAW / f'{kind}.png'
    if not p.is_file():
        missing.append(kind)
        continue
    with Image.open(p) as original:
        original.load()
        if original.mode != 'RGBA':
            raise SystemExit(f'{kind} 缺少原生 RGBA 透明通道。')
        alpha = original.getchannel('A')
        if alpha.getextrema()[0] != 0 or alpha.getextrema()[1] < 240:
            raise SystemExit(f'{kind} 未检测到透明背景和完整不透明主体。')
        # Native-alpha outputs contain isolated A=1..4 artifacts far outside the subject.
        # Trim only this effectively invisible margin; keep the full antialiased subject with 2px padding.
        visible = alpha.point(lambda a: 255 if a > 4 else 0).getbbox()
        bounds = (max(0, visible[0]-2), max(0, visible[1]-2),
                  min(original.width, visible[2]+2), min(original.height, visible[3]+2)) if visible else None
        if bounds is None:
            raise SystemExit(f'{kind} 为空白图片。')
        # Adapt the intact subject to its original game footprint, without painting new image content.
        sprite = original.crop(bounds).resize((target[2]-target[0], target[3]-target[1]), Image.Resampling.LANCZOS)
        canvas = Image.new('RGBA', size, (0, 0, 0, 0))
        canvas.alpha_composite(sprite, (target[0], target[1]))
        canvas.save(STAGE/f'{kind}.png', optimize=True)
        records.append({'asset':kind, 'original_size':original.size, 'source_alpha_bounds':bounds,
                        'game_canvas':size, 'game_footprint':target, 'destination':relative,
                        'source_sha256':hashlib.sha256(p.read_bytes()).hexdigest()})

for record in records:
    kind = record['asset']
    p = STAGE / f'{kind}.png'
    with Image.open(p) as im:
        im.verify()
    shutil.copy2(p, ROOT / record['destination'])
    record['game_sha256'] = hashlib.sha256(p.read_bytes()).hexdigest()

preview = Image.new('RGBA',(790,700),(230,243,251,255))
preview.alpha_composite(Image.open(STAGE/'checkpoint_bag.png'),(0,0))
for i,kind in enumerate(['coin_box','shield_box','spring_box']):
    asset = STAGE/f'{kind}.png' if (STAGE/f'{kind}.png').is_file() else ROOT/SPECS[kind][0]
    preview.alpha_composite(Image.open(asset),(420,20+i*215))
preview.save(WORK/'validation/adapted-preview.png')
(WORK/'validation/asset-records.json').write_text(json.dumps({'replaced':records,'retained_missing_sources':missing},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(records,ensure_ascii=False,indent=2))
print('已替换本机成功回传的 AI 素材：', [r['asset'] for r in records])
print('保留原贴图的类型：', missing)
print('没有改动游戏、碰撞或计分源码。')
