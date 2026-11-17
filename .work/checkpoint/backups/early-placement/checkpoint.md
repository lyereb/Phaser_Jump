# 每 50 米 checkpoint

已在现有 Phaser 4.2.1 项目中接入，未替换引擎，未改变原有计分规则，也未发布到外部网站。

## 游戏行为

checkpoint 对应显示分数中的 50、100、150……米，而不是世界坐标中的像素距离。在下一次成功落地有可能达到该里程碑时，提前显示参考图风格的红色横绳和黄色福袋。袋子上的数字由代码动态绘制，因此无需为不同米数生成多张图片。

角色起跳时清除本次越线记录，上升阶段头部越过红绳后记录越线。只有成功落到一块新箱子、并且计分达到或超过对应米数时才触发爆袋。落回原支撑箱子、撞击失败以及重复调用不会触发。连击从 49 米跳到 54 米仍领取 50 米 checkpoint，不会漏掉该里程碑。

爆袋动画包括短暂膨胀、袋子左右两半分离旋转飞出、红色和黄色纸屑散落，以及闪光扩散；声音复用现有 `public/assets/Audio/jackpot.mp3`。checkpoint 不是实体障碍，也没有增加奖励分数或复活存档功能。

横绳随屏幕宽度和镜头水平位置更新，福袋使用世界坐标随镜头移动。暂停和恢复倒计时期间冻结 checkpoint 动画，正式恢复后继续。新一局重新从 50 米开始，并清理上一局特效对象。

## 如何查看

在项目目录运行 `npm run dev`，然后打开 `http://127.0.0.1:8080/`。本次开发会话已启动该开发服务器。

进入游戏后打开右上角的“调试”，点击“测试Checkpoint”，可以快速查看福袋及爆开效果。该按钮仅播放视觉预览，不修改分数和实际 checkpoint 进度。正常游玩则在接近每 50 米的起跳前显示 checkpoint。

## 文件结构

| 文件 | 用途 |
| --- | --- |
| `src/game/checkpointProgress.ts` | 每 50 米的纯逻辑进度、越线记录与去重 |
| `src/game/checkpoints.ts` | 横绳、动态数字、完整福袋和爆开特效 |
| `src/game/scenes/Game.ts` | 起跳、越线、成功落地、适配、暂停及预览接入 |
| `src/game/scenes/Preloader.ts` | 预加载福袋和注册左右裂开帧 |
| `src/game/audio.ts` | 注册现有 jackpot 音频作为 checkpoint 音效 |
| `public/assets/Checkpoint/checkpoint_bag.png` | 游戏使用的透明福袋贴图 |
| `public/assets/Checkpoint/checkpoint_bag.svg` | 同造型的可编辑矢量源素材 |

当前实际使用的福袋是依据参考图在本地制作的透明矢量风格素材，不是成功落盘的 AI 图片。AI 生成请求已完成，但图片自动传输到本机失败，现有接口没有取回入口；没有重复生成。后续可直接替换 PNG，保持正视图、透明背景和袋腹数字留白。左右裂开帧按贴图宽度自动划分，完整袋子明确使用 `__BASE` 帧，避免 Phaser 在注册碎片后默认显示半张贴图。

## 验证结果

TypeScript `tsc --noEmit` 通过，`npm run build` 通过，`dist/assets/Checkpoint` 已包含 PNG 和 SVG 素材。6 项纯逻辑测试和 6 项真实 Phaser 场景测试均通过。

真实场景覆盖成功落地与一次触发、落回原箱子不触发、失败不触发、跳分和连续 100/150 米里程碑、暂停及倒计时冻结、重新开始与对象清理。纯逻辑测试另覆盖直到 1000 米的连续里程碑。

验证脚本、场景测试页和修改前备份保留在 `.work/checkpoint/`，不会包含在 Vite 生产构建中。运行纯逻辑测试：`node .work/checkpoint/scripts/test_progress.cjs`。本地场景测试页：`http://127.0.0.1:8080/.work/checkpoint/validation.html`。

另外检查到原项目 `player.ts` 配置加载 4 张 idle 帧，但素材目录仅有 `player_1_idle_0.png`，浏览器存在 idle 1–3 的原有加载错误。本次未擅自补充或改动角色动画。
