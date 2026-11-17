from pathlib import Path
from PIL import Image
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib, json, shutil
ROOT=Path(r'D:\Repo\Phaser_Jump')
WORK=ROOT/'.work/ai-assets-1512'
OUT=ROOT/'outputs/ai-assets-1512'
SOURCES={
 'checkpoint_bag.png':ROOT/'public/assets/Checkpoint/checkpoint_bag.png',
 'coin_box.png':ROOT/'public/assets/Special/coin_box.png',
 'shield_box.png':ROOT/'public/assets/Special/shield_box.png',
 'spring_box.png':ROOT/'public/assets/Special/spring_box.png',
}
# Verify used images before creating final copies.
for name,path in SOURCES.items():
    expected=(395,510) if name=='checkpoint_bag.png' else (256,192)
    with Image.open(path) as im:
        im.load();assert im.mode=='RGBA' and im.size==expected and im.getchannel('A').getextrema()[0]==0
    assert path.read_bytes()==(WORK/'normalized'/name).read_bytes()
    assert path.read_bytes()!=(WORK/'backups'/name).read_bytes()
OUT.mkdir(parents=True,exist_ok=True)
for name,path in SOURCES.items():
    shutil.copy2(path,OUT/name)
    assert (OUT/name).read_bytes()==path.read_bytes()
readme='''# AI 素材替换：2026-11-11 15:12 批次

本目录的四张PNG是真正成功传回本机、适配并已用于游戏的AI图片：福袋395×510，三种道具盒均为256×192，均有原生透明通道。不是此前本地绘制的备用版本。

- checkpoint_bag.png：黄色福袋与红色蝴蝶结；米数由游戏动态绘制，原有左右爆开帧仍适用。
- coin_box.png：绿色金币盒。
- shield_box.png：蓝色护盾盒，白色与浅蓝色护盾图标。
- spring_box.png：金色弹簧盒。

护盾盒首次单独传输失败，用户授权单张重试后于15:24成功回传并替换；另外三张没有重生成或改动。四种贴图已经全部完成AI替换。

只替换贴图和更新文档，游戏逻辑、10%道具概率、金币收益、护盾抵挡、十盒高弹簧、每50米checkpoint均未改动。生成原图、适配脚本、验证记录与修改前备份位于.work/ai-assets-1512/。

本地游戏预览：http://127.0.0.1:8080/ 。
'''
(OUT/'README.md').write_text(readme,encoding='utf-8')
archive=ROOT/'outputs/ai-assets-1512.zip'
with ZipFile(archive,'w',ZIP_DEFLATED) as z:
    for name in [*SOURCES,'README.md']:z.write(OUT/name,name)
with ZipFile(archive) as z:
    assert z.testzip() is None
    for name in SOURCES:assert z.read(name)==SOURCES[name].read_bytes()
# Refresh an existing prior pack only; do not recreate an old pack deleted outside this operation.
old_pack = ROOT/'outputs/special-boxes-assets.zip'
if old_pack.is_file():
    with ZipFile(old_pack,'w',ZIP_DEFLATED) as z:
        for kind in ('coin','shield','spring'):z.write(ROOT/f'public/assets/Special/{kind}_box.png',f'{kind}_box.png')
        z.write(ROOT/'docs/special-boxes.md','special-boxes.md')
    with ZipFile(old_pack) as z:assert z.testzip() is None
print('Verified delivered PNGs:',*[str(OUT/name) for name in SOURCES],sep='\n')
print('Verified archive:',archive,archive.stat().st_size)
print('All four game images are verified AI replacements.')
