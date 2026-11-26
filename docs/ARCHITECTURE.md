# 技术架构 · SAT0RU

单文件 Three.js 应用（`index.html`，约 2100 行）+ MediaPipe Hands 手部识别。
本文覆盖：数据流、识别管线、苍/赫状态机、茈投射模式与双手契印、無量空処、环境尘埃、渲染性能、参数速查、已知限制。
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
         └→ updateState(tech)      设定目标形状/配色/顶部状态名/bloom 强度
              └→ animate() 每帧：主粒子场 20k lerp、光球 4k、尘埃 1.2k、爆炸、震动
                   └→ EffectComposer(RenderPass → UnrealBloomPass) → #three-canvas
```

`#three-canvas` 用 `mix-blend-mode: screen` 叠在镜像摄像头画面（`.input_video`，CSS `scaleX(-1)`）上，
所以粒子像直接长在房间里。MediaPipe 骨架 `#output_canvas` 同样镜像，只在 D 调试模式可见。

## 2. 模式与 URL 参数

| 参数 | 作用 |
|---|---|
| 无 | 默认 `MODE='gojo'`：只启用 `GOJO_GESTURES = ['blue','red','void']`（苍/赫/無量空処），其余技法不接手势 |
| `?mode=all` | 恢复全套 15 技法（`SCORE_GESTURES` + 语音），指南同步切换 `GUIDE_ALL` |
| `?tech=<id>` | 锁定单技法演出、跳过识别（录制素材用）。id 见 README |
| `?logictest=1` | 加载无摄像头回归驱动（仅 `logic-test.html` 有） |
| `?logictest=1&end=charge\|blue\|red\|purplecharge\|purpleburst\|void\|voidform\|voidring\|claspbuild\|claspburst` | 视觉演示：构筑态 / 释放蓝场 / 赫红场 / 茈蓄势 / 茈爆炸 / 無量空処 / 無量空処开场（成型中/换环中）/ 双手契印构建 / 契印爆发（`&noui=1` 隐藏侧栏） |

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
| `fingerGap` | 食指-中指指尖距离 | 四指并拢 vs 张开；枪形 < 0.065；無量空処 < 0.075 |
| `thumbOut` | 拇指尖离手腕 > 0.25 | 平掌+拇指技法 |
| `thumbGapRatio` | 拇指尖→食指 MCP 距离 ÷ 掌长（腕→中指 MCP） | **枪形/赫** > 0.75（拇指外张）；**無量空処** < 0.75（拇指内扣）；茈的拇指外弹也看这个值的跳变 |
| `handAngle` | 腕→中指 MCP 的倾角 | 备用 |
| `isOpen` / `isFist` | 四指指尖-腕距离 > PIP×1.12 / < ×0.92 | 苍的时序手势（不依赖手掌朝向） |

### 3.3 `computeHandScores()` → `computeFrameScores()`

- 每手 0/1 分表；捏合（pinch）会 0.45× 抑制相关姿态（保「茈」可靠）。
- 五条悟模式（`MODE==='gojo'`，`computeFrameScores` 内）：
  - **赫**：`indexUp=1 且中/无名/小指全收`，**或枪形** `indexUp+middleUp=1、ring/pinky=0、fingerGap<0.065、thumbGapRatio>0.75`。
    任一手满足即 `frameScores.red=1`，并记 `redFormSeen=true`。
  - **無量空処**：`indexUp+middleUp=1、ring/pinky=0、fingerGap<0.075、thumbGapRatio<0.75`。
    与赫枪形是同一对伸出的手指，靠拇指外张/内扣区分（见 §7）；任一手满足即 `frameScores.void=1`。
  - **苍**：`updateBlueSequences()` 时序状态机（见 §4.1），完成后 `armBlueCharge()`。手别 key 用 handedness，
    标签翻转按 0.30 邻域重捕获（清速度历史与腕旋基准）。
  - **互斥**：`blueCharge` 存在 → `resetBlueHandStates()`；`gojoLocked`（释放锁）或 `techCoolingDown` 或
    `redFormSeen` 或已处于 red → 清零苍时序。`currentTech==='red'` 时若本帧无赫形态且距 `lastRedSeenMs` < 350ms
    仍补 1 分（丢手桥接）；无手帧早退前也有同样桥接。
  - 反向：非 red 状态下 `blueCharge || gojoLocked || techCoolingDown` 时赫分强制 0；非 void 状态下同样的
    条件把 void 分强制 0（蓄势/释放锁/2s 冷却期间不能新开领域，但已展开的领域可继续持有）。
  - **双手契印互斥**：`claspPoseInfo()` 命中（双手食指朝上 + 至少一只手中指朝上 + 双拇指内扣 + 腕距/食指尖距
    都在阈值内）时，void/red/blue 分清零、苍时序清零；契印启动后整段动画旁路所有手势（见 §5.4）。

