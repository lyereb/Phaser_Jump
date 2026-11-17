from pathlib import Path
p=Path(r'D:\Repo\Phaser_Jump\.work\special-boxes\scripts\make_special_assets.py')
s=p.read_text(encoding='utf-8').replace('    d=ImageDraw.Draw(im)\n    d.rectangle((73*S,79*S,195*S,154*S),fill=body_fill)', '    lid_strip=im.crop((0,0,256*S,92*S))\n    d=ImageDraw.Draw(im)\n    d.rectangle((73*S,79*S,195*S,154*S),fill=body_fill)\n    im.paste(lid_strip,(0,0))')
p.write_text(s,encoding='utf-8')
