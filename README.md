# SAT0RU · Domain Expansion — 合并最终版

基于 [reinesana/SAT0RU](https://github.com/reinesana/SAT0RU) 的私人合并版：把仓库里 10 个未合并 PR 里有价值的部分全部手工并入了一个 `index.html`，另附 PR #7 的独立开场动画页。

> 仅个人拍摄/娱乐使用。原仓库未附 LICENSE，请勿公开分发。

## 相比原版改了什么

### 1. 识别引擎重写（解决「手势不灵」的根因）

原版是单帧硬判断：每一帧按 y 坐标猜手指伸没伸，猜错一次特效就跳一次。最终版改为 **分数制 + EMA 平滑**（PR #6 的思路，重写实现）：

- 每个手势每帧输出 0~1 分数，EMA 平滑（α=0.20）
- 进入阈值 0.75 / 退出阈值 0.50，防抖
- 切换技法需领先当前技法 0.12 且持续 300ms 以上
- 单帧抖动不再跳变，双手中优先级排定（双 fists > 捏合+平掌 > … > 单手中最高分）

手势规则本身也收紧了（吸收 PR #10）：四指「并拢/张开」按食指-中指指尖距离区分（<0.05 / >0.10），捏合会抑制其他手势，拇指外张、双指夹角都参与判定。阈值集中在 `index.html` 的 `computeHandScores()`，不合手型可直接微调。

### 2. 技法从 6 个扩到 15 个 + 语音

移植了 PR #2 / #3 / #9 / #13 的技法函数与配色、bloom 强度。

### 3. 五条悟模式（当前默认）· 启用「苍」「赫」

按主人上传的参考视频，「苍」做成可交互的两段式：手势完成 → **构筑**（蓝色粒子缩成旋转光点、跟着手走）→ **释放**（前甩 / 手出画面 / 丢失追踪 → 蓝色大爆炸）。构建期间慢速移动、旋转都不会打断。**赫**为单手食指向上指，指住即持续展开红色斥力、收手退场；苍构筑/释放期间赫不触发，两者互不打断。茈、无量空处及其余备选技法暂时不接手势——需要时 T 键可预览，`?mode=all` 恢复全套。

### 4. 界面：Win11 石墨 Acrylic + 摄像头合成

页面按 Win11 风格重做（石墨灰黑底、毛玻璃卡片、暖金强调色；规范见 navi `skills/web-design.md`）。摄像头画面全屏铺底并镜像，粒子特效以 `mix-blend-mode: screen` 叠在画面上，术式像是直接在你所在的房间里展开；顶栏显示当前技法，左侧是按键表与手势指南卡片。按 **C** 进入纯净模式隐藏全部 UI 方便录制；手部骨架只在 **D** 调试模式下绘制。

## 手势表（五条悟模式 · 当前启用苍 / 赫）

| 手势 | 流程 |
|---|---|
| 单手或双手：张开 → 握拳 → 再张开 | 构筑 → 跟手 → 甩手释放（苍1 / 苍2 统一为同一套逻辑） |
| 单手食指向上指，其余三指收拢 | 赫：指住即持续展开红色斥力场，收手退场；苍构筑/释放期间不触发 |

- **赫**：复用库里原有的食指规则（`handShape().indexUp` + 其余三指收拢）与 `getRed()` 粒子演出；EMA 平滑保证手指姿态过渡不会误触。构筑或释放苍期间赫被屏蔽（`frameScores.red = 0`），两个术式不会互相打断

- **构筑**：时序手势（张开 ≥3 帧 → 握拳 ≥2 帧 → 张开 ≥3 帧，每段须在 1.2 秒内完成，按手独立、单手双手都认）完成后**不立即绽放**——**手心**聚起一团蓝色光球：亮核周围是三条不同倾角的粒子环带（其中一条反向旋转，弧段留空隙，旋转一眼可辨），整团带阻尼跟手移动（拖动时拖在手掌后、停下再追上），光球还会随**手腕转动**加减旋转。慢速大范围拖动、转动腕子都不打断；双手做也只锚定先完成的那一只手
- **释放**：用力前甩（约 120ms 窗口平均手速 ≥1.6 单位/秒且要求真实位移，或手掌快速变大/推向镜头、窗口增速 ≥1.7/秒且增幅 ≥14%，连续约 0.1 秒确认）、**双手合掌**（两掌贴近约 ≤0.13）、手移出画面、追踪丢失超过 0.7 秒（刚快速移动过则 0.26 秒）→ 光球瞬间消失，**屏幕中央**绽放蓝色大爆炸
- **触发锁**：释放后演出约 2.5 秒，随后再锁 2.5 秒——期间任何手势（包括苍本身）都不触发
- **待机零粒子**：没有术式激活时画面完全不渲染粒子——主粒子场连整个对象一起隐藏（不占 GPU），构筑时只有光球粒子群在跑
- 构筑另有 15 秒安全上限（防止追踪卡死导致永远挂在构筑态）；手别标签翻转时会按邻近位置重新捕获
- 张开/握拳按「指尖到手腕距离 vs 指节到手腕距离」判定（>1.12 张开、<0.92 握拳），不依赖手掌朝向
- 赫/茈/无量空处等其余手势**暂时不接**（代码保留）：T 键可手动预览，「?mode=all」恢复全套
- D 调试面板会显示 `fps`、`charge`（含实时手速）、`blueStages`、`bluePulse`、`gestureLock`——阈值集中在 `CHARGE`、`BLUE_SEQ` 和 `handShape()`

<details>
<summary>备选：?mode=all 全套 15 技法手势</summary>

单手：捏合→Hollow Purple / 食指→Red / 食指+中指→Infinite Void / 四指并拢→Malevolent Shrine / 四指张开→Blue / 握拳→Black Flash / ILY→Authentic Mutual Love / 张开+拇指→Self Embodiment / 平掌中缝→Ratio。

双手：拇指相触→Idle Transfiguration / 双腕距 0.08~0.15→Shadow Garden / 双拳→Mahoraga / 捏合+平掌→Idle Death Gamble / 双手 ILY→Time Cell Moon Palace / 双手食指+中指→Malevolent Shrine。

语音（V，Chrome/Edge）："don't move"→Deadly Sentencing，"run away"→镜头拉远。
</details>

语音（按 V 开启，Chrome/Edge，Firefox 不支持）：

| 台词 | 效果 |
|---|---|
| "don't move" | 死刑宣判 Deadly Sentencing |
| "run away" | 镜头拉远（术式反转演出） |

## 按键

| 键 | 功能 |
|---|---|
| M | 音乐（`ost.mp3`） |
| D | 调试面板（各手势实时分数） |
| H | 手势指南开关 |
| V | 语音触发开关 |
| T | 轮换技法（每个 15 秒，录制预览用） |
| N | 回到手势识别模式 |
| K | 按键菜单开关 |
| C | 纯净模式：隐藏全部 UI（录制用） |
| O | 新标签页打开「無量空処」开场动画（PR #7） |

录制技巧：`?tech=<技法名>` 可锁定单个技法（如 `?tech=divine`），页面跳过识别、直接演出，适合逐条拍素材。可用名：`neutral void shrine purple red blue blackflash shadowgarden transfiguration divine ratio idlegamble love sentence palace perfection`。

模式：默认五条悟模式（当前「苍」「赫」响应手势）；`?mode=all` 恢复全套 15 技法手势。

## 自测（无摄像头逻辑回归）

```
python3 tools/make-logic-test.py index.html logic-test.html tools/logic-test-driver.js
```

浏览器打开 `logic-test.html?logictest=1`：合成手部关键点喂进真实识别管线，左上角绿色 PASS / 红色 FAIL（异常也会显示在面板里）。当前覆盖 19 项：赫 单手食指触发 / 收手退场 / 双手、苍1 构筑、大范围拖动不打断、转腕抖动不打断、构筑期指赫不打断、用力甩释放、动画中其他手势被忽略、冷却期赫不触发、苍2 双手构筑、丢追踪释放、合掌释放、只张开 / 握拳→张开不误触。改阈值后跑一遍再上线。视觉演示加 `&end=charge`（构筑粒子群）或 `&end=blue`（释放蓝场）。

## 运行

- 需要摄像头；浏览器只在 `localhost` / HTTPS 下允许取摄像头
- 任意静态服务器均可，需正确 MIME（`.wasm` → `application/wasm`，`.data` / `.tflite` → `application/octet-stream`），仓库外的 `serve.py` 已配置好：
  ```
  python3 serve.py /path/to/sat0ru-final 8787
  ```
  打开 `http://127.0.0.1:8787`
- 全部依赖已本地化在 `vendor/`（MediaPipe Hands、three.js、字体），**零外网请求**

## 目录

- `index.html` — 主页面（手势识别 + 粒子演出）
- `DomainExpansion-infintevoid/` — PR #7 独立开场页（手势 splash → 無量空処 → Enter）
- `vendor/` — MediaPipe / three.js / 字体
- `ost.mp3` — 原仓库音乐

## 已知限制

- MediaPipe Hands 是 2D 关键点 + 逐帧检测，极端光照、逆光、手太远仍会丢手；后续若还灵，升级路径是 MediaPipe Tasks `HandLandmarker`（新模型、世界坐标、时序更稳）
- 粒子用 screen 混合叠在摄像头上：画面极亮（比如对着窗户）时粒子会偏淡，属于预期；降低曝光或调高 bloom 可缓解
- 无摄像头/拒绝授权时 MediaPipe 会弹「Failed to acquire camera」，正常
- 「前甩」用 2D 手速和手掌尺寸增速做代理（没有深度）：逆光或追踪严重抖动时仍可能误判，调 `CHARGE.speedThresh / growthThresh / lostMs` 改灵敏度，`followTauMs / trailScale` 改拖拽跟手手感
- 若构筑粒子群看起来卡顿：按 D 看 `fps`，持续低于 ~30 多半是 GPU 吃紧（核显 / 浏览器退到软件渲染），关掉其他占 GPU 的标签页即可；渲染分辨率已封顶 1.5×DPR，待机/构筑时主粒子场完全隐藏以省 GPU
- 语音依赖 Web Speech API，走 Google 在线识别，国内网络可能不通

## 致谢

- 原项目：[reinesana/SAT0RU](https://github.com/reinesana/SAT0RU)
- 并入的 PR 作者：
  - #2 joseangelalejo — Blue / Black Flash
  - #3 Archit Sehgal — Shadow Garden / Ratio / Idle Transfiguration 等
  - #6 Ethanc143 — Hollow Purple 平滑与释放（识别引擎基础）
  - #7 VarunKumar-05 — 独立「無量空処」开场动画
  - #9 Hoochymoochy — 多技法扩展
  - #10 Security__geek — 手势判定逻辑修复思路
  - #13 Arpith Krishna R — Mahoraga
- #1 / #4 / #5 为 README 修正类 PR，内容已被本文件取代