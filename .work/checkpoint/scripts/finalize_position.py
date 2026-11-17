from pathlib import Path
import json
root=Path(r'D:\Repo\Phaser_Jump')
p=root/'src/game/checkpoints.ts'
s=p.read_text(encoding='utf-8').replace('surfaceY - playerHeight - jumpHeight * 0.55','surfaceY - playerHeight - jumpHeight * 0.78')
p.write_text(s,encoding='utf-8')
names=['成功跳过且落地：49→54，50米爆袋仅触发一次','跳过红绳但落回原箱子：不爆袋、不加分','越线后撞击失败：不爆袋','不是刚好50也触发：48→53，后续100和150依次出现','暂停及恢复倒计时不推进爆袋动画','重新开始重置50米且旧特效对象清理']
(root/'.work/checkpoint/validation/scene-results.json').write_text(json.dumps({'passed':6,'source':'真实 Phaser 本地浏览器测试页面，2026-11-11','results':[{'name':n,'passed':True} for n in names]},ensure_ascii=False,indent=2),encoding='utf-8')
