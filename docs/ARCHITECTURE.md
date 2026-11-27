# 技术架构 · SAT0RU

单文件 Three.js 应用（`index.html`，约 2100 行）+ MediaPipe Hands 手部识别。
本文覆盖：数据流、识别管线、苍/赫状态机、茈投射模式与双手契印、無量空処（含长时间版）、本地语音与音频库、环境尘埃、渲染性能、参数速查、已知限制。
改代码前先看 §去哪改，别凭感觉动阈值。

## 1. 数据流总览

```
摄像头 640×480 (MediaPipe Camera utils, onFrame ~30fps)
 └→ MediaPipe Hands (legacy Solutions, maxNumHands=2, complexity=1, minDet=0.7)
     └→ multiHandLandmarks（每手 21 点，归一化坐标）
         ├→ handShape(lm)          21 点 → 几何特征（伸指/张开/捏合/拇指外张…）
         ├→ computeHandScores()    每手 → 各技法 0/1 分
         ├→ computeFrameScores()   双手 → 组合技法 + 五条悟模式互斥/桥接/冷却
         ├→ smoothScores()         每技法 EMA α=0.20
         ├→ pickGestureFromScores() 进入 0.75 / 保持 0.50 / 切换领先 0.12 或持续 300ms
         └→ updateState(tech)      设定目标形状/配色/顶部状态名/bloom 强度
              └→ animate() 每帧：主粒子场 20k lerp、光球 4k、尘埃 1.2k、爆炸、震动
                   └→ EffectComposer(RenderPass → UnrealBloomPass) → #three-canvas
```

`#three-canvas` 用 `mix-blend-mode: screen` 叠在镜像摄像头画面（`.input_video`，CSS `scaleX(-1)`）上，
所以粒子像直接长在房间里。MediaPipe 骨架 `#output_canvas` 同样镜像，只在 D 调试模式可见。

## 2. 模式与 URL 参数

| 参数 | 作用 |
|---|---|
| 无 | `MODE` 固定 `'gojo'`：只保留本作的苍 / 赫 / 無量空処（+ 茈按钮模式与双手契印、flick 尾巴） |
| `?tech=<id>` | 锁定单技法演出、跳过识别（录制素材用）。可用 id：`neutral void purple red blue flick` |
| `?logictest=1` | 加载无摄像头回归驱动（仅 `logic-test.html` 有） |
| `?logictest=1&end=charge\|blue\|red\|redcast\|redburn\|purplecharge\|purpleburst\|void\|voidform\|voidring\|voidclear\|voidlong\|claspblue\|claspred\|claspconverge\|claspvortex\|claspclash\|claspburst` | 视觉演示：构筑态 / 释放蓝场 / 赫红场 / 赫激发射出（可加 `&age=<ms>` 冻结相位，默认 170）/ 赫原地燃尽（同 `&age=`，默认 200）/ 茈蓄势 / 茈爆炸 / 無量空処 / 开场成型中 / 换环中 / 黑幕淡出后（只剩环）/ 长版换环中 / 契印蓝球 / 蓝红对称 / 靠拢 / 星系漩涡 / 碰撞 / 爆发（`&noui=1` 隐藏侧栏） |

按键：`D` 调试面板、`H` 指南分区、`V` 语音、`L` 长时间无量空处、`N` 回识别模式（音乐 / 按键表 / 纯净模式 / 技法轮换 / 独立开场页已删）。
`N` 手动预览不触发冷却；冷却只在真实手势触发的 `commitTransition()` 里起算。

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
| `fingerGap` | 食指-中指指尖距离 | 四指并拢 vs 张开；枪形 < 0.065；無量空処 < 0.075 |
| `thumbOut` | 拇指尖离手腕 > 0.25 | 平掌+拇指技法 |
| `thumbGapRatio` | 拇指尖→食指 MCP 距离 ÷ 掌长（腕→中指 MCP） | **枪形/赫** > 0.75（拇指外张）；**無量空処** < 0.75（拇指内扣）；茈的拇指外弹也看这个值的跳变 |
| `handAngle` | 腕→中指 MCP 的倾角 | 备用 |
| `isOpen` / `isFist` | 四指指尖-腕距离 > PIP×1.12 / < ×0.92 | 仓的持掌判定（不依赖手掌朝向；握拳/收手会打断计时） |
| `straightFinger(tip)` | 四指链条伸展比 ≥0.90 且 PIP/DIP 关节 cos < -0.75（≈ 弯曲 <41°） | `isOpen` 现在要求四指**真的伸直**：弯着手指（哪怕指尖离腕很远）不算张开，不会再误武装苍 |

### 3.3 `computeHandScores()` → `computeFrameScores()`

- 每手 0/1 分表；捏合（pinch）会 0.45× 抑制相关姿态（保「茈」可靠）。
- 五条悟模式（`MODE==='gojo'`，`computeFrameScores` 内）：
  - **赫**：`indexUp=1 且中/无名/小指全收`，**或枪形** `indexUp+middleUp=1、ring/pinky=0、fingerGap<0.065、thumbGapRatio>0.75`。
    任一手满足即 `frameScores.red=1`，并记 `redFormSeen=true`。
  - **無量空処**：`indexUp+middleUp=1、ring/pinky=0、fingerGap<0.075、thumbGapRatio<0.75`。
    与赫枪形是同一对伸出的手指，靠拇指外张/内扣区分（见 §7）；任一手满足即 `frameScores.void=1`。
  - **苍**：`updateBlueSequences()` 持掌状态机（见 §4.1），完成后 `armBlueCharge()`。手别 key 用 handedness，
    标签翻转按 0.30 邻域重捕获（清速度历史与腕旋基准）。
  - **互斥**：`gojoLocked`（释放锁）或 `techCoolingDown` 或 `redFormSeen` 或已处于 red → 清零苍时序。
    `currentTech==='red'` 时若本帧无赫形态且距 `lastRedSeenMs` < 350ms
    仍补 1 分（丢手桥接）；无手帧早退前也有同样桥接。`blueCharge` 存在时 `resetBlueHandStates()`。
  - 反向：非 red 状态下 `blueCharge || gojoLocked || techCoolingDown` 时赫分强制 0；非 void 状态下同样的
    条件把 void 分强制 0（蓄势/释放锁/2s 冷却期间不能新开领域，但已展开的领域可继续持有）。
  - **双手契印互斥**：`claspPoseInfo()` 命中（双手食指朝上 + 至少一只手中指朝上 + 双拇指内扣 + 腕距/食指尖距
    都在阈值内）时，void/red/blue 分清零、苍时序清零；契印启动后整段动画旁路所有手势（见 §5.4）。

### 3.4 平滑与裁决（`TUNING`）

- EMA：`smoothed = smoothed + (raw - smoothed) * 0.20`，每帧每技法。
- 进入需要 smoothed ≥ **0.75**；当前技法保持只要 ≥ **0.50**。
- 切换挑战者需领先 **0.12**（立即）或持续领先 ≥0.03 达 **300ms**（定时路径）。
- 裁决结果进入 `updateState()`；`purple` 有额外的 flick 退出窗口逻辑（茈发射尾巴用）。

### 3.5 冷却与锁定

- `commitTransition(next, now)`：进入任何非 `neutral`/`flick` 的技法 → `techCooldownUntilMs = now + 2000`。
- 苍释放后还有自己的锁定：演出 2.5s（`BLUE_SEQ.animMs`）+ 触发锁 2s（`cooldownMs`），期间手势全忽略。
- 赫激活期间不受冷却影响（持续），但冷却期内不能再触发苍/赫。

## 4. 「蒼」引力 · 构筑态

### 4.1 持掌手势（`updateBlueSequences`）

