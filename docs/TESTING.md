# 测试与验收 · SAT0RU

两条线：**逻辑靠无摄像头回归**（合成关键点喂真实管线，93 项 PASS/FAIL），
**视觉靠 Xvfb + 有头 Firefox 截图**（软件渲染只能定性）。改任何识别/阈值/状态机前后都跑第一线；
动了粒子/配色再跑第二线。

## 1. 无摄像头逻辑回归

### 1.1 为什么可行

驱动不碰摄像头：直接构造 MediaPipe 格式的 `multiHandLandmarks`（归一化 21 点），
每帧调用**真实的** `computeFrameScores → smoothScores → pickGestureFromScores → updateState` 链路。
所以阈值、EMA、状态机、冷却全部被测到，只是绕过了「摄像头 → 关键点」这一段。

### 1.2 生成与运行

```bash
cd /home/lain/sat0ru
python3 tools/make-logic-test.py index.html logic-test.html tools/logic-test-driver.js
```

生成器把驱动注入 `index.html` 的副本（同时覆写 `window.alert`，否则无摄像头时 MediaPipe 的
「Failed to acquire camera」模态框会卡死页面 JS），产物 `logic-test.html` **不入库**。

浏览器打开 `http://127.0.0.1:8787/logic-test.html?logictest=1`：
左上角绿色 `LOGICTEST PASS`（全过）或红色 `FAIL`（含逐项明细和异常堆栈）。

### 1.3 驱动结构（`tools/logic-test-driver.js`）

- 手型库：`OPEN`（21 点基准姿态）、`CURL`（各指收拢坐标）、`buildPose(curled[], pinch)`；
  `mkHand(wx, wy, pts)` 平移、`twoHands()` 双手。
- 常用姿势：`open1/fist1/red1`（食指指）、`gun1`（枪形）、`RED2/OPEN2/FIST2`（双手）、`scaledOpen1`（手掌缩放→前推）。
- `runFrame(hands, t)`：模拟一帧完整管线（含 purple flick 旁路与 `pendingBlueInstant`）；
  `step(hands, n)` 连续 n 帧（每帧 +33ms）；`drift(x0, dx, n)` 水平平移模拟拖动。
- `mark(name, expect)` / `markState(...)` 记录 `当前技法 == 期望`。

### 1.4 93 项断言（按顺序）

