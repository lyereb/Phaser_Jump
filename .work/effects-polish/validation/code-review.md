# Phaser 4.2.1 特效精修：只读代码审查

## 结论与范围

确认 **2 项低优先级、仅影响视觉的缺陷**；未发现本次 Game 改动越过视觉边界，或金币弧线 Tween、双重 shutdown、弹簧轨迹清理存在有证据的阻塞问题。建议只做下述局部修复，不改玩法规则。

审查文件为 `src/game/accentEffectsModel.ts`、`accentEffects.ts`、`itemEffects.ts`、`checkpoints.ts`、`src/game/scenes/Game.ts` 及 `.work/effects-polish/backups/Game.ts`。为核实坐标和 API，补读了现有金币 HUD 布局及本地安装的 Phaser 源码。`package.json:15` 与 `node_modules/phaser/package.json:3` 均确认版本为 **4.2.1**。

本次仅静态读取、Game 与备份的只读差异比较，以及轨迹公式数值核算；未编辑源码、启动服务或浏览器、初始化工程，也未重跑测试。以下不将运行时观感推断作为缺陷证据。

## 有证据的缺陷与最小修复

### 1. P3：金币起飞后发生窗口缩放，会飞向过期的 HUD 坐标

**证据：** `itemEffects.ts:273–276` 只在每枚金币开始弧线飞行时读取一次 `target()`；`291–292` 的贝塞尔终点及 `307` 的到达闪星都继续使用这个固定 `goal`，整个飞行持续 `380–520ms`（`285`）。与此同时，游戏已支持 resize：`Game.ts:384–396` 调用布局，`gameHud.ts:130–149` 随窗口尺寸重算 `uiScale` 并更新金币 HUD 的缩放。`coinHud.ts:93–98` 的图标中心包含这一缩放，因此目标坐标会改变。

**影响：** 如果 resize 发生在金币已起飞、尚未抵达的窗口内，金币和到达闪星仍停在旧图标位置，HUD 却在新位置执行 `pulse()`。起飞前重读目标的做法是正确的，但不能覆盖起飞后的这段现有 resize 流程；此问题不影响已入账的金币。

**最小修复：** 保留现有 `flightProgress` Tween 与控制点，在 `onUpdate` 中重读 `target()` 用作当前曲线终点，并在完成时用最新目标位置发出 `arrival()`。不要将 Tween 目标改成独立代理对象，也不要移动奖励入账逻辑或修改 Game 的 resize/计分流程。

### 2. P3：带重力的闪星尾线使用初始方向，落下后尾线朝向相反

**证据：** `accentEffectsModel.ts:18–20` 的位置采用指数衰减冲量加重力，其瞬时速度为：

```text
vx(t) = spark.vx * exp(-2.1 * t)
vy(t) = spark.vy * exp(-2.1 * t) + spark.gravity * t
```

弹簧闪星启用 `streak`，且带 `gravity = 180`（`39–48`）。但 `accentEffects.ts:79–82` 始终使用 `atan2(spark.vy, spark.vx)`，即初始发射方向，而不是上述当前速度。生成范围允许的示例 `vx=0, vy=-190, gravity=180, life=0.85s`，在仍存活的 `age=0.8s` 时，当前竖直速度约为 **+108.59 px/s**，已经向下；绘制仍按向上的初始角度计算，尾线因而伸到下降方向的前方。

**影响：** 弹簧闪星落下收尾阶段的短尾线与运动方向不一致；斜向加速闪星的尾线也会随重力偏离当前运动方向。这是局部自然感问题，不涉及碰撞或寿命泄漏。

**最小修复：** 仅将尾线角度改为根据衰减后、含重力的当前速度计算；保留现有长度、透明度、数量与寿命。无需改变粒子轨迹、添加对象或引入新 Tween。

## 重点风险核对结果