单手或双手各自独立：**四指完全伸直的张开手掌对着镜头，连续保持 `BLUE_SEQ.holdMs = 2000ms`**（前 3 帧
`isOpen` 才开始计时，中途握拳或收手即清零）。手短暂丢失有 `handGraceMs 500` 宽限。先完成的手成为锚（返回 hand key）。
任一帧出现赫形态（`redFormSeen`）立即清零——做枪形时手型过渡不会被误读。
握拳会打断持掌计时，所以「张开→快速握拳」不会误武装苍。

`isOpen` 现在要求**四指伸直**：`handShape()` 里除了「指尖离腕 > PIP×1.12」，还要每根手指满足
`straightFinger(tip)` —— MCP→TIP 弦长 ≥ 三段指节链长的 0.90，且 PIP、DIP 两处关节夹角余弦 < -0.75
（弯曲 <41°）。以前只看指尖到腕的距离，手指半弯、指尖仍离腕远时也会算张开；现在弯着手指保持再久
也不会武装苍（回归 `bent fingers do not arm blue/stay neutral` 锁死）。

### 4.2 `blueCharge` 数据

`{ key, x, y, size, prevSize, growSamples, growStartMs, growStartSize, startedMs, lastSeenMs, ... }`，
`armBlueCharge()` 建立，`releaseBlueCharge()` 销毁。
构筑中顶部状态显示 `術式順転「蒼」 · 構築中`；`CHARGE.maxChargeMs = 30000` 安全阀。
苍语音绑定 `blueCharge.startedMs`：构筑成型后再等 `BLUE_SEQ.voiceDelayMs = 2000ms` 才播一次，
提前释放/取消则不播（见 §11.1）。

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
- 尘埃（§9）围绕 `chargeVisual` 旋转并随它移动。

### 4.5 释放触发（`releaseBlueCharge`）

**只认持续前推**（手掌朝镜头方向靠近 = 掌尺寸增长），不再把横向手速当释放信号：

| 途径 | 条件 |
|---|---|
| 前推 | 掌尺寸连续增长 ≥ `pushMinSamples 3` 个采样且持续 ≥ `pushMinMs 110`，累计增幅 ≥ `pushMinGrowth 0.24`，平均增速 ≥ `pushMinRate 1.7`/s；某采样增幅 < `growTolerance 0.002` 立即断链 |
| 握拳 | 连续 `fistFrames 2` 帧 `handShape().isFist`（单帧关键点抖动不算） |
| 甩出 | 逐帧位移速度 ≥ `flingMinSpeed 1.4` 屏宽/秒、连成 `flingRunFrames 2` 步、累计 ≥ `flingMinDisplacement 0.08`；两次采样间隔 > `flingMaxSampleGapMs 120` 即视为断点清零 |
| 合掌 | 两掌心距 < `palmGap 0.13`，持续 `palmGapFrames 2` |
| 出手 | 掌心越出画面边距 `outMargin 0.10`，持续 `outFrames 2` |
| 丢追踪 | `lostMs 1000` |
| 安全阀 | `maxChargeMs 30000` |

连续增长链是关键：单帧关键点跳变（手指/手型变化）会在下一样本因不再增长而断链，绝不可能凑满
3 个采样 + 110ms。慢速平移、横向快挥、转腕、指赫都只让球跟手，不释放。参数全在 `CHARGE.*`。

**甩出为什么按「逐帧步长」而不是「窗口平均」**：早期实现取 `path` 里最老的样本（最多 200ms 前）
做平均速度，长按静止的那段历史会把一次真实甩出的均速摊薄到 0.6/s 左右，永远到不了 1.4 —— 表现为
「甩了不放」。现在比较**最新一步**（与上一个采样点），连续快帧计数 + 累计位移；静止帧会把连击清零，
所以「慢慢横移 + 突然甩一下」能稳定触发，而手在画面里缓慢漂移不会。

释放即：`chargeOrb` 消失、主粒子场在**屏幕中央**绽放（`BLUE_SEQ.animMs = 2500ms`，见 §8 爆炸），
尘埃层同步炸开（§9），随后 2.5s 演出 + 2s 触发锁/全局冷却。

## 5. 虚式「茈」· 投射模式（右上角按钮）

### 5.1 交互模型

右上角 `#purple-mode-btn`（「茈」）是**模式开关，不是施法按钮**。点击开启后：

- 苍/赫全部暂停：`computeFrameScores` 在 `purpleMode` 时把 blue/red 分归零，枪形不再触发赫；
- 枪形（`fingerGap<0.065`、`thumbGapRatio>0.75`）、捏合（`pinchScore=1`）或拇指内扣的待发姿势**连续 8 帧且持续 ≥220ms**
  （`poseHoldFrames/poseHoldMs`；旧的 3 帧太容易误触）→ 构筑紫色小球；
- 小球跟随手部（阻尼 90ms）；松手或姿势丢失通常 280ms 取消；拇指内扣后进入「待发」，
  宽限升到 500ms（`PURPLE_CAST.readyGraceMs`），因为快速弹指常会丢 1~3 帧追踪；
- 小球出现后 **260ms**（`PURPLE_CAST.armMs`）内，任何推力/弹指/上挑都不算发射——抬手、内扣拇指这些
  「摆姿势」的动作本身不会走火；
- 前推用**紫色自己的更严阈值**（`PURPLE_CAST.pushMinSamples 4 / pushMinMs 130 / pushMinGrowth 0.28 /
  pushMinRate 2.0`，经 `updatePushTracker(t, size, nowMs, cfg)` 传入；苍仍用 `CHARGE.*`）或**拇指外弹** → 发射。
  拇指外弹不依赖食指指尖位移：从拇指内扣帧记录 `thumbUnderAtMs/thumbUnderRatio`，500ms 内
  `thumbGapRatio` 跳升 ≥0.15（`snapJump`）且回到外张枪形就发射，丢帧后重现也算；
  旧的指尖上挑 FLICK（`FLICK.triggerScore`）仍保留为第二条路径；
- 飞行 380ms 到世界 `(0,0,0)`（屏幕正中心），命中后从中心点爆开；
- 释放后 **2 秒**冷却；按钮外圈 conic-gradient 显示剩余冷却（`updatePurpleButton`）；
  开/关切换会取消当前蓄势与飞行。

### 5.2 状态与关键代码

- `purpleMode`、`setPurpleMode()`：模式开关、`aria-pressed`、按钮 `active/cooling`。
- `purpleCharge`：`{ key, x, y, size, startedMs, lastSeenMs, poseSeenMs, prevSize, growSamples,
  thumbUnderAtMs, thumbUnderRatio, ... }`；`createPurpleCharge` / `cancelPurpleCharge` / `updatePurpleMode`。
- `purpleShot`：`{ startX, startY, startMs, durationMs }`；`firePurpleCharge` 记录起点并设 2s 冷却，
  `impactPurpleShot` 在 `(0,0,0)` 触发 `forceTechnique('purple', 1600ms)` 与点爆炸。
- 蓄势锚点 `purpleWorldAnchor()`：捏合点或双指尖中点，沿腕→指尖方向外推 2.0 / 3.5 世界单位。
- 视觉：独立 `THREE.Points` `purpleOrb`（`PURPLE_ORB_COUNT = 700`，8% 核 / 58% 环 / 34% 雾）。
  蓄势半径 `(0.5 + 0.7*grow)*breathe`（700ms 展开 + 双频呼吸）；飞行时从起点加速到中心并缩到 60%；
  只有雾层沿 `purplePath`（260ms）拖尾。紫色爆炸复用主粒子场，源位置写 `0.0001` 以避免目标形状回退，
  从中心点向四周炸开；尘埃层在爆炸期间同步径向炸开。
- 茈模式待机时 `baseBloomStrength = 0.35`；命中后 `updateState('purple')` 把 base 提到 4.0，爆炸结束回 neutral。

### 5.3 与既有技法的边界

