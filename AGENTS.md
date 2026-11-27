# AGENTS.md · 五条悟术式模拟（SAT0RU）

给新会话的第一页。读完这页就能上手；深水区在 `docs/`。

## 这是什么

主人的私人「咒术回战」手势粒子工具（含摄像头实拍合成），最终版，默认「五条悟模式」。站点更名 **五条悟术式模拟**（英文界面 *Gojo Satoru Cursed Technique Simulator*），副标题 **咒术回战手势触发模拟**，中英双语、默认中文；**技法名与术式字幕永远保持繁体中文原名**。启动说明首页列出推荐浏览器与性能提醒：

- **術式順転「蒼」**（引力）：**四指完全伸直的张开手掌**对着镜头保持 2 秒 → 构筑蓝色粒子球 →
  用力前推 / **握拳（2 帧）** / **快速甩出** / 合掌释放（慢移、横挥只跟手；弯着手指的手不算张开）；
  构筑成型再满 2 秒才播苍语音（`audio/blue.mp3`，每次构筑一次；提前释放/取消不播）
- **術式反転「赫」**（排斥）：食指向上指，或枪形（食指+中指并拢、拇指外张）→ 红色场；
  **进入瞬间是「激发」**：指尖枪口闪光 + 沿手指方向（手腕→指尖）射出细长红色枪矛 + 前向冲击锥，
  红球压缩回弹并后坐——向前打出去、不是炸开；**收手是原地「燃尽」**：红球停在原位缩小淡出、余烬下落消散；
  持续场是独立**小红球**（`RED_BALL`，1500 颗、半径 4.6 + 少量外圈火星），共享 2 万颗大场在赫全程熄灯
  （不插值、不上传属性，性能优先）；**结束后不回中**——打到哪里就停在哪里；
  任一赫手势保持 1 秒随机播放一段赫语音（`audio/he-1|2.mp3`，每次保持一次）
- **領域展開「無量空処」**（领域）：**只用单手**，食指+中指并拢/交叉、拇指**内扣** → 白环 + 蓝色星云场；
  保持手势维持，松手退场（主要靠拇指内扣与赫枪形区分）；比出满 1 秒播单人版语音；
  **定格 >3 秒**自动播开场动画（旧 PR #7 的流星宇宙移植进主场景，删标题/按钮，结尾换成本作白环粒子场；
  环出现后黑幕再保持 10 秒，随后黑幕先淡出、背景透明环还在，最后环淡出；一次保持只播一次）；
  左侧栏「长时间无量空处」开关打开后：手势满 1 秒：展开领域并**立即播 31 秒长语音**；
  **原地保持 8 秒**才进入 ~34 秒长动画（黑幕淡入也放慢到 1.5 秒），语音在等待期间继续放、先结束；
  松手则 8 秒等待从头计（语音不中断）
- **虚式「茈」**（投射）：点右上角「茈」开关 → 苍/赫暂停（双手契印也归这个开关）；枪形、捏合或拇指内扣**稳定保持约 0.25 秒**才构筑紫色小球 →
  前推或「拇指内扣后快速向外弹开」发射到屏幕正中心爆开，发射瞬间播茈的短语音（`audio/purple-short.mp3`）；
  松手取消；释放后 2 秒冷却
- **虚式「茈」· 双手契印**（在右上角「茈」开关下，约 23 秒长动画）：一手张开、**四指全部朝上**、拇指内扣，另一手扣住它 →
  **右侧蓝球**从中球长到**半个屏幕宽**（1.5 秒）→ **左侧红球**再用 2.5 秒长到对称 →
  两球 3 秒靠拢、压缩重叠 → **紫色星系漩涡** 6 秒（三臂星核差速旋转 + 三道倾斜陀螺环进动 + 周期性冲击波）
  然后碰撞回弹 7 秒 → 第 20 秒紫色大爆炸 → 23 秒收尾；
  **发动 0.5 秒后自动播契印语音**（`audio/purple-clasp.mp3`，21.9 秒，比动画先结束）；
  契印**只在「茈」开关打开时成立**；MediaPipe 常只识别到张开的那只手，**单手也认**但要多保持
  （`claspSoloInfo`，`soloFrames/soloHoldMs`）；無量空処始终**单手**，四指朝上的契印姿势与领域手型
  互不误开；同一只手被识别成两只由 handedness 标签 + 腕距 + 腕相对形状差（`minShapeDelta`）否决