- **Game 视觉边界：** 与指定备份相比，完整差异只有两处：`Game.ts:793` 新增 `springTrail(...)` 视觉调用，`954` 将原加速提示 `toast(...)` 替换为 `speedGranted(...)`。未改动概率、奖励入账、碰撞、护盾消耗、加速次数或弹簧计分逻辑。
- **金币弧线销毁：** `itemEffects.ts:277` 的 `flight` 是原 `coin` 的类型断言，不是新对象；因此 `destroy():478–481` 的 `killTweensOf(object)` 能匹配它。金币自然完成会销毁（`300–302`），`track():464–469` 会移除记录。Phaser `Tween.hasTarget()` 按对象身份匹配（`node_modules/phaser/src/tweens/tween/Tween.js:271–274`），TweenManager 的 shutdown 会 `killAll()`（`TweenManager.js:1130–1137`）。没有“代理进度对象逃过清理”的缺陷。
- **金币初始坐标：** 当前正常拾取期间主相机 zoom 为 1（`Game.ts:273`）；`toScreen():444–451` 的减 scroll 坐标，与金币 `setScrollFactor(0)`（`398`）及独立金币 HUD 的坐标相容。未把本次正常拾取路径不存在的相机旋转/非单位缩放假设报成缺陷；实际 resize 终点问题见第 1 项。
- **双 shutdown 顺序：** AccentEffects 在构造时先注册自身 shutdown，随后 ItemEffects/Checkpoints 再注册各自清理（`accentEffects.ts:17`、`itemEffects.ts:80`、`checkpoints.ts:52`）。后者再次调用 `accents.destroy()`，但 `accentEffects.ts:94–95` 的幂等保护有效。若 Phaser DisplayList 先销毁 Graphics，`GameObject.destroy():1008–1012` 也会对已无 scene 的对象直接返回。不能据此认定二次销毁会抛错或残留。
- **弹簧轨迹清理：** `springTrail():186–190` 在 inactive 时清空绘图、隐藏并清空点列；点列上限为 12、纵向范围小于 155（`195`）。落地时 `Game.ts:1075` 清空 `springFlight`，同一轮外层更新的 `syncPlayerSprite()` 会传入 inactive；shutdown 也会销毁被 track 的 Graphics 并重置点列（`itemEffects.ts:478–489`）。未发现轨迹未清理缺陷。
- **数量、寿命与暂停：** 每个 AccentPool 的闪星上限 64、波纹上限 8、单次 burst 上限 20（`accentEffectsModel.ts:1,36,60–68`）；现有 burst 寿命为 `0.48–<0.86s`，mote 为 `0.24s`，现有波纹调用的寿命不超过 `0.56s`，均通过 age 到期剔除（`71–85`）。这些是**每池**上限，不能将 ItemEffects 世界池与屏幕池的合计误读为越界。AccentEffects 只随 scene update 推进，Phaser 暂停场景不执行该更新；现有恢复流程还调用 `Game.ts:680` 的 `getDelta(true)` 重同步 Tween 时钟。未发现暂停补播或关闭残留的静态证据。
- **Graphics API 真实性：** 本地 Phaser 4.2.1 `src/gameobjects/graphics/Graphics.js` 实际定义了本次使用的 `lineStyle`（301）、`fillStyle`（326）、`beginPath`（430）、`strokePath`（501）、`fillCircle`（572）、`strokeRoundedRect`（803）、`lineBetween`（1047）、`lineTo`（1070）、`moveTo`（1091）、`strokeEllipse`（1229）、`fillEllipse`（1274）、`arc`（1313）和 `clear`（1493）。圆弧前后也正确使用 begin/stroke；未发现虚构方法或参数形式不匹配。

## 限定说明

华丽程度、画面遮挡和多特效叠加时的最终观感未重新运行验证。本报告不对这些主观或运行时结果作“已通过”的断言，也不建议扩大特效规模、重写系统或追加本次任务之外的测试。
