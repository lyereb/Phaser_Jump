from pathlib import Path
from PIL import Image
import shutil, json

ROOT=Path(r'D:\Repo\Phaser_Jump')
KINDS=('coin','shield','spring')
SOURCES={k: ROOT/f'outputs/{k}_box_ai_v2.png' for k in KINDS}
missing=[str(p) for p in SOURCES.values() if not p.is_file()]
if missing:
    raise SystemExit('AI原图尚未全部保存到本机；不修改任何当前盒子素材。缺少：\n'+'\n'.join(missing))
STAGE=ROOT/'.work/special-boxes/ai-v2-normalized'
STAGE.mkdir(parents=True,exist_ok=True)
records=[]
for kind,source in SOURCES.items():
    original=Image.open(source)
    original.load()
    if original.mode!='RGBA':
        raise SystemExit(f'{source.name}缺少原生透明通道，不进行替换。')
    alpha=original.getchannel('A')
    if alpha.getextrema()[0]!=0:
        raise SystemExit(f'{source.name}不是透明背景，不进行替换。')
    bounds=alpha.getbbox()
    if bounds is None:
        raise SystemExit(f'{source.name}为空图片，不进行替换。')
    sprite=original.crop(bounds).resize((247,138),Image.Resampling.LANCZOS)
    canvas=Image.new('RGBA',(256,192),(0,0,0,0))
    canvas.alpha_composite(sprite,(5,29))
    canvas.save(STAGE/f'{kind}_box.png',optimize=True)
    records.append({'kind':kind,'source':str(source),'original_size':original.size,'alpha_bounds':bounds,'game_size':[256,192]})

# Replace as a complete validated batch; no gameplay or collision code changes.
for kind in KINDS:
    shutil.copy2(STAGE/f'{kind}_box.png',ROOT/f'public/assets/Special/{kind}_box.png')
preview=Image.new('RGBA',(768,192),(235,246,255,255))
for index,kind in enumerate(KINDS):
    preview.alpha_composite(Image.open(STAGE/f'{kind}_box.png').convert('RGBA'),(256*index,0))
preview.save(ROOT/'.work/special-boxes/validation/ai-v2-preview.png')
(ROOT/'.work/special-boxes/validation/ai-v2-records.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
print('全部三种盒子已替换为本次AI图片，并保留256×192画布与原碰撞位置。')