### 3.4 平滑与裁决（`TUNING`）

- EMA：`smoothed = smoothed + (raw - smoothed) * 0.20`，每帧每技法。
- 进入需要 smoothed ≥ **0.75**；当前技法保持只要 ≥ **0.50**。
- 切换挑战者需领先 **0.12**（立即）或持续领先 ≥0.03 达 **300ms**（定时路径）。
- 裁决结果进入 `updateState()`；`purple` 有额外的 flick 退出窗口逻辑（all 模式用）。

### 3.5 冷却与锁定

- `commitTransition(next, now)`：进入任何非 `neutral`/`flick` 的技法 → `techCooldownUntilMs = now + 2000`。
- 苍释放后还有自己的锁定：演出 2.5s（`BLUE_SEQ.animMs`）+ 触发锁 2s（`cooldownMs`），期间手势全忽略。
- 赫激活期间不受冷却影响（持续），但冷却期内不能再触发苍/赫。

## 4. 「蒼」引力 · 构筑态

### 4.1 时序手势（`updateBlueSequences`）

单手或双手各自独立：**张开 ≥3 帧 → 握拳 ≥2 帧 → 再张开 ≥3 帧**，每段间隔 ≤`stageWindowMs 1200ms`，
手短暂丢失有 `handGraceMs 500` 宽限。先完成的手成为锚（返回 hand key）。
任一帧出现赫形态（`redFormSeen`）立即清零——做枪形时「张开→收指→张开」不会被误读。

### 4.2 `blueCharge` 数据

`{ key, x, y, size, prevSize, growSamples, growStartMs, growStartSize, startedMs, lastSeenMs, ... }`，
`armBlueCharge()` 建立，`releaseBlueCharge()` 销毁。
构筑中顶部状态显示 `術式順転「蒼」 · 構築中`；`CHARGE.maxChargeMs = 30000` 安全阀。

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
| 合掌 | 两掌心距 < `palmGap 0.13`，持续 `palmGapFrames 2` |
| 出手 | 掌心越出画面边距 `outMargin 0.10`，持续 `outFrames 2` |
| 丢追踪 | `lostMs 1000` |
| 安全阀 | `maxChargeMs 30000` |

连续增长链是关键：单帧关键点跳变（手指/手型变化）会在下一样本因不再增长而断链，绝不可能凑满
3 个采样 + 110ms。慢速平移、横向快挥、转腕、指赫都只让球跟手，不释放。参数全在 `CHARGE.*`。

释放即：`chargeOrb` 消失、主粒子场在**屏幕中央**绽放（`BLUE_SEQ.animMs = 2500ms`，见 §8 爆炸），
尘埃层同步炸开（§9），随后 2.5s 演出 + 2s 触发锁/全局冷却。

## 5. 虚式「茈」· 投射模式（右上角按钮）

### 5.1 交互模型

右上角 `#purple-mode-btn`（「茈」）是**模式开关，不是施法按钮**。点击开启后：