- 茈模式开启时：`bluePulse`、苍蓄势、赫枪形/红场/评分全部旁路；**双手契印也只在这个开关下成立**；关闭后恢复普通管线。
- 2s 冷却同时写 `purpleCooldownUntilMs` 与 `techCooldownUntilMs`，所以茈之后也不能立刻苍/赫。
- 拇指外弹只在**已有蓄势**且最近一次姿势是拇指内扣时算发射；拇指一直外张的枪形不会被当成弹指。
- 無量空処的手势同样是「两指 + 拇指内扣」，但契印是**四指朝上**的张开手，两者形状不同，不会互相误开。

### 5.4 双手契印（在「茈」开关下）

主人重定的姿势：**一只手张开、四指全部朝上、拇指内扣，另一只手扣住它**（从侧面看就是「四指朝上」）。
这是本作**唯一的双手技法**；無量空処始终是**单手**。与单手茈同属「茈」开关：**开关关闭时契印完全不成立**
（四指朝上的手只按普通管线评分，可能落进苍的张开手掌判定）。不分左右手。

**扫描结论**（同参数 MediaPipe，用户照片 3 帧，见 TESTING §1.8）：

- 张开手在照片里四指全部朝上、`thumbGapRatio 0.30/0.34`（拇指压在掌上）；MediaPipe **经常只认出一只手**；
- **双手帧判据**：至少一只手满足 `claspOpenHandShape`（`index/middle/ring/pinky` 全 up 且
  `thumbGapRatio<0.75`），两只手 `wristGap` 在 `0.30~2.2`（除以平均掌长，照片里 0.66），
  被扣住的那只手随便是什么形状；
- **同一只手不算一对**：`wristGap<0.30` 直接否决；handedness 标签必须不同（`handsAreDistinct`）；
  带偏移的重复检测靠**腕相对形状差** `minShapeDelta 0.40` 否决——同一只手两次的 8/12/16/20 号点
  相对手腕的位移几乎相同（差≈0），真实双手照片里 ≥0.63；
- **单手帧（`claspSoloInfo`）**：只剩一只手时，四指朝上 + 拇指内扣就是契印的「张开手」那一半，
  **也认**，但用更长的门槛（`soloFrames 9 / soloHoldMs 300`），随手举个手掌不会发动；
- **与無量空処解耦**：领域是**单手两指**（ring/pinky 收拢），契印张开手是**四指全 up**，形状互斥；
- `updateClaspDetection()` 双手跑：400ms 内累积 ≥4 帧且持续 ≥120ms、其中真双手姿势 ≥2 帧
  （`claspRealPoseFrames/claspPairFrames`）即发动；纯单手跑用上面的 solo 门槛。

**状态机**：`claspCast = { startMs, phase, voicePlayed, burstStartMs, collisions }`，时长轴全部相对发动时刻（`CLASP_CAST` 的 getter 派生）：

- blue（0→1500ms）：右侧蓝色蒼球从中球（32% 终径）膨胀到**半个屏幕宽**（`orbRadiusFraction 0.50` × 视口半宽，直径=半屏宽），
  环带粒子绕球旋绕；语音在 **500ms** 时起播（`playAudioClip('purple-clasp')`，每次发动一次）；
- red（1500→4000ms）：左侧红色赫球用 2500ms 从小球长到与蓝球对称（`redStartFraction 0.10`）；
- converge（4000→7000ms）：两球用 3000ms 缓动向中心靠拢（smoothstep），同时压缩到终径的 30%，
  7000ms 处重叠、600ms 内淡出（`mergeFadeMs`）；
- purple（7000→20000ms）：**紫色星系漩涡**（`claspCore/claspRingA/B/C/claspShock`，纯布局函数
  `claspVortexLayout`）。3000 → 3200 点三臂星核差速旋转（中心快、边缘慢，旋臂随时间卷紧），
  `vortexRadiusFraction 0.26` × 半宽、`vortexSpin 0.55`；三道倾斜陀螺环（各 800 点、五段亮度弧、
  反向/交替自旋 `ringSpins` + 进动 `precess`），`ringTilts [0.72,-0.55,0.95]` 保持浅倾、`ringZClamp 0.34`
  把 |z| 夹在半径的 34% 内（陡倾会把点精灵摆到镜头前变成大灰方块）；13000ms 起进入碰撞段
  （`collideMs 7000`，`collideIntervalMs 1400`）：`claspCollisionPulse` 每拍压扁核心、点亮环、
  发一圈 `claspShock` 冲击波（700 点，900ms 生命周期，半径从核心 ×1.15 扩到半宽 ×1.08），
  并给 0.6 强度的相机震动；
- burst（20000ms）：`impactClaspCast()` → `forceTechnique('purple', 1600ms)` + 中心点爆炸（与茈命中同源），
  主粒子场回归；
- fade（21600→23000ms）：爆炸余波收尾，`updateState('neutral', true)`；2s 冷却，且必须松开扣合姿势
  （400ms 无姿势）才能重发。语音 21.891s（`audioMs`）在 22.39s 结束——**语音先结束、动画后结束**。

**视觉**：`CLASP_ORB_COUNT = 2400` ×2，蓝球在**右**、红球在**左**，复用 `ORB_RINGS` 的环带结构；
`sideFraction 0.52`、蓝球起始 32% / 红球起始 10% 终径；球粒子尺寸随球径放大（0.32→1.12）。
blue/red/converge/purple 期间 `fieldIdle` 强制隐藏 20k 主场，只留两球/漩涡 + 尘埃；burst 复用主粒子场。
bloom：blue/red 1.4、purple 基础 1.05 + 碰撞脉冲最高 +1.85、burst 4.0（`claspBloomStrength`）——
刻意压低，因为全部是加色混合，2+ 的常驻 bloom 会把星核烧成一团白；点精灵尺寸也从 0.62/0.55
缩到 0.46/0.42，色值上限压到 ~0.84，让旋臂/环/冲击波层次能读出来。

**边界**：

- **只在「茈」开关打开时成立**：关闭时连检测都不跑（回归 `clasp needs the purple switch`）；
- 四指朝上但**拇指外张**的张开手掌不算（`thumbGapRatio` 必须 <0.75）；
- 双手分得很开（阈值外）不算契印，各自按普通单手评分；
- 同一只手被识别成两只：`minWristGap` + handedness 标签 + `minShapeDelta` 三重否决；
- 契印候选/动画期间 void/red/blue 全压制；单手张开手也先按契印上下文处理，不会掉进苍的蓄势；
- **掉手不误触赫**：扣合时常只给一只手；单手张开手（`claspSoloInfo`）继续累积发动（9 帧 / 300ms），
  紫模式下红分本就归零，不会掉进赫；
- 与单手茈共存：契印开始时取消当前单手蓄势，动画期间旁路 `updatePurpleMode`。

## 6. 「赫」排斥 · 小红球场

### 6.1 手势与锚点

| 形态 | 判定 | 锚点 |
|---|---|---|
| 食指向上指 | `indexUp=1` 且其余三指收拢 | 食指指尖（lm8）沿指方向外推 |
| 枪形 | `indexUp+middleUp=1`、无名/小指收拢、`fingerGap<0.065`、`thumbGapRatio>0.75` | lm8/lm12 中点沿两指方向外推 |

外推距离 `min(9, max(3, 指节长*0.9))` 世界单位 ≈ **5~10cm**（即红点悬在指尖外一点）。
两形态切换或短暂丢手（<350ms）由 `lastRedSeenMs` 桥接，不断档。
`redAnchor.aimX/aimY` 另存**手腕→指尖**的单位方向（`wrist→tip`，与锚点外推无关），
作为激发的射出方向；手几乎直指镜头时该向量会缩成噪声（`len<=1.5`），此时保留上一次稳定 aim，
不朝侧面乱射。

### 6.2 跟随与渲染