1. neutral 初始
2. 做枪形的自然动作不武装苍（旧「张开→收指→张开」误触的回归）
3. 同一动作留下的黒閃蓄势被随后的开掌放掉（不留残余）
4. 赫 枪形触发
5. 赫 枪形收手退场
6. 赫 食指指触发
7. 两形态互换不断档
8. 短暂丢手（8 帧）桥接仍红
9. 收手退场
10. 2s 后赫恢复（旧的 8s 锁已废）
11. 2s 冷却内重指不触发
12. 2s 冷却结束赫恢复
13. 冷却期回摆不误触苍
14. 冷却结束双手指赫恢复
15. 赫 语音：保持不足 2s 不播
16. 赫 语音：保持超过 2s 播一次（`redVoiceCount +1`）
17. 赫 语音：随机挑的是本地 `audio/he-1|2.mp3`
18. 赫 语音：同一次保持只播一次
19. 赫 语音：枪形保持 2s 同样触发
20. 黒閃：张开→5 秒内快速握拳 → 武装蓄势（`bfCharge` 非空）
21. 蓄势本身不占技法名（`currentTech` 仍 neutral）
22. 握拳小幅抖动保持蓄势、不误判前推
23. 单帧「开掌」误读不取消蓄势（需持续 100ms）
24. 持续开掌取消蓄势（不爆发）
25. 横向甩臂（一边横扫一边长大、横向漂移 >1.1/s）不触发
26. 横向甩臂后蓄势仍在
27. 蓄势期间指赫：不触发赫（其它术式全锁）
28. 蓄势期间摆赫姿势也不丢蓄势
29. 该蓄势最终由持续开掌放掉
30. 握拳向镜头前推（掌尺寸持续增长）→ 爆发
31. 爆发期间顶部技法名 = 黒閃
32. 爆发期间 2D 叠层激活（`bfOverlayActiveUntilMs`）
33. 爆发期间其它手势抢不走画面（枪形仍是黒閃）
34. 2s 冷却内「开掌→握拳」不再武装
35. 冷却结束（且开掌解锁后）同样动作可再次武装
36. 苍：短持掌（~1.3s）不武装
37. 苍：持掌 3 秒武装构筑球（不立即绽放，`currentTech` 仍 neutral）
38. 慢速拖动 ~0.36/s 不打断，球只跟手
39. 手指/掌尺寸抖动不打断（交替 ±8% 缩放 + 3 帧 +24% 关键点跳变）
40. 快速横向挥手 ~1.8/s 不打断
41. 构筑期指赫不打断
42. 持续前推释放（掌尺寸 1.0→1.5，连续增长 ≥110ms、累计 ≥24%，blue）
43. 动画中其他手势被忽略
44. 冷却期赫被忽略
45. 苍：双手持掌构筑
46. 丢追踪释放（丢手 34 帧 ≈1.1s 后，blue）
47. 合掌构筑武装（双手持掌 3s）
48. 合掌释放（blue）
49. 只张开 20 帧不触发（<3s）
50. 握拳→张开不触发
51. 赫枪形仍是赫、不是無量空処（拇指外张）
52. 無量空処手势触发（两指举起 + 拇指内扣）
53. 無量空処保持（手势持续）
54. 無量空処松手退场
55. 右上「茈」按钮存在
56. 点击「茈」开启模式（`purpleMode` + `aria-pressed=true`）
57. 再点关闭（`purpleMode=false` + `aria-pressed=false`）
58. 茈模式枪形蓄势出小球（`purpleCharge` 非空）
59. 茈模式枪形不触发赫（`currentTech` 仍 neutral）
60. 姿势丢失 280ms 后蓄势取消（`purpleCharge=null`）
61. 捏合蓄势出小球
62. 拇指内扣的待发姿势本身也能蓄势出小球
63. 前推发射（`purpleShot` 非空）
64. 飞行 380ms 后命中，`currentTech=purple`
65. 命中后 2s 冷却内不能再蓄势
66. 2s 冷却结束后恢复蓄势
67. 拇指在下、指尖上挑的 flick 发射（旧路径仍保留）
68. 重新蓄势（为拇指外弹用例准备）
69. 拇指**慢慢**外张（~660ms）不发射，蓄势保持
70. 拇指内扣 → 快速外张（指尖不动）发射
71. 同样外弹但中途丢 2 帧追踪：蓄势不取消，手重现为外张时仍发射
72. 单手摆出与契印相同的两指+拇指内扣：仍是 void，不触发契印动画
73. 双手扣合（食指尖靠近）触发双手契印（`claspCast` 非空）
74. 契印姿势不会被判成 void（`currentTech` 保持 neutral）
75. 快进过 build+converge：进入爆发阶段（`claspCast.phase='burst'`）
76. 爆发真的触发紫色爆炸（`purpleExplosionUntilMs > now`）
77. 爆发 1600ms 后契印状态结束（`claspCast=null`）
78. 结束后仍保持扣合姿势：冷却+姿势未释放，不能立刻重发
79. 松开姿势并跨过 2s 冷却后再扣合：可以再次发动
80. 双手扣合姿势但相距很远：不算契印（不退化成双手 void 误触发）
81. 双手相距很远的同形姿势仍按普通评分展开 void
82. 無量空処保持不足 3 秒：不触发开场动画
83. 保持超过 3 秒：自动进入开场动画（`voidCinematic` 非空）
84. 开场动画隐藏 UI（`body.void-cinema`）
85. 快进到换环时刻：20k 领域场重新显示
86. 换环时领域场透明度淡入（>0.4）
87. 换环时星星淡出（opacity <0.7）
88. 长黑幕结束前：环全亮、黑幕仍全黑（opacity >0.95）
89. 黑幕淡出完成后：背景透明（overlay <0.05）而环仍全亮（>0.95）
90. 环收尾段：环正在淡出（0.2 < opacity < 0.8）
91. 动画结束恢复 UI（`body` 去掉 `void-cinema`）
92. 动画结束后仍保持手势：不循环重播
93. 松手后重新结印并保持 3 秒：可以再次播放

