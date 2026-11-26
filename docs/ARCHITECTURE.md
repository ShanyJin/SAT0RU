# 技术架构 · SAT0RU

单文件 Three.js 应用（`index.html`，约 2100 行）+ MediaPipe Hands 手部识别。
本文覆盖：数据流、识别管线、苍/赫状态机、环境尘埃、渲染性能、参数速查、已知限制。
改代码前先看 §去哪改，别凭感觉动阈值。

## 1. 数据流总览

```
摄像头 640×480 (MediaPipe Camera utils, onFrame ~30fps)
 └→ MediaPipe Hands (legacy Solutions, maxNumHands=2, complexity=1, minDet=0.7)
     └→ multiHandLandmarks（每手 21 点，归一化坐标）
         ├→ handShape(lm)          21 点 → 几何特征（伸指/张开/捏合/拇指外张…）
         ├→ computeHandScores()    每手 → 各技法 0/1 分（16 技法表）
         ├→ computeFrameScores()   双手 → 组合技法 + 五条悟模式互斥/桥接/冷却
         ├→ smoothScores()         每技法 EMA α=0.20
         ├→ pickGestureFromScores() 进入 0.75 / 保持 0.50 / 切换领先 0.12 或持续 300ms
         └→ updateState(tech)      设定目标形状/配色/pill 名称/bloom 强度
              └→ animate() 每帧：主粒子场 20k lerp、光球 4k、尘埃 1.2k、爆炸、震动
                   └→ EffectComposer(RenderPass → UnrealBloomPass) → #three-canvas
```

`#three-canvas` 用 `mix-blend-mode: screen` 叠在镜像摄像头画面（`.input_video`，CSS `scaleX(-1)`）上，
所以粒子像直接长在房间里。MediaPipe 骨架 `#output_canvas` 同样镜像，只在 D 调试模式可见。

## 2. 模式与 URL 参数

| 参数 | 作用 |
|---|---|
| 无 | 默认 `MODE='gojo'`：只启用 `GOJO_GESTURES = ['blue','red']`（苍/赫），其余技法不接手势 |
| `?mode=all` | 恢复全套 15 技法（`SCORE_GESTURES` + 语音），指南同步切换 `GUIDE_ALL` |
| `?tech=<id>` | 锁定单技法演出、跳过识别（录制素材用）。id 见 README |
| `?logictest=1` | 加载无摄像头回归驱动（仅 `logic-test.html` 有） |
| `?logictest=1&end=charge\|blue\|red` | 视觉演示：构筑态 / 释放蓝场 / 赫红场 |

按键：`D` 调试面板、`M` 音乐、`H` 指南、`V` 语音、`T` 轮换、`N` 回识别、`K` 按键表、`C` 纯净模式、`O` 开场页。
`T/N` 手动预览不触发冷却；冷却只在真实手势触发的 `commitTransition()` 里起算。

## 3. 识别管线

### 3.1 坐标映射 `handPointToWorld(nx, ny)`

MediaPipe 归一化坐标 → three.js 世界坐标（z=0 平面）：

- 源画面 `object-fit: cover` 会裁掉一部分：先算可见源矩形 `visW/visH`（用视频分辨率与窗口尺寸），
  把点裁到可见区再归一化。
- 画面镜像：world 的 x 用 `(1 - 2*sx)`，让粒子和用户看到的镜像手一致。
- `halfH = tan(fov/2) * camera.z`（fov 75°，z=55）≈ **42.2 世界单位**；`halfW = halfH * aspect`。
- 尺度经验值：约 **1 世界单位 ≈ 1.1cm**（以手掌尺寸标定，非精确）。

### 3.2 `handShape(lm)` 几何特征

| 字段 | 定义 | 用途 |
|---|---|---|
| `indexUp/middleUp/ringUp/pinkyUp/thumbUp` | 指尖 y < PIP y | 单指/枪形/组合判定 |
| `fourUp/fourDown` | 四指全伸/全收 | 张开/握拳类技法 |
| `pinchScore` | 拇指-食指距离 < 0.04 | 虚式「茈」 |
| `fingerGap` | 食指-中指指尖距离 | 四指并拢 vs 张开；枪形要求 < 0.065 |
| `thumbOut` | 拇指尖离手腕 > 0.25 | 平掌+拇指技法 |
| `thumbGapRatio` | 拇指尖→食指 MCP 距离 ÷ 掌长（腕→中指 MCP） | **枪形**要求 > 0.75（区分拇指外张 vs 压在掌心） |
| `handAngle` | 腕→中指 MCP 的倾角 | 备用 |
| `isOpen` / `isFist` | 四指指尖-腕距离 > PIP×1.12 / < ×0.92 | 苍的时序手势（不依赖手掌朝向） |

