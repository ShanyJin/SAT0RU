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

### 3. 五条悟模式（当前默认）

只认五条悟的四个术式，其他技法保留为备选（`?mode=all` 恢复全套手势，T 键可预览任何技法）。

## 手势表（五条悟模式）

| 手势 | 技法 |
|---|---|
| 食指伸出 | 術式反転「赫」 Reversal: Red |
| 双手张开 → 握拳 → 再张开 | 術式順転「蒼」 Lapse: Blue |
| 拇指+食指捏合 | 虚式「茈」 Hollow Purple（保持 1 秒后快速甩指 → 释放爆炸） |
| 食指+中指（单手或双手） | 领域展开·无量空处 Infinite Void |

- 「苍」是时序手势：张开→握拳、握拳→张开各需在 1.6 秒内完成；触发后蓝色演出脉冲约 2.2 秒
- 双手做「无量空处」时要求小指、无名指收拢（自然张开的手掌不算）
- 张开/握拳按「指尖到手腕距离 vs 指节到手腕距离」判定，不依赖手掌朝向
- D 调试面板会显示 `blueSeq: stage` 和 `hands: open/fist/?`，调阈值时看这里

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
| O | 新标签页打开「無量空処」开场动画（PR #7） |

录制技巧：`?tech=<技法名>` 可锁定单个技法（如 `?tech=divine`），页面跳过识别、直接演出，适合逐条拍素材。可用名：`neutral void shrine purple red blue blackflash shadowgarden transfiguration divine ratio idlegamble love sentence palace perfection`。

模式：默认五条悟模式（4 手势）；`?mode=all` 恢复全套 15 技法手势。

## 自测（无摄像头逻辑回归）

```
python3 tools/make-logic-test.py index.html logic-test.html tools/logic-test-driver.js
```

浏览器打开 `logic-test.html?logictest=1`：合成手部关键点喂进真实识别管线，左上角绿色 PASS / 红色 FAIL，逐项比对四个手势判定与「苍」的时序。改阈值后跑一遍再上线。

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
- 无摄像头/拒绝授权时 MediaPipe 会弹「Failed to acquire camera」，正常
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