### 1.5 加用例的坑

- **2 秒冷却**：赫/茈/無量空処/黒閃爆发触发后要空步 drain ~60~80 帧（×33ms ≈ 2~2.6s）；苍释放是 2.5s 演出 + 2s 锁，
  需要 ~140~180 帧。现有用例习惯多 drain 到 180~260 帧，稳。参考红冷却的 9→10→11 节奏。
- **EMA 与帧数**：进入要 smoothed ≥0.75，姿势切换给足 20~25 帧；`redFormSeen` 这类「立即清零」的逻辑
  在单帧上生效，不需要长窗口。
- **苍 = 持掌 3 秒**：`armBlue1` 现在是 `step(open1(x), 100)`（3 帧起算 + 3000ms ≈ 94 帧，留余量）。
  持掌不足的负例用 40 帧；中途插 2 帧 `fist1` 会打断计时，但**同时会武装黒閃**，随后必须开掌把它放掉
  （驱动里就是这么串的）。冷却期内的开掌帧会被 `othersOwnHands` 重置，不会偷偷攒苍。
- **黒閃**：`armBlackFlash1` = 张开 8 帧 + 握拳 6 帧。蓄势后握拳静止/小幅抖动（±5%）不得爆发；
  爆发用 `scaledFist1` 逐帧 +7% 增长（第 4 帧左右满足 100ms/3 采样/19%/1.3/s 的闸门）。
  **横向甩臂负例**用 `scaledFist1(0.5 + i*0.055, …, 1 + i*0.06)`：尺寸同样在长，但横向漂移 ~1.67/s
  超过 `punchMaxDrift 1.1/s`，不得爆发。取消蓄势要「持续开掌 ≥100ms」（约 4 帧），
  单帧开掌只当运动模糊。爆发后 `bfPoseReleaseRequired` 要求先开掌才能重新武装，冷却期内的开掌帧不会累积链条
  ——写「冷却拦截」用例时把「开掌→握拳」放在冷却结束前即可。
- **赫语音**：`updateRedVoice` 跟着 `runFrame` 走合成时钟；断言数「次数」而不是听声音（无手势的测试页里
  `play()` 会被浏览器拒绝，驱动只统计尝试播放次数与 `redVoiceLastSrc`）。保持 2s = 进入赫后再 60+ 帧，
  断「不足 2s」要给 <60 帧；每次松开手势后再结印才会再播。
- **前推链**：`scaledOpen1` / `scaledGun1` 的缩放必须逐帧递增且持续 ≥110ms、累计 ≥24% 才会释放；
  中间一帧不涨即断链。写「应该释放」的用例时给足 5 帧以上；写「不该释放」的用例时，
  一个 2~3 帧的尺寸跳变即可复现旧版误触。
- **拇指外弹**：用 `thumbUnder1`（拇指内扣）+ `gun1`（拇指外张）模拟跳变；`thumbLerp1` 做慢速外张的
  反例。跳变必须在 `PURPLE_CAST.snapWindowMs`（500ms）内且 `thumbGapRatio` 增幅 ≥0.15 才发射；
  用例之间重新蓄势要 drain 上一发的 2s 冷却（`step(gun1, 70)` 足够）。