### 3.3 `computeHandScores()` → `computeFrameScores()`

- 每手 0/1 分表；捏合（pinch）会 0.45× 抑制相关姿态（保「茈」可靠）。
- 五条悟模式（`MODE==='gojo'`，`computeFrameScores` 内）：
  - **赫**：`indexUp=1 且中/无名/小指全收`，**或枪形** `indexUp+middleUp=1、ring/pinky=0、fingerGap<0.065、thumbGapRatio>0.75`。
    任一手满足即 `frameScores.red=1`，并记 `redFormSeen=true`。
  - **苍**：`updateBlueSequences()` 时序状态机（见 §4.1），完成后 `armBlueCharge()`。手别 key 用 handedness，
    标签翻转按 0.30 邻域重捕获（清速度历史与腕旋基准）。
  - **互斥**：`blueCharge` 存在 → `resetBlueHandStates()`；`gojoLocked`（释放锁）或 `techCoolingDown` 或
    `redFormSeen` 或已处于 red → 清零苍时序。`currentTech==='red'` 时若本帧无赫形态且距 `lastRedSeenMs` < 350ms
    仍补 1 分（丢手桥接）；无手帧早退前也有同样桥接。
  - 反向：非 red 状态下 `blueCharge || gojoLocked || techCoolingDown` 时赫分强制 0。

### 3.4 平滑与裁决（`TUNING`）

- EMA：`smoothed = smoothed + (raw - smoothed) * 0.20`，每帧每技法。
- 进入需要 smoothed ≥ **0.75**；当前技法保持只要 ≥ **0.50**。
- 切换挑战者需领先 **0.12**（立即）或持续领先 ≥0.03 达 **300ms**（定时路径）。
- 裁决结果进入 `updateState()`；`purple` 有额外的 flick 退出窗口逻辑（all 模式用）。

### 3.5 冷却与锁定

- `commitTransition(next, now)`：进入任何非 `neutral`/`flick` 的技法 → `techCooldownUntilMs = now + 8000`。
- 苍释放后还有自己的锁定：演出 2.5s（`BLUE_SEQ.animMs`）+ 触发锁 2.5s（`cooldownMs`），期间手势全忽略。
- 赫激活期间不受冷却影响（持续），但冷却期内不能再触发苍/赫。

## 4. 「蒼」引力 · 构筑态

### 4.1 时序手势（`updateBlueSequences`）

单手或双手各自独立：**张开 ≥3 帧 → 握拳 ≥2 帧 → 再张开 ≥3 帧**，每段间隔 ≤`stageWindowMs 1200ms`，
手短暂丢失有 `handGraceMs 500` 宽限。先完成的手成为锚（返回 hand key）。
任一帧出现赫形态（`redFormSeen`）立即清零——做枪形时「张开→收指→张开」不会被误读。

### 4.2 `blueCharge` 数据

`{ key, x, y, size, prevSize, growSamples, growStartMs, growStartSize, startedMs, lastSeenMs, ... }`，
`armBlueCharge()` 建立，`releaseBlueCharge()` 销毁。
构筑中 pill 显示 `術式順転「蒼」 · 構築中`；`CHARGE.maxChargeMs = 30000` 安全阀。

### 4.3 构筑视觉（`chargeOrb`，4000 点）

独立 `THREE.Points`（不是主粒子场），材质 `PointsMaterial`（size 全局、additive、opacity 0.95）。
`ORB_RINGS` 三条不同倾角环带（scale 1.0 / 0.82 / 1.22，spin +2.6 / +1.7 / −2.1，一条反向），
弧段留空隙（`ORB_ARC_BASE`）；另有亮核 12%、体积雾 33%。

半径每帧：

```js
grow    = min(1, ageMs / CHARGE.growMs)                    // 2000ms：手心小球 → 大状态
breathe = 1 + 0.16*sin(0.0016t) + 0.07*sin(0.0037t + 1.3)  // 双频呼吸
radius  = (2.4 + 6.6*grow) * breathe + 0.22*sin(0.005t)     // 直径约 15~25cm
```