- **首次进入**：五页弹窗（欢迎 + 蒼/赫/茈/無量空処 教程，图在 `assets/tutorial/` 的 WebP，按页懒加载）；
  欢迎页右上角有 **中文 / English** 语言按钮，正文有「推荐环境」「性能提醒」两张卡片，写明原作作者、
  原项目、改版作者、隐私（本地推理、不上传摄像头画面）与素材来源/联系邮箱声明；关掉弹窗后
  **还要点顶部栏「启动」按钮**才会请求摄像头（默认不建 MediaPipe、不开摄像头）
- **顶栏**：左上菜单按钮旁是**「启动」按钮**（唯一的摄像头门禁；按 `cameraStatus` 显示
  启动/启动中/等待追踪/追踪中/追踪异常/启动失败，窄屏隐藏标题、只留图标+短标签）
- **左侧栏**：顶部分「模式与音频 / 指南 / 关于」三个小菜单（点击切换，H 切指南）；「模式与音频」里是
  设置开关（调试 D / 指南 H / **术式语音 V** / 长时间无量空处 L / **自定义无量空处 ★**）与
  「音频」区块：**9 个本地音频**各一行，点击播放/停止，同一时间只播一条；**术式语音开关是手势语音的总闸**
  （默认开，关掉后苍/赫/無量空処/茈/契印全部静音），音频库手动点击不受影响；失败 / 校训两条只手动点击、不接任何手势
- **自定义无量空处**（彩蛋，默认关闭）：设置里选版本 1/2/3；打开后下方有「说明 ▾」小箭头、
  版本 3 的 B 站链接输入框（粘贴 `bilibili.com/video/BV...`，可带 `?p=`，存 localStorage）；
  短版定格动画播到「穿梭」、白环出现前切断并全屏用 B 站官方 iframe 播放视频，Esc/关闭退出；
  这是唯一可能发起的外部请求，长版动画不触发，版本 3 没有链接时也不切断

单人拍摄/娱乐用，**不公开、不发布**。上游 reinesana/SAT0RU 无 LICENSE，本仓库只做本地提交。
其余上游技法（伏魔御廚子/嵌合暗翳庭/…）与「?mode=all」已按主人要求全部删除，只保留上面这些。

## 跑起来

```bash
cd /home/lain/sat0ru
python3 tools/serve.py . 8787        # 或 systemctl --user start sat0ru
```

- 常驻服务：`sat0ru.service`（systemd 用户级，Linger 已开，随机启动）
  - 状态 `systemctl --user status sat0ru` · 日志 `journalctl --user -u sat0ru`
  - 只监听 `127.0.0.1:8787`；主人通过 SSH 隧道访问
- 浏览器只在 `localhost`/`https` 下给摄像头；无摄像头时 MediaPipe 会弹错（正常）
- 手机访问也必须 HTTPS，且 `serve.py` 只绑 127.0.0.1：推荐 `tailscale serve --bg 8787`，手机开
  `https://lain.tailc73ce5.ts.net`（tailnet 内；首次要下载 ~23MB 本地模型，等顶部「启动」按钮变成「追踪中」）
- 全部依赖在 `vendor/`，**零外网请求**；MIME 必须有 `.wasm→application/wasm`、`.data/.tflite→application/octet-stream`（`tools/serve.py` 已处理）
- `tools/serve.py` 默认 gzip + 缓存头：文本/模型压缩结果缓存在内存，`/vendor/`、`/assets/`、`/audio/` 为 immutable，HTML 为 `no-cache`；改了 `index.html` 刷新即生效，改 `serve.py` 后要 `systemctl --user restart sat0ru`

## 铁律