- 苍/赫全部暂停：`computeFrameScores` 在 `purpleMode` 时把 blue/red 分归零，枪形不再触发赫；
- 枪形（`fingerGap<0.065`、`thumbGapRatio>0.75`）、捏合（`pinchScore=1`）或拇指内扣的待发姿势连续 3 帧 → 构筑紫色小球；
- 小球跟随手部（阻尼 90ms）；松手或姿势丢失通常 280ms 取消；拇指内扣后进入「待发」，
  宽限升到 500ms（`PURPLE_CAST.readyGraceMs`），因为快速弹指常会丢 1~3 帧追踪；
- 前推（复用 `CHARGE.pushMinGrowth/pushMinRate/pushMinMs/pushMinSamples`）或**拇指外弹** → 发射。
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

- 茈模式开启时：`bluePulse`、苍蓄势、赫枪形/红场/评分全部旁路；茈模式关闭后恢复。
- 2s 冷却同时写 `purpleCooldownUntilMs` 与 `techCooldownUntilMs`，所以茈之后也不能立刻苍/赫。
- 拇指外弹只在**已有蓄势**且最近一次姿势是拇指内扣时算发射；拇指一直外张的枪形不会被当成弹指。
- 無量空処的手势同样是「两指 + 拇指内扣」，但它只在普通模式生效；茈模式开启时普通管线整体旁路，不会打架。

### 5.4 双手契印（无需按钮）

参考视频 `视频/虚式『茈』 2.mp4`：双手合拢、十指交叉扣住、两根食指并拢朝上、拇指内扣。
与单手茈互相独立，**不经过「茈」按钮**，也不分左右手。

**扫描结论**（同参数 MediaPipe，13 帧，见 TESTING §1.8）：

- 双手扣合时 MediaPipe **经常只认出一只手**（6 帧双手 / 6 帧单手 / 1 帧无手）；
- 判据只取双手帧里稳定的量：两只手 `indexUp=1`、至少一只手 `middleUp=1`、两只手 `thumbGapRatio<0.75`、
  `wristGap<2.2`、`tipGap<1.3`（后两者都除以平均掌长）；
- 因此**不要求连续双手帧**：`updateClaspDetection()` 在 400ms 内累积 ≥4 帧且持续 ≥120ms 即发动。

**状态机**：`claspCast = { startMs, phase:'build'|'burst', burstStartMs }`。

- build（0→900ms）：左蓝 / 右红粒子球在屏幕两侧长大；
- converge（900→1550ms）：两球向中心靠拢，带 1.8 世界单位的交叉偏移，加色混合自然呈紫；
- 1550ms：`impactClaspCast()` → `forceTechnique('purple', 1600ms)` + 中心点爆炸（与茈命中同源）；
- +1600ms 结束，`updateState('neutral', true)`；2s 冷却，且必须松开扣合姿势（400ms 无姿势）才能重发。

**视觉**：`CLASP_ORB_COUNT = 1600` ×2，蓝球（左）/ 红球（右），复用 `ORB_RINGS` 的环带结构；
`sideFraction 0.38`、`orbStartRadius 0.8 → orbRadius 6.5`、`crossOffset 1.8`；
build/converge 期间 `fieldIdle` 强制隐藏 20k 主场，只留两球 + 尘埃；爆发复用主粒子场。

**边界**：

- 触发要求双手；单手同形仍是無量空処（回归专门验证）；
- 双手分得很开（阈值外）不算契印，退回普通双手评分（两只手都比 void 时就是 void）；
- 契印候选/动画期间 void/red/blue 全压制，防止交错的手指被读成领域展开；
- 与茈按钮模式共存：契印开始时取消当前单手蓄势，动画期间旁路 `updatePurpleMode`。

## 6. 「赫」排斥 · 红场

### 6.1 手势与锚点

| 形态 | 判定 | 锚点 |
|---|---|---|
| 食指向上指 | `indexUp=1` 且其余三指收拢 | 食指指尖（lm8）沿指方向外推 |
| 枪形 | `indexUp+middleUp=1`、无名/小指收拢、`fingerGap<0.065`、`thumbGapRatio>0.75` | lm8/lm12 中点沿两指方向外推 |

