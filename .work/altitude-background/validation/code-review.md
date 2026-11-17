# 局内高度背景代码审查

审查对象：`src/game/altitudeBackground.ts`、`altitudeBackgroundModel.ts`、`scenes/Game.ts`、`scenes/Preloader.ts`、`scripts/prepare_altitude_background.py`，以及必要的本地 Phaser 4.2.1 渲染、相机和容器源码。

仅进行了源码阅读、现有 PNG 尺寸/透明度读取及代数计算；未初始化工程、修改源码、启动浏览器/服务、构建或重跑主任务验证。当前目录不具备可用的 Git 仓库上下文，因此不作“UI、角色、道具、计分相对历史版本完全未改”的差异证明。

## 有证据的缺陷

### P3：失败冻结未隔离仍在运行的 camera shake，已有调速状态下掉落期间背景仍会移动

**位置：** `altitudeBackground.ts:40–55`；`Game.ts:620–627, 699–711, 881–901, 1118–1121`。

`freeze()` 仅将进度模型设为停止；`layout()` 只做零滚动因子与 `1 / zoom` 补偿。现有护盾破裂会启动 150 ms 主相机震动，随后立即生成下一只移动盒；若下一次碰撞在该窗口内导致 `fly()`，死亡路径没有固定背景的屏幕变换，也没有消除背景受到的剩余震动。

这不是“scrollFactor(0) 无法抵消 scroll”的问题。Phaser 的 `Camera.preRender()` 在普通 scroll/zoom 矩阵之后仍调用 `shakeEffect.preRender()`（`node_modules/phaser/src/cameras/2d/Camera.js:630–639`）；后者向同一相机矩阵追加 `_offsetX/_offsetY`（`effects/Shake.js:204–209`）。`copyWithScrollFactorFrom()` 只加回 scroll（`components/TransformMatrix.js:700–713`），不会去除震动。Game 死亡后仍是活动场景，相机震动继续更新随机偏移，直至归零（`effects/Shake.js:228–269`）。所以进度虽冻结，屏幕上的背景仍可移动，然后在震动结束时回位。

**已有代码内的可达条件：** 默认速度下没有证据说明护盾震动会一直残留到全景阶段；缺陷限定在现有开发调速允许的状态。例如 720 宽视口、居中支撑、`boardPx = 2000`（已有调节上限）、剩余加速盒倍率 1.3（`itemRules.ts:6, 55–60`），护盾挡掉一只移动盒后，下一只普通加速盒到达角色的时间约为：

```text
移动盒碰撞宽 = (248 - 8) × 0.64 = 153.6
角色碰撞宽 = ((167 - 29) × 0.64) × 1.33 × 0.45 = 52.85952
出生中心距离 = 720 / 2 + 153.6 / 2 + 24 = 460.8
开始相交的中心距离 = (153.6 + 52.85952) / 2 = 103.22976
到相交时间 = (460.8 - 103.22976) / (2000 × 1.3)
           ≈ 137.53 ms < 150 ms
```

角色仍站在支撑上时 `tryLand()` 返回 false（`Game.ts:503–507`），护盾已消耗，下一次相交可直接进入 `fly()`。适当帧时序下，失败后仍有剩余 shake 帧。这属于静态代码与代数证明，未执行场景复现；不能将其表述为普通默认速度下必现，或 900 ms 全景 scroll/zoom 补偿错误。

**最小修复建议：** 仅在背景渲染侧剥离主相机 shake 分量，同时保留现有零 scroll 与逆 zoom 补偿，例如让背景专用 Transformer 使用不含 shake 的相机视图矩阵。不要为了固定背景而全局停止主相机震动，否则会改变既有世界/角色/UI 的镜头效果。当前拼接模型、计分及全景 tween 无需重写。

## 重点问题的判定依据（不列为缺陷）

**全景 scroll/zoom 补偿成立。** 实际 Image 默认节点为 `TransformerImage`（`renderNodes/defaults/DefaultImageNodes.js:9–14`），它先修正 scrollFactor，再乘容器矩阵与图像矩阵（`transformer/TransformerImage.js:151–168`）。在现有全屏、中心原点、无旋转相机下，令屏幕中心为 C、scroll 为 S、zoom 为 z：相机矩阵是 `T(C) · Scale(z) · T(-S-C)`；零 scrollFactor 加回 S 后，乘背景根容器 `T(C) · Scale(1/z)`，得到单位变换。因此忽略上述独立 shake 分量时，任意全景 scroll/zoom 都不会改变背景屏幕坐标。`Game.ts:1414–1418` 每次 tween 更新先写 camera，再同步背景逆缩放；snap 路径亦同步（1393–1403）。无需额外加上 camera.scroll，否则反而会引入位移。

**`frameTower` 保留容器正常。** `Game.ts:1375–1382` 的 keep 集合保留背景根容器。Phaser Container 默认 `exclusive = true`（`container/Container.js:117–134`），添加子图会将其从场景 display list 移除（431–446），因此遍历 `this.children.list` 不会误把四张背景子图隐藏。无需把子图另行加入 keep 集合。

**当前拼接没有几何/透明边缘黑洞证据。** 本地读取确认原城市图为 1152×2048 RGB、全不透明；新增三图均为 720×1280 RGBA，顶部 alpha 255、末行 alpha 0。模型使用 24% 重叠，中心 stride 为 `0.76 × panelHeight`，绘制高度另有 2 px bleed（`altitudeBackgroundModel.ts:44–48`；`altitudeBackground.ts:52–54`）。上片底部渐变区始终叠在下片不透明顶部区域上，非两个透明尾部互相覆盖；三图按城市→云层→大气→月球顺序绘制。`panelHeight >= viewportHeight`、`panelWidth >= viewportWidth`，且 offset 被限制在 0 到三段 stride，总条带覆盖视口。最终月球底部仍保留设计中的渐变叠接，不是空洞。

**进度与常规生命周期没有另一个已证实缺陷。** 进度来源是 `meters() → heightMeters`，不是角色或相机位置（`Game.ts:386–390, 1293–1296`）；模型限制为 0..100 米并指数平滑至终点（`altitudeBackgroundModel.ts:9–33`）。两条死亡入口均立即 freeze（`Game.ts:493–496, 703–704`），死亡不再更新背景进度；暂停不调用场景更新；全景/结算/隐藏也不推进进度。每次 create 都新建背景及进度实例（277–278），shutdown 销毁根容器及其 exclusive 子图（345–347；`altitudeBackground.ts:64–69`；`Container.js:1458–1464`），resize 监听在 shutdown 解绑（`layout.ts:17–23`）。结算隐藏仅改变 GameOver 遮罩/UI 的可见性，不恢复 Game 更新（`GameOver.ts:180–205`）。

## 结论

记录 1 项低优先级、现有调速/加速状态可达的残留 shake 冻结缺陷；未发现全景 scroll/zoom 矩阵、背景容器保留、24% 拼接覆盖、100 米终点或常规重开/销毁流程的其他有证据缺陷。建议只修背景受 shake 的影响，不重做背景系统或改动玩法/UI。