- **双手契印**：用 `clasp2()`（两只手放在 0.455/0.545，`thumbUnderPts`）触发；触发需要攒 4 帧/120ms，
  给 10 帧足够。动画时间轴走合成时钟：直接改 `claspCast.startMs` 再用 `updateClaspCast(t)` 快进
  （`finishClasp()` 封装好了）；不要在用例里用 `performance.now()`，否则冷却会写到合成未来。
  结束后有「必须松开姿势」锁，要先 `step([], 30)` 再重新扣合；双手分离的负例用 `claspFar2()`。
- **無量空処开场动画**：`maybeTriggerVoidCinematic` 用合成时钟的 `lastFrameNowMs`，所以
  `step(void1(0.5), …)` 攒够 3 秒就会在 `runFrame` 里自动开播；播报期间 `runFrame` 冻结（镜像
  `onResults`），此时 `step` 不会推进任何手势状态。快进同样直接改 `voidCinematic.startMs` 再
  `updateVoidCinematic(t)`；「结束」也走它（age ≥ `VOID_CINEMA.endMs` 即收尾）。一次保持只播一次，
  重播要先 `step([], 30)` 松手。

### 1.6 视觉演示态

`?logictest=1&end=charge|blue|red|purplecharge|purpleburst|void|voidform|voidring|voidclear|claspbuild|claspburst|blackcharge|blackburst`（加 `&nobanner=1` 可隐藏左上角测试横幅，加 `&noui=1` 可隐藏侧栏与菜单按钮看构图）：

- `charge`：武装苍后把球钉在屏幕中央并轻微摆动（看构筑球 + 尘埃被吸引、绕球）；
- `blue`：触发释放（看屏幕中央蓝爆 + 尘埃炸开）；
- `red`：合成枪形手保持 30 帧（看红场 + 尘埃被排开成净空）；
- `purplecharge`：开启茈模式、合成枪形蓄势，球钉在世界原点轻微摆动（看右上按钮激活 + 小紫球 + 拖尾）；
- `purpleburst`：发射后把爆炸**钉在 94% 剩余时长**（约 100ms 处的早期爆心），避免软件渲染低帧率
  错过 1.6s 的爆炸；按钮冷却环同时保持可见；
- `void`：`forceTechnique('void')` + `updateState('void', true)`，直接展示白环 + 蓝色球壳的领域场
  （不需要摄像头）；
- `voidform`：固定领域场后 `startVoidCinematic`，把相位冻结在「流星成型中」——黑幕 + 1200 条彩色射线
  向心流动（无标题、无按钮）；
- `voidring`：同上门槛，把相位冻结在 4.5s 的「换环中」——星星外溶解淡出、中心淡入 app 自己的
  白环 + 蓝色星云（黑幕上）；
- `voidclear`：把相位冻结在「黑幕已淡出 + 环还没开始收」的时刻——背景透明、白环仍全亮，
  验收主人要求的「黑幕消失、环还在」节拍；
- `claspbuild`：合成双手扣合触发契印，把 build 冻结在 75%（左右蓝/红两球），用于构图验收；
- `claspburst`：快进到爆发，把紫色爆炸钉在 life≈0.42（径向条纹最清楚），并保持顶部状态为「虚式「茈」」；
- `blackcharge`：合成「张开→握拳」武装黒閃，把蓄势钉在世界原点轻微漂移——屏幕中心会看到
  150 颗红/黑细点组成的散盘（半径≈掌长，红点带辉光、黑点带暗红描边），用于验收「拳头为中心的 10cm 散点」；
- `blackburst`：武装后直接 `startBlackFlashBurst`，把爆发钉在 age≈0.45（叠层绘制包装里用同一帧时钟
  重写 `bfOverlayBurstMs/bfOverlayActiveUntilMs`，1fps 下也不会落到空帧），并用 16ms 定时器续期
  `bfBurstUntilMs/forcedTech` 让顶部保持「黒閃」。画面应为：满屏近黑 + 红边黑闪电从中间空洞向外炸、
  飞散余烬、中间留一拳空位。