外推距离 `min(9, max(3, 指节长*0.9))` 世界单位 ≈ **5~10cm**（即红点悬在指尖外一点）。
两形态切换或短暂丢手（<350ms）由 `lastRedSeenMs` 桥接，不断档。

### 6.2 跟随与渲染

- `redAnchor` → `redFollow`（阻尼 110ms）；每帧 `particles.position.set(redFollow.x, redFollow.y, 0)`，
  整个 20k 主粒子场（`getRed()` 目标形状）平移到手上。
- 红场展开时 `particles.rotation.z -= 0.1`/帧（持续旋转感）。
- 退场：无手后 `redFollow` 缓回屏幕中央淡出（`updateState` neutral 目标全零）。
- 苍构筑/释放期间赫分被清零（§3.3），两者不互相打断。

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
- `commitTransition('void')` 与其它技法一样起算 2s 冷却；`?tech=void` / T 轮换仍可手动预览。

### 7.3 视觉

- 复用原项目的 `getVoid(i)`：15% 点在半径 26 的白环上，其余 85% 在半径 30~120 的蓝色球壳里。
- `updateState('void')`：顶部状态名 `領域展開「無量空処」`、`glowColor '#00ffff'`、`baseBloomStrength 2.0`、
  `shakeIntensity 0.4`；主粒子场以慢速 `rotation.y += 0.005` 旋转。
- 没有额外的界面/按钮；与 O 键打开的独立开场页（`DomainExpansion-infintevoid/`）互不影响——
  但同一个动画现在被移植进了主场景，由「保持领域 3 秒」触发（见 §7.4）。

### 7.4 定格 3 秒 · 無量空処开场动画（cinematic）

主人要求：保持無量空処手势超过 3 秒自动进入旧 PR #7 的开场动画（去掉标题与「进入」按钮），
动画最后把中心换成 app 自己的白环粒子场。

- **触发**：`updateState` 进入 void 的那一帧写 `voidEnteredAtMs`（取 `lastFrameNowMs`，回归可走合成时钟）；
  `onResults` 在 `updateState` 之后调 `maybeTriggerVoidCinematic(nowMs)`——当前技法 void、
  `now - voidEnteredAtMs ≥ VOID_CINEMA.holdMs(3000)`、未在播放、本次保持没播过（`voidHoldAwarded`）、
  且不是 `?tech=` / T 预览（`forcedTech`）时启动。一次保持只播一次；松手后重新结印才会再播。
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
- **收尾**：黑幕 5200ms 起 1000ms 淡出，6200ms `finishVoidCinematic()` 恢复 UI、尘埃与不透明度；
  若手还保持着领域，领域场继续显示（`voidHoldAwarded` 阻止循环重播）。
- 阈值全在 `VOID_CINEMA`（holdMs/fadeInMs/formDelayMs/formMs/ringAtMs/ringFadeMs/blackFadeAtMs/blackFadeMs/endMs）；
  演示态 `&end=voidform|voidring` 把相位冻结在「成型中」/「换环中」便于截图。

## 8. 主粒子场与爆炸

- `COUNT = 20000`；`targetPositions/targetColors/targetSizes` 每帧由当前技法函数生成
  （`getShrine/getPurple/getVoid/.../getRed/getBlue...`），现场 `lerp 0.1` 追随 → 形状渐变过渡。
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
  （blue 3.0、red 2.5、purple 4.0、shrine 2.5、blackflash 5.0…），爆炸期间临时加；茈模式待机时 base 降到 0.35，让蓄势小球保持小而紧的紫光。
- **`fieldIdle`**：`currentTech==='neutral'（或契印 build 阶段） && now > neutralSettledAtMs && 无紫爆炸`，
  或「無量空処 cinematic 的星星阶段（`hideField`）」→ 主粒子场 `particles.visible=false`，
  且跳过 20k 的 lerp/上传/旋转/爆炸计算。
  `neutralSettledAtMs = now + 700`（进入 neutral 后留 700ms 淡出时间）。**这是最大的性能闸门**。