- `redAnchor` → `redFollow`（阻尼 110ms）；每帧把**独立小红球网格** `redBall` 平移到手上，
  `particles.position` 始终留在原点（共享 20k 场不参与赫）。
- **赫的持续场 = 独立小红球**（`RED_BALL` / `redBall` / `fillRedBallPositions`）：1500 颗、
  球体半径 4.6（0.5→1 径向分布 + 7% 呼吸）、约 17% 是球外稀疏火星（`sparkRadius 1.65` + 缓慢漂移），
  绕竖轴慢速自旋（`spin 0.85 rad/s`），色从核心暖红到边缘深红。
- **性能**：赫全程 `fieldIdle = true` —— 共享 20k 场不渲染、不做逐粒子 lerp、不上传 240KB 属性，
  每帧只填 1500 颗小红球（一次 18KB 上传）。进入赫的瞬间把 20k 的 live 数组清零并置 targets 为零，
  退出后下个技法从中心重新长出来，不会弹出上一个技法的残影。
- **不回中**：赫结束后 `redFollow` 原地保留（打到哪里就停在哪里），没有任何缓回屏幕中央的逻辑；
  下一次进入赫时 `redFollow.init` 重置，红球直接落在当前手上。
- 苍构筑/释放期间赫分被清零（§3.3），两者不互相打断。

### 6.3 激发（射出）与熄灭（燃尽）· 两段完全不同的动画

问题背景：赫原本进入/退出共用同一个「目标形状 lerp 0.1/帧」，进入像慢慢浮出、退出像慢慢褪色，
看起来像「激发失败」。现在两条转场拆开，各有一套只依赖 age 的纯函数（回归可直接断言几何）：

- **进入 = 向前射出，不是炸开**（`startRedCast` → `redCastLayout` / `updateRedCastFx`）：
  - **枪口闪光** `redFlash`（520 点）：指尖锚点上 210ms 的白热小球，bloom 临时 +1.5；
  - **红色细长枪矛** `redLance`（700 点）：沿 aim 以 `lanceSpeed=170` 世界单位/秒**单向**飞出
    （420ms 内冲出 42 半径的红场），横向宽度只有 `0.6 + reach*0.05`（远窄于长度），前 20% 点聚成
    **高亮弹头**（u≥0.93、颜色更热），其余是拖尾；
  - **前向冲击锥** `redCone`（380 点）：锥尖在枪口、只朝 aim 张开的锥面，远端半宽 4.2 ≪ 长 18，
    强调方向性；
  - **场反应**：红球瞬间压到 0.6 倍再弹过 1（阻尼弹簧 `exp(-age/110)*cos(age/90)`），
    同时沿 aim **反方向**后退 3.4（后坐力，`jolt` 为负）——枪响的后坐，不是径向爆开；
  - 所有特效严格限制在 aim 前方（锥/矛的最小前向分量 ≥0），没有任何 360° 径向爆发。
- **退出 = 原地熄灭**（`startRedBurn` → `redBurnLayout`，仅当退出到 neutral）：
  红球停在原位缩小（半径 ×0.78）并淡出（`redBallVisual`：`alpha = 0.92·(1-t)^1.35`），
  260 颗余烬以 24 单位/s² 下落、620ms 内淡出（`redEmber`，起始半径 8~18 —— 贴着小球，不是旧的大场）；
  切到别的技法（茈/领域等）不播燃尽，红球直接隐藏、新目标形状从中心长出来。
- 时间常数全在 `RED_CAST`；演示态 `&end=redcast&age=<ms>` / `&end=redburn&age=<ms>` 冻结相位截图。

## 7. 領域展開「無量空処」 · 虚空

### 7.1 参考视频的扫描结论

用 MediaPipe Hands（与 app 同参数）扫了 `视频/领域展开，无量空处.mp4` 的 6 个清晰帧
（t=5/7/9/11/13/15s）。结论：

- 食指+中指举起、无名/小指收拢在所有帧稳定；`fingerGap` 0.016~0.048（<0.065）。
- **食中指的交叉在关键点里不可靠**：逐帧的 `tipSide/pipSide` 在 -1.87~+0.70 间跳，
  大部分帧（含视觉上明确交叉的 9/11/13/15s）被模型还原成平行两指。不能拿交叉与否当判据。
- **拇指内扣是稳定特征**：`thumbGapRatio` 0.375~0.65，全部 <0.75；而赫的枪形要求 >0.75。
  拇指尖到食指 PIP 的距离也在 0.28~0.74 之间，说明拇指压在掌心上。

所以无量空处用「两指举起 + 指尖靠近 + 拇指内扣」判定；与赫枪形（拇指外张）互斥，与食指指赫（中指不举）
也互斥。这个手势与茈的待发姿势同形，但茈模式开启时普通管线整体旁路，实际不会冲突。

### 7.2 触发与状态

- `computeHandScores().void`（单手，手掌朝向不限）：见 §3.3。
- `GOJO_GESTURES` 含 `void`，走常规 EMA → `pickGestureFromScores`；进入 0.75、保持 0.50。
- 展开期间可一直保持手势；松手退到 neutral。蓄势/释放锁/2s 冷却期间不能新开领域，
  已展开的领域不受影响（否则自己的入场冷却会把领域掐断）。
- `commitTransition('void')` 与其它技法一样起算 2s 冷却；`?tech=void` 仍可手动预览。

### 7.3 视觉

- 复用原项目的 `getVoid(i)`：15% 点在半径 26 的白环上，其余 85% 在半径 30~120 的蓝色球壳里。
- `updateState('void')`：顶部状态名 `領域展開「無量空処」`、`glowColor '#00ffff'`、`baseBloomStrength 2.0`、
  `shakeIntensity 0.4`；主粒子场以慢速 `rotation.y += 0.005` 旋转。
- 没有额外的界面/按钮；旧的独立开场页（`DomainExpansion-infintevoid/`）已不接入 UI——
  同一个动画现在被移植进了主场景，由「保持领域 3 秒」触发（见 §7.4）。

### 7.4 定格 3 秒 · 無量空処开场动画（cinematic）

主人要求：保持無量空処手势超过 3 秒自动进入旧 PR #7 的开场动画（去掉标题与「进入」按钮），
动画最后把中心换成 app 自己的白环粒子场。

- **触发**：`updateState` 进入 void 的那一帧写 `voidEnteredAtMs`（取 `lastFrameNowMs`，回归可走合成时钟）；
  `onResults` 在 `updateState` 之后调 `maybeTriggerVoidCinematic(nowMs)`——当前技法 void、
  `now - voidEnteredAtMs ≥` 当前时间轴的 `holdMs + startDelayMs`（正常 3000+0 / 长版 1000+8000）、
  未在播放、本次保持没播过（`voidHoldAwarded`）、且不是 `?tech=` 预览（`forcedTech`）时启动。
  一次保持只播一次；松手后重新结印才会再播（长版的 8 秒等待也随之重计）。
- **播放期间管线冻结**：`onResults` 与驱动的 `runFrame` 在 `voidCinematic` 非空时直接返回，手势不会打断它、
  领域也不会被重置；时间轴走 `animate()` 的真实时钟（6.2s），中途丢手也照常播完。
- **舞台层**：`#void-cinema` 黑幕（z1，盖住摄像头与 stage-shade；WebGL canvas 是 z3，在其上）；
  `body.void-cinema` 隐藏 `#ui / #left-rail / #debug-panel / #output_canvas`。开场 600ms 黑幕淡入，
  同时旧领域场 `particleMaterial.opacity` 1→0，之后 `hideField` 直接停算 20k 场省帧。
- **流星宇宙**：移植 PR #7 的 1200 条 LineSegments（2400 顶点、8 色盘），中心改 0、整体 scale 0.8；
  四层目标（事件视界白环 / 内爆 / 中层 / 外层宇宙）在 400ms 后开始 2.2s 形成，
  随后持续「向心流动 + 近核重生 + 近核增白」。