1. **只本地提交，绝不 push**（origin 是上游仓库，推送即污染别人的项目）。
2. **一切改动集中在 `index.html`**（单文件应用）；工具在 `tools/`；别拆散。
3. **改识别/阈值后必须跑全量无摄像头回归（当前 295 项）**（`docs/TESTING.md` 有完整命令），跑完再交付。
4. **视觉验收用 Xvfb + 有头 Firefox**（无头 Firefox 建不出 WebGL）；临时验证文件不留在仓库。
5. **镜头前工具**：改动要保证粒子运动可读、帧率优先（软件渲染下会掉到 1–3fps，只能定性判断）。
6. 密钥/口令一律不入库。

## 目录

| 路径 | 内容 |
|---|---|
| `index.html` | 全部逻辑：识别管线、苍/赫状态机、粒子系统、UI |
| `vendor/` | MediaPipe Hands、three.js r160、字体（本地化） |
| `tools/serve.py` | 静态服务器（wasm/data MIME、gzip、缓存头） |
| `tools/make-logic-test.py` + `tools/logic-test-driver.js` | 无摄像头回归生成器/驱动（生成物 `logic-test.html` 不入库） |
| `audio/` | 本地语音 9 条：苍 `blue.mp3`、赫 `he-1/2.mp3`、无量空处单人 `void.mp3`、长版 `void-long.mp3`、茈短语音 `purple-short.mp3`、双手契印 `purple-clasp.mp3`（契印发动 0.5 秒后自动播）、失败 `fail.mp3`、校训 `creed.mp3`（后两条只在音频库手动点击）；零外网请求 |
| `assets/tutorial/` | 首次进入教程的 4 张本地 WebP：`blue/red/purple/void.webp`（900px 长边，按页懒加载） |
| `docs/archive/domain-expansion-pr7/` | 独立「無量空処」开场页（旧 PR #7，不接入 UI，留档） |
| `docs/ARCHITECTURE.md` | 技术细节：管线、状态机、参数表 |
| `docs/TESTING.md` | 回归 + 截图验收菜谱 |
| `docs/CHANGELOG.md` | 改造史（含每轮为什么改） |

## 去哪改（grep 锚点）

- 手势判定/阈值 → `handShape()`、`computeHandScores()`、`TUNING`、`CHARGE`、`BLUE_SEQ`；
  张开手掌的严格判定 → `handShape()` 里的 `straightFinger`（四指链条伸展比 ≥0.90 + 指节夹角 <41°）
- 苍的形态 → `ORB_RINGS`、`fillOrbPositions()`、`animate()` 的 charge 块；持掌时长 → `BLUE_SEQ.holdMs`（2 秒）、
  构筑后语音延迟 → `BLUE_SEQ.voiceDelayMs`（2 秒）；释放分支 → `CHARGE.fistFrames`（握拳）、
  `CHARGE.flingMinSpeed/flingMinDisplacement/flingRunFrames/flingMaxSampleGapMs`（甩出）、`updateBlueCharge` 的 fling 块
- 赫的手势/锚点 → `gunForm`、`redAnchor`（含 `aimX/aimY` 手腕→指尖方向）、`redFollow`；语音 → `VOICE_HOLD_MS`、`updateTechniqueVoices`、
  `redEnteredAtMs`（`updateState` 写入）、`audio/he-1|2.mp3`
- 赫的激发/燃尽 → `RED_CAST`、`redCast`、`redBurn`、`redCastLayout`、`redBurnLayout`、`startRedCast`、`startRedBurn`、
  `updateRedCastFx`、`fillRedLancePositions`、`fillRedFlashPositions`、`fillRedConePositions`、`fillRedBurnPositions`、
  `redLance/redFlash/redCone/redEmber`（复用 `createClaspPoints`）；演示态 `&end=redcast|redburn&age=<ms>`
- 音频库/语音 → `AUDIO_TRACKS`、`playAudioClip`、`toggleAudioClip`、`stopAudioClip`、`primeAudio`、
  `updateTechniqueVoices`、`blueCharge.startedMs`（苍语音计时）、`audioPlayCounts`、`buildAudioLibrary`、
  `#rail-panel-main` 的 `#audio-list`/`.audio-row`、`updateAudioRowState`；触发阈值 `VOICE_HOLD_MS`
  （赫/無量空処 1 秒）、`BLUE_SEQ.voiceDelayMs`（苍构筑后 2 秒）