- fps 表：每 500ms 统计，D 面板 `fps` 行；低于 ~30 说明 GPU 吃紧（核显或浏览器退软渲）。
- 软件渲染（llvmpipe）实测只有 1~3fps——验收时可以截图、可以看逻辑，但不能以帧率论成败。

## 11. 界面层

- Win11 石墨 Acrylic（规范见 navi `skills/web-design.md`）：毛玻璃顶栏/侧栏、暖金 `#D8A657` 强调、噪点纹理。
- 顶栏三段式（`grid-template-columns: 1fr auto 1fr`）：左上 `#menu-btn` 开合左侧栏；正中央
  `#technique-name` 用 22px 纯白字显示当前技法**原版名**（`updateState` → `setTechniqueName()`）：
  術式順転「蒼」/ 術式反転「赫」/ 虚式「茈」/ 領域展開「伏魔御廚子」「無量空処」「嵌合暗翳庭」
  「坐殺博徒」「真贋相愛」「誅伏賜死」「時胞月宮殿」「自閉円頓裹」/ 黒閃 / 無為転変 /
  十劃呪法「比率」/ 八握剣異戒神将魔虚羅。`neutral` 时清空文字并加 `.empty`（opacity 0），
  不再显示「通常状態」；蓄势中可带「· 構築中 / 射出」后缀。
- 右上 `#purple-hint` 一行提示（「点击开启虚式「茈」枪指模式」）+ `#purple-mode-btn` 模式开关（§5）。
  开启时按钮外圈显示 2s 冷却进度、提示改为「已开启 · 点击关闭」；普通模式（含無量空処）时按钮静默。
  双手契印不经按钮，状态名在 build/converge/burst 期间都显示「虚式「茈」」，结束后清空。
- 左侧栏 `#left-rail` 是一整块亚克力面板（`collapsed` 类做 translateX/opacity 过渡），内部三个分区：
  **设置**（`#settings-list` 的 Win11 开关行：M/D/H/K/V/C 六项，点击即切换）、
  **手势指南**（`GUIDE_GOJO` / `GUIDE_ALL`）、**按键**（T/N/O 动作行）。H/K 分别收起指南/按键分区。
- `C` 纯净模式全部隐藏；`D` 面板显示 raw/smoothed 分数、`fps`、`charge`、`blueStages`、`bluePulse`、
  `gestureLock`、`cooldown`。
