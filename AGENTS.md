# AGENTS.md · SAT0RU

给新会话的第一页。读完这页就能上手；深水区在 `docs/`。

## 这是什么

主人的私人「咒术回战」手势粒子工具（含摄像头实拍合成），默认「五条悟模式」：

- **術式順転「蒼」**（引力）：张开→握拳→张开 → 构筑蓝色粒子球 → 用力前推/合掌释放（慢移、横挥只跟手）
- **術式反転「赫」**（排斥）：食指向上指，或枪形（食指+中指并拢、拇指外张）→ 红色场
- **領域展開「無量空処」**（领域）：食指+中指并拢/交叉、拇指**内扣** → 白环 + 蓝色星云场；
  保持手势维持，松手退场（主要靠拇指内扣与赫枪形区分）；**定格 >3 秒**自动播开场动画
  （旧 PR #7 的流星宇宙移植进主场景，删标题/按钮，结尾换成本作白环粒子场，一次保持只播一次）
- **虚式「茈」**（投射）：点右上角「茈」开关 → 苍/赫暂停；枪形、捏合或拇指内扣构筑紫色小球 →
  前推或「拇指内扣后快速向外弹开」发射到屏幕正中心爆开；松手取消；释放后 2 秒冷却
- **虚式「茈」· 双手契印**（无需按钮）：双手交叉扣住、食指朝上、拇指内扣 →
  左侧蓝球 + 右侧红球长大 → 向中心靠拢重叠 → 紫色大爆炸；单手同形仍是無量空処

单人拍摄/娱乐用，**不公开、不发布**。上游 reinesana/SAT0RU 无 LICENSE，本仓库只做本地提交。

## 跑起来

```bash
cd /home/lain/sat0ru
python3 tools/serve.py . 8787        # 或 systemctl --user start sat0ru
```

- 常驻服务：`sat0ru.service`（systemd 用户级，Linger 已开，随机启动）
  - 状态 `systemctl --user status sat0ru` · 日志 `journalctl --user -u sat0ru`
  - 只监听 `127.0.0.1:8787`；主人通过 SSH 隧道访问
- 浏览器只在 `localhost`/`https` 下给摄像头；无摄像头时 MediaPipe 会弹错（正常）
- 全部依赖在 `vendor/`，**零外网请求**；MIME 必须有 `.wasm→application/wasm`、`.data/.tflite→application/octet-stream`（`tools/serve.py` 已处理）

## 铁律

1. **只本地提交，绝不 push**（origin 是上游仓库，推送即污染别人的项目）。
2. **一切改动集中在 `index.html`**（单文件应用）；工具在 `tools/`；别拆散。
3. **改识别/阈值后必须跑 67 项无摄像头回归**（`docs/TESTING.md` 有完整命令），跑完再交付。
4. **视觉验收用 Xvfb + 有头 Firefox**（无头 Firefox 建不出 WebGL）；临时验证文件不留在仓库。
5. **镜头前工具**：改动要保证粒子运动可读、帧率优先（软件渲染下会掉到 1–3fps，只能定性判断）。
6. 密钥/口令一律不入库。

## 目录

| 路径 | 内容 |
|---|---|
| `index.html` | 全部逻辑：识别管线、苍/赫状态机、粒子系统、UI |
| `vendor/` | MediaPipe Hands、three.js r160、字体（本地化） |
| `tools/serve.py` | 静态服务器（wasm/data MIME） |
| `tools/make-logic-test.py` + `tools/logic-test-driver.js` | 无摄像头回归生成器/驱动（生成物 `logic-test.html` 不入库） |
| `DomainExpansion-infintevoid/` | 独立「無量空処」开场页（旧 PR #7） |
| `docs/ARCHITECTURE.md` | 技术细节：管线、状态机、参数表 |
| `docs/TESTING.md` | 回归 + 截图验收菜谱 |
| `docs/CHANGELOG.md` | 改造史（含每轮为什么改） |

## 去哪改（grep 锚点）

- 手势判定/阈值 → `handShape()`、`computeHandScores()`、`TUNING`、`CHARGE`、`BLUE_SEQ`
- 苍的形态 → `ORB_RINGS`、`fillOrbPositions()`、`animate()` 的 charge 块
- 赫的手势/锚点 → `gunForm`、`redAnchor`、`redFollow`
- 茈的模式/蓄势/发射/视觉 → `purpleMode`、`setPurpleMode`、`PURPLE_CAST`、`updatePurpleMode`、
  `purplePoseInfo`、`purpleWorldAnchor`、`firePurpleCharge`、`impactPurpleShot`、`purpleOrb`、
  `fillPurpleOrbPositions`、`updatePurpleButton`；拇指外弹看 `PURPLE_CAST.snapWindowMs/snapJump`、
  `thumbUnderAtMs/thumbUnderRatio`
- 茈的双手契印 → `CLASP_CAST`、`claspPoseInfo`、`updateClaspDetection`、`startClaspCast`、
  `updateClaspCast`、`impactClaspCast`、`claspCast`、`claspBlueOrb/claspRedOrb`、
  `fillClaspOrbPositions`；阈值 `wristGapMax/tipGapMax`，时间轴 `buildMs/convergeMs/burstMs`
- 無量空処的判定/视觉 → `computeHandScores()` 的 `void` 分支、`GOJO_GESTURES`、`getVoid()`；
  阈值 `fingerGap<0.075`、`thumbGapRatio<0.75`（拇指内扣，避开赫枪形的 >0.75）
- 無量空処定格 3 秒开场动画 → `VOID_CINEMA`、`VOID_STREAK_COUNT`、`startVoidCinematic`、
  `finishVoidCinematic`、`maybeTriggerVoidCinematic`、`updateVoidCinematic`、`voidCinematic`、
  `voidHoldAwarded`、`voidStreaks`、`#void-cinema`；触发门槛 `voidEnteredAtMs`（`updateState` 写入）、
  时间轴 `holdMs/fadeInMs/formDelayMs/formMs/ringAtMs/ringFadeMs/blackFadeAtMs/endMs`
- 环境尘埃（苍吸/赫斥）→ `DUST_COUNT` 种子 + `animate()` 的 dust 块
- 技法名/指南 → `updateState()` 的 `nameEl`、`GUIDE_GOJO`、`GUIDE_ALL`
- 顶栏 / 左侧栏 UI → `#menu-btn`、`#left-rail`、`#technique-name`、`#purple-hint`、
  `updateKeybindMenu()`、`setRailOpen()`、`setGuideVisibility()`、`setKeybindMenuVisibility()`
- 参数怎么调、为什么是现在这个值 → `docs/ARCHITECTURE.md` §参数速查

## 交付习惯

- 改完：重建回归 → 67/67 PASS →（涉及视觉就）截图验 → 提交 → 汇报做了什么/没动什么/风险点。
- 提交信息中文、`feat:/fix:` 前缀，末尾带 `Co-Authored-By` 行。