- 术式字幕（繁中技名跟语音走）→ `#technique-subtitle`、`SUBTITLE_CALL_OUTS`、`SUBTITLE_FALLBACK_MS`、
  `showTechniqueSubtitle`、`subtitleTiming`、`endTechniqueSubtitleWithin`、`cueDomainSubtitleBlackCut`、
  `finishTechniqueSubtitle`（`playAudioClip` 的 `play().then` 里启动）、`window.__techniqueSubtitleState()`
- 术式语音总闸 → `voiceEnabled`（默认开）、`setVoiceEnabled`、`playAudioClip(key, manual)` 的
  `!voiceEnabled && !manual` 门控、`toggleAudioClip` 传 `manual=true`（音频库手动点击永远能播）
- 长时间无量空处 → `VOID_CINEMA_LONG`（`holdMs/startDelayMs/fadeInMs/audioMs/endMs`）、`voidLongMode`、`setVoidLongMode`、
  `maybeTriggerVoidCinematic`、`startVoidCinematic(nowMs, true)`、`#settings-list` 的 `voidlong` 行（L 键）；
  正常时长轴仍是 `VOID_CINEMA`
- 茈的模式/蓄势/发射/视觉 → `purpleMode`、`setPurpleMode`、`PURPLE_CAST`（`poseHoldFrames/poseHoldMs/armMs`、
  `pushMinSamples/pushMinMs/pushMinGrowth/pushMinRate`）、`updatePurpleMode`、`updatePushTracker(t,size,ms,cfg)`、
  `purplePoseInfo`、`purpleWorldAnchor`、`firePurpleCharge`、`impactPurpleShot`、`purpleOrb`、
  `fillPurpleOrbPositions`、`updatePurpleButton`；拇指外弹看 `PURPLE_CAST.snapWindowMs/snapJump`、
  `thumbUnderAtMs/thumbUnderRatio`
- 茈的双手契印（长动画，仅「茈」开关打开时）→ `CLASP_CAST`、`claspOpenHandShape`、`claspPoseInfo`、`claspSoloInfo`、
  `claspShapeDelta`、`updateClaspDetection`、`startClaspCast`、
  `updateClaspCast`、`impactClaspCast`、`claspCast`、`claspBlueOrb/claspRedOrb`、`claspOrbLayout`、
  `fillClaspOrbPositions`、`claspCore/claspRingA/B/C/claspShock`、`createClaspCore/createClaspRing/createClaspShock`、
  `fillClaspCorePositions`、`fillClaspRingPositions`、`fillClaspShockPositions`、`claspVortexLayout`、
  `claspCollisionPulse`、`claspBloomStrength`；阈值 `wristGapMax/minWristGap/minShapeDelta`、
  `minFrames/holdMs`（双手）与 `soloFrames/soloHoldMs`（单手）、`handsAreDistinct`（handedness 标签）、
  `claspRealPoseFrames/claspPairFrames`（≥2 帧真双手姿势）；
  语音延迟 `voiceDelayMs`（0.5 秒），
  时间轴 `blueGrowMs/redStartMs/redGrowMs/convergeMs/vortexMs/collideMs/burstMs/fadeMs`
  （`redEndMs/convergeEndMs/collideStartMs/explodeAtMs/burstEndMs/endMs` 为 getter 派生的绝对时刻）；
  漩涡参数 `vortexRadiusFraction/vortexSpin/ringRadiusFractions/ringTilts/ringSpins/shockMaxFraction/shockMs`
- 無量空処的判定/视觉 → `computeHandScores()` 的 `void` 分支、`GOJO_GESTURES`、`getVoid()`；
  阈值 `fingerGap<0.075`、`thumbGapRatio<0.75`（拇指内扣，避开赫枪形的 >0.75）