- 语音（all 模式）：Web Speech API，`"don't move"` → 誅伏賜死，`"run away"` → 镜头拉远
  （`zoomUntilMs`，camera.z 55→120）。Firefox 不支持；Google 在线识别国内可能不通。

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
| `BLUE_SEQ.stageWindowMs` | 苍时序段间隔 | 1200ms | 每段内完成 |
| `BLUE_SEQ.openFrames/fistFrames` | 苍帧数 | 3/2 | 帧 ≈ 33ms |
| `BLUE_SEQ.animMs/cooldownMs` | 释放演出/锁 | 2500/2000ms | |
| `CHARGE.*` | 释放判定 | 见 §4.5 | 灵敏度都在这里 |
| `CHARGE.pushMinGrowth / pushMinRate` | 前推闸门 | 0.24 / 1.7/s | 累计掌尺寸增幅 / 平均增速 |
| `CHARGE.pushMinMs / pushMinSamples` | 前推持续 | 110ms / 3 采样 | 滤掉单帧/两帧关键点跳变 |
| `CHARGE.growMs` | 球展开时长 | 2000ms | 越快越大越快 |
| `CHARGE.followTauMs` | 跟手阻尼 | 90ms | 大=拖尾更重 |
| `CHARGE.pathMs` | 拖尾路径 | 320ms | |
| `TECH_COOLDOWN_MS` | 全局冷却 | 2000ms | 任何术式触发后 |
| `PURPLE_CAST.*` | 茈模式 | 见 §5 | poseHold 3 帧 / grace 280ms / readyGrace 500ms / snapWindow 500ms / snapJump 0.15 / 跟手 90ms / 飞行 380ms / 冷却 2000ms |
| `PURPLE_ORB_COUNT` | 茈小球粒子数 | 700 | 8% 核 / 58% 环 / 34% 雾 |
| `CLASP_CAST.*` | 双手契印 | 见 §5.4 | 4 帧 / 120ms 累积、gap 400ms、`wristGap<2.2`、`tipGap<1.3`、build 900 / converge 650 / burst 1600 / 冷却 2000ms |
| `CLASP_ORB_COUNT` | 契印两球粒子数 | 1600 ×2 | 蓝球在左、红球在右 |
| `VOID_CINEMA` | 無量空処开场动画 | 见 §7.4 | hold 3000 / 黑幕 600 / 成型 400+2200 / 换环 4000+1000 / 收尾 5200+1000 / 全 6200ms |
| `VOID_STREAK_COUNT` | 开场流星数 | 1200 | 2400 顶点 LineSegments，中心 0、scale 0.8 |
| `TUNING.purpleExplosionDurationMs` | 紫爆时长 | 1600ms | 茈命中/紫场共用 |
| `TUNING.postExplosionNeutralMs` | 爆后 neutral 锁 | 400ms | 1600+400=2s |
| 枪形阈值（赫） | `fingerGap<0.065` `thumbGapRatio>0.75` | `computeFrameScores` 内 | |
| 無量空処阈值 | `fingerGap<0.075` `thumbGapRatio<0.75` | `computeHandScores` 内 | 与枪形靠拇指内/外张互斥 |
| 红点外推 | `min(9, max(3, 指节长*0.9))` | | ≈5~10cm |
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
- 语音依赖浏览器 Web Speech API。
- **無量空処的食中指交叉不被 MediaPipe 解析**（扫描见 §7.1）：不要试图用「交叉」判定，用拇指内扣；
  如果用户拇指只内扣到一半（`thumbGapRatio` 0.75~0.85），会落在赫枪形里，表现为展开领域失败。
- **双手契印依赖双手都被识别**：MediaPipe 在扣合姿势下经常把两只手并成一只（参考视频里约一半帧如此），
  短窗口累积能缓解，但如果整段只认出一只手就不会发动。手腕/食指尖间距阈值调大更敏感、调小更防误触。
- **两只靠得很近的 void 手可能被判成契印**：MediaPipe 解析不了「交叉」，所以判据里没有交叉；
  可调 `CLASP_CAST.wristGapMax/tipGapMax`，或接受这个近似。
- `logic-test.html` 是生成物，不入库；改了 `index.html` 之后必须重新生成。回归共 **67 项断言**（含苍/赫/茈/無量空処/無量空処开场动画/双手契印）。

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
| `updateBlueSequences` / `armBlueCharge` / `releaseBlueCharge` | 苍：时序 → 构筑 → 释放 |
| `fillOrbPositions` | 每帧重算 4000 点构筑球 |
| `fillPurpleOrbPositions` | 每帧重算 700 点茈小球（只有雾层拖尾） |
| `claspPoseInfo` / `updateClaspDetection` | 双手契印判定与短窗口累积 |
| `startClaspCast` / `updateClaspCast` / `impactClaspCast` | 契印动画状态机、中心紫色爆炸、2s 冷却 |
| `fillClaspOrbPositions` | 每帧重算左右两颗粒子球（1600 ×2） |
| `animate` | 每帧主循环：fps、主粒子场、构筑球、**尘埃**、爆炸、震动、合成器 |
| `getRed` 等 `get*` | 各技法的 20k 目标形状函数（all 模式 15 个） |
| `getVoid` | 無量空処的白环 + 蓝色球壳目标形状 |