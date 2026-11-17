from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json
root=Path(r'D:\Repo\Phaser_Jump')
p=root/'TODO.md';s=p.read_text(encoding='utf-8');a=s.index('## 特殊道具盒子');s=s[:a]+s[a:].replace('- [ ]','- [x]');p.write_text(s,encoding='utf-8')
p=root/'docs/special-boxes.md';s=p.read_text(encoding='utf-8');s+='''

## 最终验证结果

TypeScript类型检查与生产构建通过。12项道具规则测试、6项弹簧弹道测试、10项道具真实场景测试均通过；原有checkpoint的8项纯逻辑和9项真实场景回归也通过，合计45项检查。真实场景使用独立QA金币存储，不污染正常游戏金币。

三种透明贴图及本文打包于 `outputs/special-boxes-assets.zip`，同时保留在游戏的原有素材目录中。生产构建 `dist/assets/Special/` 已包含三种PNG，验证页和备份未加入生产构建。
''';p.write_text(s,encoding='utf-8')
(root/'.work/special-boxes/validation/scene-results.json').write_text(json.dumps({'passed':10,'source':'2026-11-11真实Phaser场景，最终约10盒高版本','cases':['HUD位置与调试避让','普通20/50与完美40/100金币端点、同盒去重','金币累计与重开保留','护盾气泡、第一次抵挡与第二次击飞','护盾不叠加和重开清空','自动高跳与精确十盒居中及顶层落地','0.8秒十盒就位与普通流程禁入','弹簧50/100米checkpoint去重','暂停与倒计时冻结、恢复不重播','中途重开清理十盒与特效']},ensure_ascii=False,indent=2),encoding='utf-8')
p=root/'outputs/special-boxes-assets.zip'
with ZipFile(p,'w',ZIP_DEFLATED) as z:
    for kind in ('coin','shield','spring'):z.write(root/f'public/assets/Special/{kind}_box.png',f'{kind}_box.png')
    z.write(root/'docs/special-boxes.md','special-boxes.md')
with ZipFile(p) as z:
    assert z.testzip() is None and len(z.namelist())==4
    assert z.read('special-boxes.md')==(root/'docs/special-boxes.md').read_bytes()
print('Verified:',p,p.stat().st_size)
print('Verified:',root/'docs/special-boxes.md',(root/'docs/special-boxes.md').stat().st_size)