- 無量空処定格 3 秒开场动画 → `VOID_CINEMA`、`VOID_STREAK_COUNT`、`startVoidCinematic`、
  `finishVoidCinematic`、`maybeTriggerVoidCinematic`、`updateVoidCinematic`、`voidCinematic`、
  `voidHoldAwarded`、`voidStreaks`、`#void-cinema`；触发门槛 `voidEnteredAtMs`（`updateState` 写入）、
  时间轴 `holdMs/fadeInMs/formDelayMs/formMs/ringAtMs/ringFadeMs/blackHoldMs/blackFadeMs/ringOutDelayMs/ringOutMs`
  （`blackFadeAtMs/ringOutAtMs/endMs` 为 getter 派生的绝对时刻）
- 环境尘埃（苍吸/赫斥）→ `DUST_COUNT` 种子 + `animate()` 的 dust 块
- 技法名/指南/关于 → `updateState()` 的 `nameEl`、`getGuide()`（`GUIDE_GOJO_ZH` / `GUIDE_GOJO_EN`）、`#about-body`（原作作者/素材鸣谢/B 站视频链接/mailto 邮箱）
- 中英双语 → 早期 classic 脚本里的 `SAT0RU_I18N`、`sat0ruT`、`sat0ruApplyStaticI18n`、`sat0ruSetLang`、
  `window.SAT0RU_LANG`；module 里的 `t()`、`setLanguage()`、`syncLangButtons()`、`#intro-lang`、`#lang-row`、
  `data-i18n` / `data-i18n-html` / `data-i18n-attr`、`audioLabel()`、`describeVoidEggCustom()`、
  `sat0ru.language`（localStorage）。**不译**：`updateState` 的技法名、`SUBTITLE_CALL_OUTS`、`INTRO_TECH_LABELS`、控制台日志
- 加载与缓存 → `loadMediaPipeScripts()`、`MEDIA_PIPE_SCRIPTS`、`prefetchMediaPipeScripts()`、`LONG_AUDIO_KEYS`、
  `ensureLongAudio()`、`primeAudio()`、`prefetchLongAudio()`、`runWhenIdle()`、`loadIntroImage()`、教程图 `data-src`、
  `window.__sat0ruAudioState()`、`powerPreference`、`renderRafId`（隐藏标签页暂停）、`tools/serve.py` 的 gzip/缓存头
- 顶栏 / 左侧栏 UI → `#menu-btn`、`#start-btn`、`#start-btn-label`、`updateStartButton()`、`#left-rail`、`#technique-name`、`#purple-hint`、`.rail-tab`/`.rail-panel`
  （`#rail-panel-main/guide/about`）、`#egg-panel`、`#egg-info-toggle`、`#egg-custom-url`、`setRailTab()`、`toggleGuideTab()`、`railTab`、
  `updateKeybindMenu()`（设置开关 D/H/V/L/自定义无量空处）、`updateEggPanel()`、`setRailOpen()`
- 启动门禁/首次教程 → `cameraEnabled`、`cameraStarted`、`startCameraPipeline`、`stopCameraPipeline`、
  `updateStartButton`、`#start-btn`、`INTRO_PAGES`、`showIntroPage`、`finishIntro`、`initIntro`、`introDone`、`#intro-modal`、`#settings-list`
- 自定义无量空处 → `voidEggEnabled`、`voidEggVersion`、`VOID_EGG_VIDEOS`、`voidEggCustom`、`eggCustomDraft`、
  `parseBilibiliShareUrl`、`hasVoidEggVideo`、`saveVoidEggCustom`、`buildVoidEggUrl`、`openVoidEgg`、
  `closeVoidEgg`、`updateEggPanel`、`#egg-panel`、`#egg-info`、`#egg-custom`、`#void-egg`、`#void-egg-frame`、
  `sat0ru.voidEggCustom`（localStorage）、`maybeTriggerVoidCinematic` 里的 `ringAtMs` 切点
- 参数怎么调、为什么是现在这个值 → `docs/ARCHITECTURE.md` §参数速查

## 交付习惯

- 改完：重建回归 → 295/295 PASS →（涉及视觉就）截图验 → 提交 → 汇报做了什么/没动什么/风险点。
- 提交信息中文、`feat:/fix:` 前缀，末尾带 `Co-Authored-By` 行。