`fillOrbPositions(nowSec, radius, path, cx, cy)` 每帧重算全部 4000 点：
环带整环刚性旋转（`theta = theta0 + nowSec*spin + orbSpinPhase`，同环同相位不剪切）；
核/雾按 phi/theta 球面分布 + wobble。外层粒子按 `orbPathHistory`（最近 320ms 路径，`pathMs`）采样拖尾，
越外层拖得越旧（offset clamp ≤10 个样本）→ 真正的运动拖尾。

### 4.4 跟手

- `chargeVisual`：对 `handPointToWorld(blueCharge.x,y)` 做阻尼跟随，时间常数 `CHARGE.followTauMs = 90ms`
  （拖动时球拖在手掌后，停下追上）。
- `orbSpinPhase`：用腕部朝向（lm0→lm9 角度）差分累加，乘 1.6；因为画面镜像，取负号。
  球整体绕自身轴加减旋转，环带相位全体共享。
- 尘埃（§5）围绕 `chargeVisual` 旋转并随它移动。

### 4.5 释放触发（`releaseBlueCharge`）

**只认持续前推**（手掌朝镜头方向靠近 = 掌尺寸增长），不再把横向手速当释放信号：

| 途径 | 条件 |
|---|---|
| 前推 | 掌尺寸连续增长 ≥ `pushMinSamples 3` 个采样且持续 ≥ `pushMinMs 110`，累计增幅 ≥ `pushMinGrowth 0.24`，平均增速 ≥ `pushMinRate 1.7`/s；某采样增幅 < `growTolerance 0.002` 立即断链 |
| 合掌 | 两掌心距 < `palmGap 0.13`，持续 `palmGapFrames 2` |
| 出手 | 掌心越出画面边距 `outMargin 0.10`，持续 `outFrames 2` |
| 丢追踪 | `lostMs 1000` |
| 安全阀 | `maxChargeMs 30000` |

连续增长链是关键：单帧关键点跳变（手指/手型变化）会在下一样本因不再增长而断链，绝不可能凑满
3 个采样 + 110ms。慢速平移、横向快挥、转腕、指赫都只让球跟手，不释放。参数全在 `CHARGE.*`。

释放即：`chargeOrb` 消失、主粒子场在**屏幕中央**绽放（`BLUE_SEQ.animMs = 2500ms`，见 §6 爆炸），
尘埃层同步炸开（§5），随后 2.5s 触发锁 + 8s 全局冷却。

## 5. 「赫」排斥 · 红场

### 5.1 手势与锚点

| 形态 | 判定 | 锚点 |
|---|---|---|
| 食指向上指 | `indexUp=1` 且其余三指收拢 | 食指指尖（lm8）沿指方向外推 |
| 枪形 | `indexUp+middleUp=1`、无名/小指收拢、`fingerGap<0.065`、`thumbGapRatio>0.75` | lm8/lm12 中点沿两指方向外推 |

外推距离 `min(9, max(3, 指节长*0.9))` 世界单位 ≈ **5~10cm**（即红点悬在指尖外一点）。
两形态切换或短暂丢手（<350ms）由 `lastRedSeenMs` 桥接，不断档。

### 5.2 跟随与渲染

- `redAnchor` → `redFollow`（阻尼 110ms）；每帧 `particles.position.set(redFollow.x, redFollow.y, 0)`，
  整个 20k 主粒子场（`getRed()` 目标形状）平移到手上。
- 红场展开时 `particles.rotation.z -= 0.1`/帧（持续旋转感）。
- 退场：无手后 `redFollow` 缓回屏幕中央淡出（`updateState` neutral 目标全零）。
- 苍构筑/释放期间赫分被清零（§3.3），两者不互相打断。

## 6. 主粒子场与爆炸

- `COUNT = 20000`；`targetPositions/targetColors/targetSizes` 每帧由当前技法函数生成
  （`getShrine/getPurple/getVoid/.../getRed/getBlue...`），现场 `lerp 0.1` 追随 → 形状渐变过渡。
- `PointsMaterial`：size 全局（attribute 不生效），additive，`mix-blend-mode: screen` 合成。
- **爆炸**（紫/蓝共用）：`purpleExplosionUntilMs` 期间每点从形状位置向外飞 `purpleExplosionMaxDistance 100`
  × 个体差异 0.84~1.12，颜色固定爆炸色，bloom 临时 +3（`purpleExplosionBloomBoost`），
  画面震动（renderer canvas transform 随机位移）。
- 爆炸结束后 `postExplosionNeutralMs 1000` 强制 neutral。

## 7. 环境尘埃（待机粒子 + 引/斥力）