- **结尾换环（`ringAtMs 4000`）**：星星转为向外溶解目标并整体淡出（1000ms），同时 20k 主场
  `particleMaterial.opacity` 0→1 淡入——中心就是 `getVoid()` 的白环 + 蓝色星云（「我们粒子效果的圆环」）。
  bloom 在星星阶段 2.4、换环时 2.7。
- **长黑幕 + 环收尾（现行时间轴）**：换环后黑幕**保持 10s**（`blackHoldMs 10000`，环一直亮在黑底上）；
  14000ms 起黑幕 1500ms 淡出 → **背景透明、环还在**；16300ms（`ringOutAtMs`）起环自身 1800ms 淡出，
  18100ms（`endMs`）`finishVoidCinematic()` 恢复 UI、尘埃与不透明度；
  若手还保持着领域，领域场继续显示（`voidHoldAwarded` 阻止循环重播）。
- 阈值全在 `VOID_CINEMA`（holdMs/fadeInMs/formDelayMs/formMs/ringAtMs/ringFadeMs/blackHoldMs/blackFadeMs/
  ringOutDelayMs/ringOutMs，`blackFadeAtMs/ringOutAtMs/endMs` 是 getter 派生的绝对时刻）；
  演示态 `&end=voidform|voidring|voidclear|voidlong` 把相位冻结在「成型中」/「换环中」/
  「黑幕已淡出、只剩环」/ 长版「换环后黑幕保持中」便于截图。

### 7.5 长时间无量空处（long mode）

左侧栏设置「长时间无量空处 · Long Void」开关（`setVoidLongMode`，L 键同效；`voidLongMode` 为全局标志）。
打开后同一套 cinematic 换用 `VOID_CINEMA_LONG`：手势**保持 1 秒先展开领域**（普通 void 场）
并**立即起长语音**，**原地继续保持 8 秒**（`startDelayMs 8000`）才进入黑幕/黑洞开场动画：

- 时间轴（相对 cinematic 启动）：黑幕淡入 **1500** / 成型 400+2200 / 换环 4000+1000 /
  **黑幕保持 24000** / 黑幕淡出 2000 / 环停留 800 / 环淡出 3000 / `endMs = 33800ms`（约 34 秒）。
  从手势触发算起总时长约 **1s + 8s + 33.8s ≈ 42.8s**；8 秒等待期间领域场正常跟手、松手则取消并重计。
- 语音：手势满 1 秒（领域展开）时 `updateTechniqueVoices` 就播 `audio/void-long.mp3`（31.164s），
  不是等 cinematic 启动；8 秒等待期间语音继续播，cinematic 启动时不会重播。
  语音在触发起约 32.2s 结束（动画此时才走了 ~23.2s），动画 33.8s，**语音先结束、动画后结束**；
  长版下不再播单人版 `void.mp3`。
- 与正常模式的关系：关闭开关即回到「1 秒单人语音 + 3 秒定格开场动画（黑幕 600ms 淡入）」；
  `?end=voidlong` 演示态直接把长版时间轴推到换环后、黑幕保持段冻结，方便截图。
- 黑幕保持段的 bloom 在 2.7 上下 ±0.28 慢速呼吸（约 7 秒一个周期），避免 24 秒静止画面显得死板。

## 8. 主粒子场与爆炸

- `COUNT = 20000`；`targetPositions/targetColors/targetSizes` 每帧由当前技法函数生成
  （现在只剩 `getRed/getVoid/getPurple/getBlue`），现场 `lerp 0.1` 追随 → 形状渐变过渡。
- `PointsMaterial`：size 全局（attribute 不生效），additive，`mix-blend-mode: screen` 合成。
- **爆炸**（紫/蓝共用）：`purpleExplosionUntilMs` 期间每点从形状位置向外飞 `purpleExplosionMaxDistance 100`
  × 个体差异 0.84~1.12，颜色固定爆炸色，bloom 临时 +3（`purpleExplosionBloomBoost`），
  画面震动（renderer canvas transform 随机位移）。
- 茈的投射命中是**点爆炸**：`impactPurpleShot` 把 `purpleExplosionSourcePositions` 全写 `0.0001`（避免爆炸代码回退到目标形状），从世界 `(0,0,0)` 向外炸开。
- 爆炸结束后 `postExplosionNeutralMs 400` 强制 neutral；茈的爆炸时长 `purpleExplosionDurationMs = 1600ms`，1600 + 400 = 2s 冷却。

## 9. 环境尘埃（待机粒子 + 引/斥力）

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

## 10. 渲染与性能

- 渲染器：`setPixelRatio(min(devicePixelRatio, 1.5))`，`EffectComposer` + `RenderPass` +
  `UnrealBloomPass(res, strength=1.5 基础, radius=0.4, threshold=0.85)`；每技法有 `baseBloomStrength`
  （blue 3.0、red 2.5、purple 4.0、void 2.0、flick 1.4），爆炸期间临时加；茈模式待机时 base 降到 0.35，让蓄势小球保持小而紧的紫光。
- **`fieldIdle`**：`（契印尚未进入 burst/fade） || currentTech==='red' || （currentTech==='neutral' && now > neutralSettledAtMs && 无紫爆炸）`，
  或「無量空処 cinematic 的星星阶段（`hideField`）」→ 主粒子场 `particles.visible=false`，
  且跳过 20k 的 lerp/上传/旋转/爆炸计算。
  `neutralSettledAtMs = now + 700`（进入 neutral 后留 700ms 淡出时间）。**这是最大的性能闸门**。
- fps 表：每 500ms 统计，D 面板 `fps` 行；低于 ~30 说明 GPU 吃紧（核显或浏览器退软渲）。
- 软件渲染（llvmpipe）实测只有 1~3fps——验收时可以截图、可以看逻辑，但不能以帧率论成败。

## 11. 界面层

- Win11 石墨 Acrylic（规范见 navi `skills/web-design.md`）：毛玻璃顶栏/侧栏、青蓝 `#66CCFF` 强调、噪点纹理。
- 顶栏三段式（`grid-template-columns: 1fr auto 1fr`）：左上 `#menu-btn` 开合左侧栏 + `#start-btn`
  摄像头启动按钮（见下方「启动门禁」）；正中央
  `#technique-name` 用 22px 纯白字显示当前技法**原版名**（`updateState` → `setTechniqueName()`）：
  術式順転「蒼」/ 術式反転「赫」/ 虚式「茈」/ 領域展開「無量空処」。`neutral` 时清空文字并加
  `.empty`（opacity 0），不再显示「通常状態」；蓄势中可带「· 構築中 / 射出 / 構え」后缀。
- 右上 `#purple-hint` 一行提示（「点击开启虚式「茈」枪指模式」）+ `#purple-mode-btn` 模式开关（§5）。
  开启时按钮外圈显示 2s 冷却进度、提示改为「已开启 · 点击关闭」；普通模式（含無量空処）时按钮静默。
  双手契印不经按钮，状态名在 build/converge/burst 期间都显示「虚式「茈」」，结束后清空。
