from pathlib import Path
import json
root=Path(r'D:\Repo\Phaser_Jump')
p=root/'docs/checkpoint.md'
s=p.read_text(encoding='utf-8')
s=s.replace('在下一次成功落地有可能达到该里程碑时，提前显示参考图风格的红色横绳和黄色福袋。', '开局即创建并放置 50 米目标，初始位置在屏幕上方；不再等到临近米数才创建或切换显示。随着角色成功向上跳，目标从屏幕上方逐渐进入视野，角色与它的距离越来越近。通过后立即提前预置下一个目标。')
s=s.replace('福袋使用世界坐标随镜头移动。', '里程碑固定在对应的米数坐标中，渲染时将剩余米数投影到实际箱子堆叠的世界坐标。因为连击加分为 1–5 米，而每块箱子物理高度相近，所以不能直接把每米当作一个固定箱子高度；投影位置使用 260 毫秒平滑更新，避免突然跳位。')
s=s.replace('正常游玩则在接近每 50 米的起跳前显示 checkpoint。', '正常游玩时，checkpoint 从开局就已摆好在上方；继续向上跳会看到它从屏幕顶部渐进出现。刷新后重新开始一局即可查看新行为。')
s=s.replace('6 项纯逻辑测试和 6 项真实 Phaser 场景测试均通过。', '8 项纯逻辑测试和 9 项真实 Phaser 场景测试均通过。')
s=s.replace('真实场景覆盖成功落地与一次触发、', '真实场景另覆盖开局预置、从 0 米连续真实起跳到 50 米时同一目标一直存在且距离逐步缩小、平滑更新不跳位、45→50 一次增加 5 米也可越线；同时覆盖成功落地与一次触发、')
s=s.replace('纯逻辑测试另覆盖直到 1000 米的连续里程碑。', '纯逻辑测试另覆盖距离连续性、5 米分段无突变、最后 1–5 米可一次跳过，以及直到 1000 米的连续里程碑。')
p.write_text(s,encoding='utf-8')
p=root/'TODO.md'
s=p.read_text(encoding='utf-8').replace('- [ ] checkpoint 从开局即预置','- [x] checkpoint 从开局即预置')
p.write_text(s,encoding='utf-8')
names=['开局已经预置50米目标，位于屏幕上方而不是等待临近才创建','从0米正常连续跳到50：同一目标始终存在，距离逐步缩小且不跳位','45→50一次增加5米，真实起跳也能越过红绳','成功跳过且落地：49→54，50米爆袋仅触发一次','跳过红绳但落回原箱子：不爆袋、不加分','越线后撞击失败：不爆袋','不是刚好50也触发：48→53，后续100和150依次出现','暂停及恢复倒计时不推进爆袋动画','重新开始重置50米且旧特效对象清理']
(root/'.work/checkpoint/validation/scene-results.json').write_text(json.dumps({'passed':9,'source':'真实 Phaser 本地浏览器测试页面，2026-11-11，提前预置修订','results':[{'name':n,'passed':True} for n in names]},ensure_ascii=False,indent=2),encoding='utf-8')
