from pathlib import Path
from PIL import Image
import hashlib, json, shutil

ROOT=Path(r'D:\Repo\Phaser_Jump')
WORK=ROOT/'.work/ai-assets-1512'
source=WORK/'raw/shield_box_retry.png'
target=ROOT/'public/assets/Special/shield_box.png'
others=[ROOT/'public/assets/Checkpoint/checkpoint_bag.png', ROOT/'public/assets/Special/coin_box.png', ROOT/'public/assets/Special/spring_box.png']
before={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in others}
if not source.is_file():
    raise SystemExit('护盾 AI 原图未回传；不修改任何素材。')
with Image.open(source) as original:
    original.load()
    if original.mode!='RGBA':raise SystemExit('原图无原生透明通道；不替换。')
    alpha=original.getchannel('A')
    if alpha.getextrema()[0]!=0 or alpha.getextrema()[1]<240:raise SystemExit('透明背景不合格；不替换。')
    bounds=alpha.point(lambda a:255 if a>4 else 0).getbbox()
    if bounds is None:raise SystemExit('图片没有主体；不替换。')
    bounds=(max(0,bounds[0]-2),max(0,bounds[1]-2),min(original.width,bounds[2]+2),min(original.height,bounds[3]+2))
    sprite=original.crop(bounds).resize((248,139),Image.Resampling.LANCZOS)
    canvas=Image.new('RGBA',(256,192),(0,0,0,0))
    canvas.alpha_composite(sprite,(5,29))
    stage=WORK/'normalized/shield_box.png'
    canvas.save(stage,optimize=True)
    with Image.open(stage) as check:check.verify()
    shutil.copy2(stage,target)
    record={'asset':'shield_box','source_file':'raw/shield_box_retry.png','original_size':original.size,'source_alpha_bounds':bounds,'game_canvas':[256,192],'game_footprint':[5,29,253,168],'destination':'public/assets/Special/shield_box.png','source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'game_sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
for p in others:assert hashlib.sha256(p.read_bytes()).hexdigest()==before[str(p)],f'不应改动{p}'
records_path=WORK/'validation/asset-records.json'
records=json.loads(records_path.read_text(encoding='utf-8'))
records['replaced']=[r for r in records['replaced'] if r['asset']!='shield_box']+[record]
records['retained_missing_sources']=[]
records_path.write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
preview=Image.new('RGBA',(790,700),(230,243,251,255))
preview.alpha_composite(Image.open(WORK/'normalized/checkpoint_bag.png'),(0,0))
for i,kind in enumerate(['coin_box','shield_box','spring_box']):preview.alpha_composite(Image.open(WORK/f'normalized/{kind}.png'),(420,20+i*215))
preview.save(WORK/'validation/all-four-preview.png')
print('Verified shield replacement:',target)
print('Others remain byte-identical:',len(others))
print(json.dumps(record,ensure_ascii=False,indent=2))