- 截 UI（顶栏/侧栏）时加 `&nobanner=1`：否则左上角的测试横幅会盖住菜单按钮；`&noui=1` 用
  `display:none` 直接藏掉侧栏与菜单按钮（应用里的 clean-mode 已删，别再用那个类）。

演示在真实时钟（`performance.now()`）上跑，但回归本身用合成时钟；驱动里的 `resetRealClockFx()`
会在演示前清掉合成时钟遗留的 `purpleExplosionUntilMs`/震动/冷却，否则 canvas 会被巨大的
`translate` 偏移，截图里的球会跑到屏幕外（排查时踩过）。

### 1.7 無量空処手势的参考视频扫描

临时用与 app 相同参数的 MediaPipe Hands 跑了 `视频/领域展开，无量空处.mp4` 的 6 个清晰帧
（t=5/7/9/11/13/15s），逐帧打印 `fingerGap`、`thumbGapRatio` 和食中指交叉的横向序。结论：

- 食中指交叉**不可靠**：`tipSide/pipSide` 在 -1.87~+0.70 间跳，多帧被模型还原成平行两指；
- 拇指内扣稳定：`thumbGapRatio` 0.375~0.65（全部 <0.75），`fingerGap` 0.016~0.048；
- 因此判定用「两指举起 + 指尖靠近 + 拇指内扣」，与赫枪形的「拇指外张 >0.75」互补。

重扫时建议用临时页 + 视频抽帧 + 相同的 `maxNumHands/modelComplexity/minDetectionConfidence`，
扫完删掉临时文件；不要把视频帧或扫描页留在仓库。

### 1.8 双手契印的参考视频扫描

临时用同参数 MediaPipe Hands 扫了 `视频/虚式『茈』 2.mp4` 的 13 帧（3~16s，1fps，640 宽）：

- **双手扣合时模型常常只给一只手**：6 帧双手 / 6 帧单手 / 1 帧无手；
- 双手帧里稳定的是「两只手 indexUp=1、至少一只手 middleUp=1、两只手 thumbGapRatio<0.75」；
  `wristGap` 0.61~2.68 掌长（有一个 2.68 的离群帧），`indexTipGap` 0.29~1.98（离群 1.98）；
- 因此判定用「双手 + 拇指内扣 + 腕/指尖距离」，配 400ms 短窗口累积；离群帧被窗口过滤。
- 单手帧的姿势和 void 几乎同形，所以契印候选期间必须强制清空 void 分；回归第 49 条锁这个行为。

## 2. 视觉验收（Xvfb + 有头 Firefox）

### 2.1 为什么不能用无头

无头 Firefox 建不出 WebGL（"Error creating WebGL context"）。正确姿势：
`xvfb-run` 起虚拟屏 + **有头** Firefox + `gnome-screenshot`。软件渲染（llvmpipe）只有 1~3fps，
所以只能验证「画面对不对」，不能验证「流畅不流畅」。

### 2.2 一次性截图脚本（/tmp 下自建，别放仓库）

```bash
cat > /tmp/ffshot.sh <<'EOF'
#!/bin/bash
# usage: xvfb-run -a -s "-screen 0 1280x900x24" bash /tmp/ffshot.sh <url> <out.png> [wait_seconds]
set -u
URL="$1"; OUT="$2"; WAIT="${3:-6}"
PROFILE=$(mktemp -d /tmp/ffp-XXXXXX)
cat > "$PROFILE/user.js" <<'UJS'
user_pref("webgl.force-enabled", true);
user_pref("webgl.disabled", false);
user_pref("webgl.disable-fail-if-major-performance-caveat", true);
user_pref("gfx.webrender.software", true);
user_pref("layers.acceleration.disabled", true);
user_pref("media.navigator.permission.disabled", true);
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("browser.translations.enable", false);
user_pref("browser.translations.automaticallyPopup", false);
user_pref("datareporting.policy.dataSubmissionPolicyBypassNotification", true);
user_pref("browser.aboutwelcome.enabled", false);
UJS
export LIBGL_ALWAYS_SOFTWARE=1
firefox --profile "$PROFILE" --new-instance --no-remote "$URL" &
FPID=$!
sleep "$WAIT"
gnome-screenshot -f "$OUT"
kill "$FPID" 2>/dev/null; wait "$FPID" 2>/dev/null
rm -rf "$PROFILE"
EOF
chmod +x /tmp/ffshot.sh
```