- 左侧栏 `#left-rail` 是一整块亚克力面板（`collapsed` 类做 translateX/opacity 过渡），顶部是三枚
  **小菜单标签** `.rail-tab`（`data-tab = main | guide | about`），下面三个 `.rail-panel` 互斥显示
  （`[hidden]` + `display:none!important`）：
  - `#rail-panel-main`（模式与音频）：`#settings-list` 的 Win11 开关行（D 调试 / H 手势指南 /
    **V 术式语音（总闸）** / L 长时间无量空处 / **★ 自定义无量空处**，点击即切换）；
    打开「自定义无量空处」后下方 `#egg-panel` 展开版本 1/2/3、「说明」箭头与版本 3 的 B 站链接输入框；
    再往下是 **音频 · Audio**（`#audio-list`，见 §11.1）；
  - `#rail-panel-guide`（指南）：`#gesture-guide` 渲染 `GUIDE_GOJO`；
  - `#rail-panel-about`（关于）：`#about-body`（原作作者 + 改版作者/网站/仓库、原项目、素材鸣谢与侵权联系邮箱、
    两条彩蛋视频的 B 站链接、开源依赖、本地化说明、DeepSeek-V4.1 flash / Gemini 4 Neon 双模型鸣谢）。
  `setRailTab(name)` 校验名字后设 `railTab`、切 `.active`/`aria-selected`、隐藏其它面板；栏收起时点击标签
  会先展开。H 键走 `toggleGuideTab()`（指南 ⇄ 主菜单）。音乐、按键表、纯净模式、技法轮换、
  独立开场页入口、黒閃均已按主人要求删除。
- **启动门禁**：`cameraEnabled` 默认 `false`，`startCameraPipeline()` 只在顶部栏 `#start-btn` 按下时调用；
  关掉走 `stopCameraPipeline()`（停 MediaPipe/摄像头、清追踪）。`updateStartButton()` 按 `cameraStatus`
  更新标签与 `data-state`：「启动 / 启动中 / 等待追踪 / 追踪中 / 追踪异常 / 启动失败」，颜色从青蓝到
  绿（追踪中）再到红（异常）；按钮是 `#ui` 里少数 `pointer-events:auto` 的元素。窄屏只留图标+短标签，
  `#ui h1` 隐藏。
- **移动端追踪加固**：`<video playsinline muted autoplay>`（iOS Safari 不静音内联就不自动播放，
  视频停住 → MediaPipe 收不到帧）；`onFrame` 等 `videoWidth/Height` 就绪再发帧，逐帧 `try/catch`
  且**永不 reject**（MediaPipe `Camera` 的 rAF 循环一旦 reject 一次就永久停）；启动后显式 `play()`，
  `visibilitychange` 回前台恢复播放。`trackFrames/trackLastResultMs/trackLastError` 供启动行与
  D 面板显示；看门狗 `TRACK_STALL_MS 20s` 无结果就报「追踪无输出」。
- **首次进入教程**：`INTRO_PAGES = welcome, blue, red, purple, void`；`showIntroPage()` 切页、
  `finishIntro()` 关闭并令 `introDone=true`（渲染循环在 `introDone` 前直接 return）。欢迎页含原作作者、
  原项目、改版作者、隐私（本地推理、不上传）与素材来源/联系邮箱声明；四页教程图在 `assets/tutorial/`（本地）。
- **自定义无量空处**：`voidEggEnabled`（默认关）+ `voidEggVersion`（1/2/3）；短版 `VOID_CINEMA` 播到
  `ringAtMs`（白环出现前）且 `hasVoidEggVideo()` 为真时 `openVoidEgg()`，全屏 `#void-egg` iframe
  自动播放所选 B 站视频。版本 1/2 的 URL 由 `buildVoidEggUrl()` 拼 bvid/cid；版本 3 用
  `parseBilibiliShareUrl()` 解析用户粘贴的 `bilibili.com/video/BV...`（可选 `?p=` 集数，也接受 av 号），
  `saveVoidEggCustom()` 存入 `localStorage['sat0ru.voidEggCustom']`，仍用 B 站官方 iframe 播放器。
  `b23.tv` 短链需要联网解析，直接拒绝并提示先展开链接；版本 3 没有链接时不切断动画。
  Esc/关闭按钮退出并清空 iframe；长版动画不受影响。这是页面唯一可能的外部请求，未开启时零外网。
- `D` 面板显示 raw/smoothed 分数、`fps`、`camera`（状态 + frames + last + err）、`charge`、`blueStages`、
  `bluePulse`、`gestureLock`、`cooldown`、`claspSig`（`pose/solo/wrist/delta`）。
- 术式语音（V）：`voiceEnabled` 是**手势触发语音的总闸**（默认开）。关掉后 `playAudioClip(key)`
  对手势路径直接返回；左侧栏音频库的手动点击传 `manual=true`，不受影响（见 §11.1）。

### 11.1 本地语音与音频库（local audio）

全部术式语音都是本地 `<audio preload="auto">`，零外网请求；`AUDIO_TRACKS`（key/元素/标签/时长）
是唯一清单，`buildAudioLibrary()` 按它生成左侧栏 `#audio-list` 的 `.audio-row`（一行一条、点击播放/停止）。

| key | 文件 | 用途 |
|---|---|---|
| `blue` | `audio/blue.mp3` | 苍构筑成型后再满 `BLUE_SEQ.voiceDelayMs = 2000ms`（读 `blueCharge.startedMs`；提前释放/取消不播） |
| `he-1` / `he-2` | `audio/he-1.mp3` / `he-2.mp3` | 任一赫手势进入满 1 秒随机播一条（`redEnteredAtMs` 由 `updateState` 写入，每次保持一次） |
| `void` | `audio/void.mp3` | 普通無量空処保持满 1 秒播单人版；长版模式跳过 |
| `void-long` | `audio/void-long.mp3` | 长版手势满 1 秒（领域展开）时播放（31.164s）；8 秒等待期间继续播，cinematic 启动不重播 |
| `purple` | `audio/purple-short.mp3` | 茈按钮模式 `firePurpleCharge` 发射瞬间 |
| `purple-clasp` | `audio/purple-clasp.mp3` | 双手契印发动后 **500ms** 自动播放（21.891s）；每次发动一次，语音在 22.39s 结束、动画 23s 结束 |
| `fail` | `audio/fail.mp3` | **只在音频库手动点击**，不接任何手势（1.46s 源素材转 160k MP3） |
| `creed` | `audio/creed.mp3` | 同上（3.46s 源素材） |

- `updateTechniqueVoices(nowMs)` 在 `onResults` 每帧（以及回归驱动 `runFrame`）里检查语音门槛：
  赫/普通無量空処是「进入技法满 `VOICE_HOLD_MS = 1000ms`」，苍是「构筑成型后满
  `BLUE_SEQ.voiceDelayMs = 2000ms`」（`blueCharge` 消失即复位）。苍（`blueVoicePlayed`）、
  赫（`redVoicePlayed`，离开 red 即复位）、無量空処（`voidVoicePlayed`，长版模式下不播短语音）
  各自每次保持/每次构筑只播一次。
- `playAudioClip(key, manual=false)` 先暂停并归零其它所有轨道，再从头播目标轨道 → **同一时间只播一条**；
  手势路径受 `voiceEnabled` 门控（关掉即静默返回），`toggleAudioClip` 手动点击传 `manual=true` 永远可播。
  `audioPlayCounts` 供回归断言。`stopAudioClip` 服务侧栏按钮，`updateAudioRowState` 负责 `.playing` 高亮
  与「■ 停止」文案。
- **自动播放解锁**：浏览器要求用户手势后才能出声，`primeAudio()` 在首次 `pointerdown`/`keydown`
  （`{once:true}`）把每条轨道静音试播再暂停（正在播放的那条不复位），之后手势触发就能直接出声。
- 已知取舍：手机静音键/系统音量仍会压掉声音；`play()` 被策略拒绝时静默失败（catch 掉，不打断画面）。

**释放音效已删除**：早期版本用 WebAudio 合成过苍/茈/契印的释放音效，主人明确那是误解——
「音效开关」本意是**术式语音（五条悟的声音）的总开关**。合成音效、`sfxEnabled` 与设置里的 SFX 行
全部移除；现在设置里只有「术式语音 · Voices」（`voiceEnabled`）。

