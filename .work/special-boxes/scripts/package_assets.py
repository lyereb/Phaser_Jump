from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from PIL import Image
root=Path(r'D:\Repo\Phaser_Jump')
out=root/'outputs';out.mkdir(exist_ok=True)
p=out/'special-boxes-assets.zip'
if p.exists():p=out/'special-boxes-assets-20261111.zip'
files=[root/f'public/assets/Special/{kind}_box.png' for kind in ('coin','shield','spring')]
for f in files:
    im=Image.open(f);assert im.size==(256,192) and im.mode=='RGBA' and im.getextrema()[3][0]==0
with ZipFile(p,'w',ZIP_DEFLATED) as z:
    for f in files:z.write(f,f.name)
    z.write(root/'docs/special-boxes.md','special-boxes.md')
with ZipFile(p) as z:assert z.testzip() is None;print('Verified deliverable:',p, 'entries:',z.namelist())