调用（等 **20~28s** 让 llvmpipe 把粒子跑起来；机器忙时 18s 可能还在加载）：

```bash
cd /home/lain/sat0ru
python3 tools/serve.py . 8787 &   # 或 systemctl --user start sat0ru
xvfb-run -a -s "-screen 0 1280x900x24" bash /tmp/ffshot.sh \
  "http://127.0.0.1:8787/logic-test.html?logictest=1" /tmp/shot-test.png 22
xvfb-run -a -s "-screen 0 1280x900x24" bash /tmp/ffshot.sh \
  "http://127.0.0.1:8787/logic-test.html?logictest=1&end=charge&nobanner=1" /tmp/shot-charge.png 26
xvfb-run -a -s "-screen 0 1280x900x24" bash /tmp/ffshot.sh \
  "http://127.0.0.1:8787/logic-test.html?logictest=1&end=red&nobanner=1" /tmp/shot-red.png 26
xvfb-run -a -s "-screen 0 1280x900x24" bash /tmp/ffshot.sh \
  "http://127.0.0.1:8787/logic-test.html?logictest=1&end=purplecharge&nobanner=1" /tmp/shot-purplecharge.png 26
xvfb-run -a -s "-screen 0 1280x900x24" bash /tmp/ffshot.sh \
  "http://127.0.0.1:8787/logic-test.html?logictest=1&end=purpleburst&nobanner=1" /tmp/shot-purpleburst.png 26
xvfb-run -a -s "-screen 0 1280x900x24" bash /tmp/ffshot.sh \
  "http://127.0.0.1:8787/logic-test.html?logictest=1&end=void&nobanner=1" /tmp/shot-void.png 26
xvfb-run -a -s "-screen 0 1280x900x24" bash /tmp/ffshot.sh \
  "http://127.0.0.1:8787/logic-test.html?logictest=1&end=voidform&nobanner=1&noui=1" /tmp/shot-voidform.png 36
xvfb-run -a -s "-screen 0 1280x900x24" bash /tmp/ffshot.sh \
  "http://127.0.0.1:8787/logic-test.html?logictest=1&end=voidring&nobanner=1&noui=1" /tmp/shot-voidring.png 36
xvfb-run -a -s "-screen 0 1280x900x24" bash /tmp/ffshot.sh \
  "http://127.0.0.1:8787/logic-test.html?logictest=1&end=voidclear&nobanner=1&noui=1" /tmp/shot-voidclear.png 36
xvfb-run -a -s "-screen 0 1280x900x24" bash /tmp/ffshot.sh \
  "http://127.0.0.1:8787/logic-test.html?logictest=1&end=claspbuild&nobanner=1&noui=1" /tmp/shot-clasp-build.png 22
xvfb-run -a -s "-screen 0 1280x900x24" bash /tmp/ffshot.sh \
  "http://127.0.0.1:8787/logic-test.html?logictest=1&end=claspburst&nobanner=1&noui=1" /tmp/shot-clasp-burst.png 22
xvfb-run -a -s "-screen 0 1280x900x24" bash /tmp/ffshot.sh \
  "http://127.0.0.1:8787/logic-test.html?logictest=1&end=blackcharge&nobanner=1&noui=1" /tmp/shot-bf-charge.png 30
xvfb-run -a -s "-screen 0 1280x900x24" bash /tmp/ffshot.sh \
  "http://127.0.0.1:8787/logic-test.html?logictest=1&end=blackburst&nobanner=1&noui=1" /tmp/shot-bf-burst.png 30
```