独立 `THREE.Points`：`DUST_COUNT = 1200`，灰蓝暗点（亮度 0.10~0.28 冷色），size 0.34，additive。
**常驻可见**——这就是「待机粒子」；主粒子场待机仍隐藏，所以待机开销只有这 1200 点。

每颗粒子种子：`bx/by/bz`（基准位置，横向 ±56 / 纵向 ±39 / z ±13）、`driftPhase/Speed/Amp`、
`orbitR(9~17)`、`orbitSpeed(±0.5~1.4)`、`orbitPhase`、`tau(0.18~0.48s)`（个体跟随阻尼）。

每帧目标（`animate()` dust 块）：

| 状态 | 目标 |
|---|---|
| 待机 | 基准位置 + 正弦慢漂（两轴不同频率） |
| **苍构筑（引力）** | 绕 `chargeVisual` 的轨道：`半径 = orbitR × shrink`，`shrink = 0.75 + 0.25×min(1, ageSec/1.2)`；角度 `orbitPhase + t×orbitSpeed + orbSpinPhase×0.7` —— 尘埃被吸过来、螺旋收拢、随腕旋、跟手 |
| **赫展开（斥力）** | 以 `redFollow` 为心、半径 `30 ± 2.5`（按 orbitPhase 抖动出毛边）的斥力泡：泡内尘埃推到泡壁 → 红场周围一圈净空 |
| 苍释放 | 2.5s 内所有尘埃炸向径向远处（70 单位），随后自然漂回 |

位置更新逐粒子指数阻尼 `k = 1 - exp(-dt/tau)`（dt 封顶 0.1s），因此切换状态、跟手、回位都是平滑衔接。
透明度：待机 0.65 / 引力 0.85 / 爆炸 0.9。

## 8. 渲染与性能

- 渲染器：`setPixelRatio(min(devicePixelRatio, 1.5))`，`EffectComposer` + `RenderPass` +
  `UnrealBloomPass(res, strength=1.5 基础, radius=0.4, threshold=0.85)`；每技法有 `baseBloomStrength`
  （blue 3.0、red 2.5、purple 4.0、shrine 2.5、blackflash 5.0…），爆炸期间临时加。
- **`fieldIdle`**：`currentTech==='neutral' && now > neutralSettledAtMs && 无紫爆炸`
  → 主粒子场 `particles.visible=false`，且跳过 20k 的 lerp/上传/旋转/爆炸计算。
  `neutralSettledAtMs = now + 700`（进入 neutral 后留 700ms 淡出时间）。**这是最大的性能闸门**。
- fps 表：每 500ms 统计，D 面板 `fps` 行；低于 ~30 说明 GPU 吃紧（核显或浏览器退软渲）。
- 软件渲染（llvmpipe）实测只有 1~3fps——验收时可以截图、可以看逻辑，但不能以帧率论成败。

## 9. 界面层

- Win11 石墨 Acrylic（规范见 navi `skills/web-design.md`）：毛玻璃顶栏、暖金 `#D8A657` 强调、噪点纹理。
- 顶部 pill = 当前技法**原版名**（`updateState`）：通常状態 / 術式順転「蒼」/ 術式反転「赫」/ 虚式「茈」/
  領域展開「伏魔御廚子」「無量空処」「嵌合暗翳庭」「坐殺博徒」「真贋相愛」「誅伏賜死」「時胞月宮殿」「自閉円頓裹」/
  黒閃 / 無為転変 / 十劃呪法「比率」/ 八握剣異戒神将魔虚羅。
- 左侧手势指南 `GUIDE_GOJO` / `GUIDE_ALL`；`C` 纯净模式全部隐藏；`D` 面板显示 raw/smoothed 分数、
  `fps`、`charge`、`blueStages`、`bluePulse`、`gestureLock`、`cooldown`。
- 语音（all 模式）：Web Speech API，`"don't move"` → 誅伏賜死，`"run away"` → 镜头拉远
  （`zoomUntilMs`，camera.z 55→120）。Firefox 不支持；Google 在线识别国内可能不通。

## 10. 参数速查（改之前先读注释）