## 12. 参数速查（改之前先读注释）

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
| `BLUE_SEQ.holdMs` | 苍持掌时长 | 2000ms | 张开手掌保持这么久即构筑 |
| `BLUE_SEQ.voiceDelayMs` | 苍语音延迟 | 2000ms | 构筑成型后再等这么久才播 `blue.mp3`；提前释放/取消不播 |
| `BLUE_SEQ.openFrames` | 苍起算帧数 | 3 | 先连续 3 帧 isOpen 才开始计时（帧 ≈ 33ms） |
| `BLUE_SEQ.animMs/cooldownMs` | 释放演出/锁 | 2500/2000ms | |
| `VOICE_HOLD_MS` | 术式语音门槛 | 1000ms | 苍/赫/普通無量空処保持满 1 秒播一次；见 §11.1 |
| `AUDIO_TRACKS` | 本地音频清单 | 9 条 | 苍/赫×2/無量空処×2/茈短/契印 + 失败/校训（后两条只手动点）；左侧栏与语音触发共用 |
| `voiceEnabled` | 术式语音总闸 | 开 | 手势触发语音全静音；音频库手动点击传 `manual=true` 不受影响 |
| `CHARGE.*` | 释放判定 | 见 §4.5 | 灵敏度都在这里 |
| `CHARGE.pushMinGrowth / pushMinRate` | 前推闸门 | 0.24 / 1.7/s | 累计掌尺寸增幅 / 平均增速 |
| `CHARGE.pushMinMs / pushMinSamples` | 前推持续 | 110ms / 3 采样 | 滤掉单帧/两帧关键点跳变 |
| `CHARGE.growMs` | 球展开时长 | 2000ms | 越快越大越快 |
| `CHARGE.followTauMs` | 跟手阻尼 | 90ms | 大=拖尾更重 |
| `CHARGE.pathMs` | 拖尾路径 | 320ms | |
| `CHARGE.fistFrames` | 握拳释放 | 2 帧 | 连续 2 帧 `handShape().isFist` 即释放（单帧抖动不算） |
| `CHARGE.flingMinSpeed` | 甩出速度 | 1.4 屏宽/秒 | 逐帧步长速度门槛；比较的是**最新一步**，不是窗口平均 |
| `CHARGE.flingMinDisplacement` | 甩出位移 | 0.08 | 连续快帧累计位移 |
| `CHARGE.flingRunFrames` | 甩出连帧 | 2 | 至少 2 个连续快帧（抬高误触门槛） |
| `CHARGE.flingMaxSampleGapMs` | 甩出采样间隔上限 | 120ms | 超过即视为追踪断点，清空连击 |
| `TECH_COOLDOWN_MS` | 全局冷却 | 2000ms | 任何术式触发后 |
| `PURPLE_CAST.*` | 茈模式 | 见 §5 | poseHold 8 帧 + 220ms / armMs 260ms / push 4 采样 + 130ms + 0.28 + 2.0/s / grace 280ms / readyGrace 500ms / snapWindow 500ms / snapJump 0.15 / 跟手 90ms / 飞行 380ms / 冷却 2000ms |
| `PURPLE_ORB_COUNT` | 茈小球粒子数 | 700 | 8% 核 / 58% 环 / 34% 雾 |
| `CLASP_CAST.*` | 双手契印 | 见 §5.4 | 仅紫模式；双手 4 帧 / 120ms（真双手姿势 ≥2 帧）或单手张开手 9 帧 / 300ms、gap 400ms、`wristGap 0.30~2.2`、`thumbGapRatio<0.75`、`minShapeDelta 0.40`、handedness 标签须不同；语音 500ms；蓝 1500 / 红 1500+2500 / 靠拢 3000 / 漩涡 6000 / 碰撞 7000 / 爆炸 1600 / 余波 1400，全 23000ms；冷却 2000ms |
| `CLASP_ORB_COUNT` | 契印球粒子数 | 2400 ×2 | 蓝球在右、红球在左 |
| `CLASP_CORE_COUNT` / `CLASP_RING_COUNT` / `CLASP_SHOCK_COUNT` | 漩涡粒子数 | 3200 / 800 ×3 / 700 | 三臂星核 / 三道陀螺环 / 冲击波 |
| `CLASP_CAST.vortexRadiusFraction` / `vortexSpin` | 星核 | 0.26 / 0.55 | 星核半径占半宽比 / 基础角速度 |
| `CLASP_CAST.ringRadiusFractions` / `ringTilts` / `ringSpins` / `ringZClamp` | 陀螺环 | 0.50,0.36,0.62 / 0.72,-0.55,0.95 / 0.9,-1.25,0.62 / 0.34 | 半径 / 倾斜 / 自旋 / z 夹取（防点精灵变大方块） |
| `CLASP_CAST.shockMs` / `shockMaxFraction` | 冲击波 | 900ms / 1.08 | 生命周期 / 扩到半宽的倍数 |
| `RED_BALL` | 赫小球 | 1500 颗 / 半径 4.6 | 17% 外圈火星；`spin 0.85`、呼吸 7%；`redBallVisual` 燃尽包络；赫全程 20k 主场熄灯 |
| `VOID_CINEMA` | 無量空処开场动画 | 见 §7.4 | hold 3000 / 黑幕 600 / 成型 400+2200 / 换环 4000+1000 / 黑幕保持 10000 / 黑幕淡出 1500 / 环停留 800 / 环淡出 1800 / 全 18100ms |
| `VOID_CINEMA_LONG` | 长时间无量空处 | 见 §7.5 | hold 1000（同帧起长语音）/ **等待 8000** / 黑幕淡入 1500 / 黑幕保持 24000 / 黑幕淡出 2000 / 环淡出 3000 / 动画全 33800ms（从黑幕算）；语音 `audioMs` 31164ms（先结束） |
| `VOID_STREAK_COUNT` | 开场流星数 | 1200 | 2400 顶点 LineSegments，中心 0、scale 0.8 |
| `TUNING.purpleExplosionDurationMs` | 紫爆时长 | 1600ms | 茈命中/紫场共用 |
| `TUNING.postExplosionNeutralMs` | 爆后 neutral 锁 | 400ms | 1600+400=2s |
| 枪形阈值（赫） | `fingerGap<0.065` `thumbGapRatio>0.75` | `computeFrameScores` 内 | |
| 红点外推 | `min(9, max(3, 指节长*0.9))` | | ≈5~10cm |
| `RED_CAST` | 赫激发/燃尽 | 见 §6.3 | 矛 420ms / 锥 380ms / 闪光 210ms / 场回落 420ms / 矛速 170 / 锥长 18×半宽 4.2 / 枪口 1.6 / 场压 0.6→1 回弹 / 后坐 3.4 / bloom +1.5 / 燃尽 620ms / 余烬重力 24 |
| `RED_LANCE_COUNT` / `RED_FLASH_COUNT` / `RED_CONE_COUNT` / `RED_EMBER_COUNT` | 赫特效粒子数 | 700 / 520 / 380 / 260 | 各自独立 Points，平时隐藏 |
| 斥力泡半径 | `30 ± 2.5` | dust 块内 | |
| 尘埃轨道半径 | `orbitR 9~17` × shrink 0.75~1 | 种子生成处 | |
| 尘埃阻尼 | `tau 0.18~0.48s` | 种子生成处 | |

## 13. 已知限制与升级路径

- **MediaPipe Hands (legacy)** 是 2D 关键点逐帧检测：极端光照、逆光、手太远仍会丢；丢手由桥接/冷却兜底。
  升级路径：MediaPipe Tasks `HandLandmarker`（新模型、世界坐标、时序更稳）——替换 `hands` 初始化与
  `onResults` 即可，`computeHandScores` 之后不动。