`nobanner=1` 只影响测试横幅；页面标题仍是 `LOGICTEST PASS`，也可以从窗口标题
（`xwininfo -root -tree`）确认结果。注意新 profile 的首次启动可能弹出翻译/隐私提示页并抢占前台，
用上面的 prefs 关掉；软件渲染下页面载入慢，别急，必要时等到 36s 再截。

### 2.3 验证「动画真的在动」

静态截图看不出旋绕。方法：间隔 1~2s 截两张图，用 PIL 做像素差：

```bash
python3 -I - <<'EOF'
from PIL import Image, ImageChops
a = Image.open('/tmp/a.png').convert('RGB'); b = Image.open('/tmp/b.png').convert('RGB')
diff = ImageChops.difference(a, b)
print('bbox', diff.getbbox(), 'sum', sum(sum(p) for p in diff.getdata()))
EOF
```

差分为 0 且画面该亮的地方不亮 → 要么 `fieldIdle` 没解除，要么粒子没在跑。

### 2.4 常见坑

- **alert 卡 JS**：无摄像头时 MediaPipe 弹模态框，连定时器都停。测试页已覆写 `alert`；自己写临时页时也要覆写。
- **强杀 Firefox 会弄坏 profile**：每次都 `mktemp -d` 新 profile，别复用。
- **等久一点**：llvmpipe 首帧要几秒，粒子收敛（尘埃吸附/斥开）也是秒级。
- **llvmpipe 的 dt 封顶**：尘埃用真实 dt（封顶 0.1s）做阻尼，低帧率下收敛慢，截图可能看到中间态——这是环境问题，不是代码问题。
- **合成时钟 vs 真实时钟**：回归用合成 `t`（33ms/帧），`animate()` 用 `performance.now()`。
  测试里触发的爆炸/冷却会留下一个远在合成未来的 `purpleExplosionUntilMs`，于是 animate 里的
  `life` 可能 >1，把 renderer canvas 用 `translate` 甩出屏幕（表现为紫球失踪、只剩边缘光）。
  演示前调 `resetRealClockFx()`；自己加演示态时也要先清。
- **冷启动**：先确认没有上次遗留的无头 Chromium/Firefox 在烧 CPU，否则软件渲染页面可能 30s 都加载不完。
- **node 语法检查**：模块脚本要先抽出来再查，直接 `node --check` HTML 不行：
  ```bash
  python3 -I - <<'EOF'
  import re
  html = open('index.html', encoding='utf-8').read()
  m = re.findall(r'<script type="module">(.*?)</script>', html, re.S)
  open('/tmp/sat0ru-check.mjs','w',encoding='utf-8').write(m[-1])
  EOF
  node --check /tmp/sat0ru-check.mjs
  ```

## 3. 交付前验收清单

- [ ] `node --check` 通过
- [ ] 重建 `logic-test.html`，截图确认 `LOGICTEST PASS`（93 项）
- [ ] 动过视觉 → 截 `end=charge` / `end=red` / `end=purplecharge` / `end=purpleburst` / `end=void` / `end=voidform` / `end=voidring` / `end=voidclear` / `end=claspbuild` / `end=claspburst` / `end=blackcharge` / `end=blackburst`（或相应态）确认无穿帮
- [ ] 动过顶栏/侧栏 → 确认：闲置时中央无字、技法名白色居中、菜单按钮开合侧栏、设置开关可切换、右上提示随「茈」模式变化
- [ ] 动过性能相关（fieldIdle、粒子数、DPR）→ D 面板看 fps，至少不劣化
- [ ] 仓库无临时文件（`git status` 干净；`logic-test.html` 保持 untracked）
- [ ] 提交（本地，不 push），汇报：做了什么 / 没动什么 / 风险点