| 位置（grep 锚点） | 参数 | 现值 | 说明 |
|---|---|---|---|
| `const COUNT` | 主粒子数 | 20000 | 全技法共用 |
| `const ORB_COUNT` | 构筑球粒子数 | 4000 | 12% 核 / 55% 环 / 33% 雾 |
| `const DUST_COUNT` | 尘埃数 | 1200 | 待机常驻 |
| `TUNING.smoothingAlpha` | EMA | 0.20 | 大=跟手快、抖 |
| `TUNING.enterThreshold` | 进入阈值 | 0.75 | |
| `TUNING.exitThreshold` | 保持阈值 | 0.50 | |
| `TUNING.switchMargin` | 立即切换领先 | 0.12 | |
| `TUNING.sustainedSwitchMs` | 定时切换 | 300ms | 领先只需 0.03 |
| `BLUE_SEQ.stageWindowMs` | 苍时序段间隔 | 1200ms | 每段内完成 |
| `BLUE_SEQ.openFrames/fistFrames` | 苍帧数 | 3/2 | 帧 ≈ 33ms |
| `BLUE_SEQ.animMs/cooldownMs` | 释放演出/锁 | 2500/2500ms | |
| `CHARGE.*` | 释放判定 | 见 §4.5 | 灵敏度都在这里 |
| `CHARGE.pushMinGrowth / pushMinRate` | 前推闸门 | 0.24 / 1.7/s | 累计掌尺寸增幅 / 平均增速 |
| `CHARGE.pushMinMs / pushMinSamples` | 前推持续 | 110ms / 3 采样 | 滤掉单帧/两帧关键点跳变 |
| `CHARGE.growMs` | 球展开时长 | 2000ms | 越快越大越快 |
| `CHARGE.followTauMs` | 跟手阻尼 | 90ms | 大=拖尾更重 |
| `CHARGE.pathMs` | 拖尾路径 | 320ms | |
| `TECH_COOLDOWN_MS` | 全局冷却 | 8000ms | 任何术式触发后 |
| 枪形阈值 | `fingerGap<0.065` `thumbGapRatio>0.75` | `computeFrameScores` 内 | |
| 红点外推 | `min(9, max(3, 指节长*0.9))` | | ≈5~10cm |
| 斥力泡半径 | `30 ± 2.5` | dust 块内 | |
| 尘埃轨道半径 | `orbitR 9~17` × shrink 0.75~1 | 种子生成处 | |
| 尘埃阻尼 | `tau 0.18~0.48s` | 种子生成处 | |

## 11. 已知限制与升级路径

- **MediaPipe Hands (legacy)** 是 2D 关键点逐帧检测：极端光照、逆光、手太远仍会丢；丢手由桥接/冷却兜底。
  升级路径：MediaPipe Tasks `HandLandmarker`（新模型、世界坐标、时序更稳）——替换 `hands` 初始化与
  `onResults` 即可，`computeHandScores` 之后不动。
- 「前推」只能用 2D 掌尺寸增速做代理（无深度）。单帧/两帧关键点跳变已由连续增长链过滤；
  极低帧率或逆光导致关键点反复抖动时，增长链可能被频繁打断（表现为难释放，而不是误释放）→ 调 `CHARGE.*`。
  横向挥手永远不释放，这是刻意设计。
- screen 混合叠在摄像头上：画面极亮（对着窗户）粒子会偏淡，属预期；可降曝光或加 bloom。
- 无摄像头/拒绝授权时 MediaPipe 弹 "Failed to acquire camera"，**模态框会卡住页面 JS**——自动化验收必须
  覆写 `window.alert`（测试页已做）。
- 语音依赖浏览器 Web Speech API。
- `logic-test.html` 是生成物，不入库；改了 `index.html` 之后必须重新生成。

## 12. 关键函数索引（`index.html`）

| 函数 | 职责 |
|---|---|
| `handPointToWorld` | 归一化坐标 → 世界坐标（镜像+cover 裁剪） |
| `handShape` | 21 点 → 几何特征 |
| `computeHandScores` | 单手 → 技法分 |
| `computeFrameScores` | 双手 → 组合技法 + 五条悟互斥/桥接 |
| `smoothScores` / `pickGestureFromScores` | EMA + 进入/保持/切换裁决 |
| `commitTransition` | 切换时起算 8s 冷却 |
| `updateState` | 技法 → pill 名/配色/bloom/目标状态；neutral 700ms 后触发 fieldIdle |
| `updateBlueSequences` / `armBlueCharge` / `releaseBlueCharge` | 苍：时序 → 构筑 → 释放 |
| `fillOrbPositions` | 每帧重算 4000 点构筑球 |
| `animate` | 每帧主循环：fps、主粒子场、构筑球、**尘埃**、爆炸、震动、合成器 |
| `getRed` 等 `get*` | 各技法的 20k 目标形状函数（all 模式 15 个） |