- 「前推」只能用 2D 掌尺寸增速做代理（无深度）。单帧/两帧关键点跳变已由连续增长链过滤；
  极低帧率或逆光导致关键点反复抖动时，增长链可能被频繁打断（表现为难释放，而不是误释放）→ 调 `CHARGE.*`。
  横向挥手永远不释放，这是刻意设计。
- screen 混合叠在摄像头上：画面极亮（对着窗户）粒子会偏淡，属预期；可降曝光或加 bloom。
- 无摄像头/拒绝授权时 MediaPipe 弹 "Failed to acquire camera"，**模态框会卡住页面 JS**——自动化验收必须
  覆写 `window.alert`（测试页已做）。
- Web Speech（"run away"）依赖浏览器在线识别；术式语音/音频库是本地 MP3，不受影响，但首次出声前需要
  一次点击或按键解锁自动播放（`primeAudio`）。
- **無量空処的食中指交叉不被 MediaPipe 解析**（扫描见 §7.1）：不要试图用「交叉」判定，用拇指内扣；
  如果用户拇指只内扣到一半（`thumbGapRatio` 0.75~0.85），会落在赫枪形里，表现为展开领域失败。
- **双手契印不再依赖双手都被识别**：MediaPipe 在扣合姿势下经常只认出张开的那只手（参考视频里约一半帧如此）。
  现在单手张开手型（四指朝上、拇指内扣）也认，但要走更长的 `soloFrames/soloHoldMs`（9 帧 / 300ms），
  真双手姿势只要 4 帧 / 120ms；这样偶尔一张开手掌不会误放 23 秒长动画。间距/形状阈值调大更敏感、调小更防误触。
- **契印没有「交叉」判据**：MediaPipe 解析不了手指交叉，所以判据是间距 + 手型 + 腕相对形状差。
  同一只手被识别成两只由 handedness（`handsAreDistinct`）、腕距下限 `minWristGap` 与 `minShapeDelta`
  （重复检测的腕相对布局几乎重合，真实双手不会）否决；领域手型不是张开手，`claspOpenHandShape`
  直接排除。剩下的近似是「另一只手恰好落在间距窗内」，可调 `CLASP_CAST.wristGapMax/minWristGap/minShapeDelta`。
- **甩出释放有误判余量**：`flingMinSpeed 1.4` / `flingMinDisplacement 0.08` 是 2D 手速代理，
  逆光、快速转身或追踪抖动时可能提前放掉；收紧就调高速度/位移，放宽就调低（横向慢移仍只跟手）。
- `logic-test.html` 是生成物，不入库；改了 `index.html` 之后必须重新生成。回归共 **248 项断言**
  （含苍/赫/赫激发与燃尽/苍赫無量空処语音/茈/双手契印/漩涡/無量空処开场动画/长时间无量空处/三菜单/音频库 9 条/
  术式语音总闸/小红球/弯指不武装/握拳与甩出释放/掉手不误触赫/顶部启动按钮/自定义无量空处版本与链接解析/关于鸣谢）。

## 14. 关键函数索引（`index.html`）

| 函数 | 职责 |
|---|---|
| `handPointToWorld` | 归一化坐标 → 世界坐标（镜像+cover 裁剪） |
| `handShape` | 21 点 → 几何特征 |
| `computeHandScores` | 单手 → 技法分 |
| `computeFrameScores` | 双手 → 组合技法 + 五条悟互斥/桥接 |
| `smoothScores` / `pickGestureFromScores` | EMA + 进入/保持/切换裁决 |
| `setPurpleMode` | 「茈」模式开关（苍/赫旁路、按钮状态） |
| `updatePurpleMode` | 茈的枪形/捏合蓄势、前推/拇指外弹（拇指内扣→外张跳变）/指尖 flick 发射、冷却 |
| `firePurpleCharge` / `impactPurpleShot` | 射出与中心点爆炸 |
| `updatePurpleButton` | 按钮 2s 冷却环 |
| `commitTransition` | 切换时起算 2s 冷却 |
| `updateState` | 技法 → 顶部状态名/配色/bloom/目标状态；neutral 700ms 后触发 fieldIdle |
| `updateBlueSequences` / `armBlueCharge` / `releaseBlueCharge` | 苍：持掌 2s → 构筑 → 释放 |
| `startRedCast` / `redCastLayout` / `updateRedCastFx` | 赫激发：沿手腕→指尖方向射出细长枪矛 + 枪口闪光 + 前向冲击锥 + 场回弹/后坐（纯布局函数，回归断言） |
| `startRedBurn` / `redBurnLayout` | 赫原地燃尽：余烬下落淡出（只在中性退出时播） |
| `fillRedLancePositions` / `fillRedFlashPositions` / `fillRedConePositions` / `fillRedBurnPositions` | 四组特效 Points 的每帧填充 |
| `maybeTriggerVoidCinematic` / `startVoidCinematic` / `updateVoidCinematic` / `finishVoidCinematic` | 無量空処开场动画（正常 3s 触发；长版 1s 展开领域并起长语音，8s 等待后启动画面） |
| `setVoidLongMode` | 「长时间无量空处」开关（L 键/侧栏），切换 `VOID_CINEMA_LONG` 时间轴 |
| `buildAudioLibrary` / `toggleAudioClip` / `stopAudioClip` / `updateAudioRowState` | 左侧栏音频库：9 条本地语音的按钮、高亮与停止 |
| `playAudioClip` / `primeAudio` | 单条播放（先停其它轨道）+ 首次点击/按键静音预热解锁自动播放 |
| `updateTechniqueVoices` | 每帧检查语音门槛：赫/無量空処 1 秒保持、苍构筑后 2 秒延迟 |
| `fillOrbPositions` | 每帧重算 4000 点构筑球 |
| `fillPurpleOrbPositions` | 每帧重算 700 点茈小球（只有雾层拖尾） |
| `claspPoseInfo` / `updateClaspDetection` | 双手契印判定与短窗口累积 |
| `startClaspCast` / `updateClaspCast` / `impactClaspCast` | 契印长动画状态机（blue/red/converge/purple/burst/fade）、0.5s 语音、中心紫色爆炸、2s 冷却 |
| `claspOrbLayout` / `claspCollisionPulse` / `claspBloomStrength` | 两球位置/半径/透明度（纯函数，回归直接断言）、碰撞脉冲、分阶段 bloom |
| `claspVortexLayout` / `fillClaspCorePositions` / `fillClaspRingPositions` / `fillClaspShockPositions` | 紫色星系漩涡的纯布局契约与每帧填充 |
| `claspOpenHandShape` / `claspShapeDelta` | 契印手型（四指朝上 + 拇指内扣）与「同一只手被识别两次」的腕相对形状差守卫 |
| `startCameraPipeline` / `stopCameraPipeline` / `setCameraEnabled` / `updateStartButton` | 启动门禁：只有顶部栏按钮按下才建 MediaPipe/摄像头；标签/颜色反映追踪状态 |
| `showIntroPage` / `finishIntro` / `initIntro` | 首次进入的五页教程弹窗与 `introDone` 闸门 |
| `buildVoidEggUrl` / `openVoidEgg` / `closeVoidEgg` / `setVoidEggEnabled` / `setVoidEggVersion` | 自定义无量空处：到点切 B 站 iframe、版本与清理 |
| `parseBilibiliShareUrl` / `hasVoidEggVideo` / `saveVoidEggCustom` / `updateEggPanel` | 版本 3：解析粘贴链接（BV/av/集数）、判断是否有片可播、localStorage 持久化与面板渲染 |
| `fillClaspOrbPositions` | 每帧重算左右两颗粒子球（2400 ×2） |
| `animate` | 每帧主循环：fps、主粒子场、构筑球、**尘埃**、爆炸、震动、合成器 |
| `getRed` 等 `get*` | 各技法的 20k 目标形状函数（现在只有 red/void/purple/blue 四个） |
| `getVoid` | 無量空処的白环 + 蓝色球壳目标形状 |