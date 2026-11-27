# 测试与验收 · SAT0RU

两条线：**逻辑靠无摄像头回归**（合成关键点喂真实管线，202 项 PASS/FAIL），
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

### 1.4 202 项断言（按顺序）

名字与回归横幅逐字一致（`LOGICTEST` 面板里能直接对照）；末项 `end` 只是收尾标记。

**苍 / 赫 基础与语音**

1. neutral
2. gun motion does not arm blue
3. red gun form shows
4. red gun releases on drop
5. red pointing shows
6. red form handoff stays red
7. red survives brief pose gap
8. red releases on drop
9. red recovers after 2s
10. red 2s cooldown blocks retrigger
11. red 2s cooldown recovers
12. blue blocked by red cooldown
13. red after cooldown
14. red voice waits for the 1 s hold
15. red voice fires after a 1 s hold
16. red voice picks a local clip
17. red voice plays once per hold
18. red voice fires on the gun form too
19. blue voice waits for the 2 s hold
20. blue voice waits 2 s after the charge
21. blue voice fires 2 s after the charge
22. blue voice picks the local clip
23. blue voice plays once per charge
24. short open hold does not arm blue
25. bent fingers do not arm blue
26. bent fingers stay neutral

**苍 释放（弯指负例、握拳、甩出、前推、合掌、丢手）**

27. blue1 charge armed (no bloom)
28. slow drag keeps charge
29. finger/size jitter keeps charge
30. fast sideways fling releases blue
31. fling release blooms blue
32. point during charge keeps charge
33. fist releases the blue charge
34. fist release blooms blue
35. blue re-armed for the push test
36. forward push releases
37. anim: other gestures ignored
38. cooldown: red ignored
39. blue2 charge armed
40. tracking loss releases
41. palms charge armed
42. palms together releases

**负例与 無量空処 基础**

43. open only no trigger
44. fist>open alone no trigger
45. red gun is not void
46. void gesture triggers
47. void voice waits for the 1 s hold
48. void holds while gesture held
49. void voice fires after a 1 s hold
50. void voice picks the local clip
51. void voice plays once per hold
52. void releases when gesture drops

**茈 按钮模式**

53. purple mode button exists
54. purple mode button toggles on
55. purple mode button toggles off
56. purple gun arms orb
57. purple mode blocks red gun
58. purple pose drop cancels
59. purple pinch arms orb
60. purple thumb-under arms orb
61. purple forward push fires
62. purple shot plays the short clip
63. purple shot impacts
64. purple 2s cooldown blocks recharge
65. purple cooldown recovers
66. purple thumb-under flick fires
67. purple rearmed for snap tests
68. purple slow thumb-out stays charging
69. purple thumb-out snap fires
70. purple snap survives tracking gap

**双手契印（含漩涡与掉手）**

71. one hand void is not clasp
72. duplicate void hand is not clasp
73. duplicate void hand stays void
74. void next to an open palm is not clasp
75. clasp context warms without casting
76. domain sign after clasp context is not a cast
77. domain sign after clasp context stays void
78. pointing hand plus open palm is not clasp
79. clasp still fires after the near misses
80. duplicate clasp hand is not a cast
81. same-label duplicate hand is not a cast
82. offset duplicate clasp hand is not a cast
83. clasp purple choreography spans 16 s
84. clasp audio ends before the animation
85. clasp cast starts
86. clasp pose does not become void
87. clasp starts in the blue phase
88. clasp voice waits for 0.5 s
89. clasp blue orb sits on the right, red absent
90. clasp blue grows to at least half the screen
91. clasp voice starts 0.5 s after the trigger
92. clasp voice plays once per cast
93. clasp red grows on the left after the blue
94. clasp orbs are symmetric when red is full
95. clasp red phase follows the blue
96. clasp converge phase follows the red
97. clasp purple vortex phase starts after 7 s
98. clasp vortex core appears at the centre
99. clasp vortex fills a readable share of the view
100. clasp vortex gyro rings tilt apart
101. clasp vortex slams on the beat
102. clasp vortex rebounds between collisions
103. clasp shockwave expands after a collision
104. clasp shockwave fades before the next beat
105. clasp vortex hides for the blast
106. clasp bursts into purple at 20 s
107. clasp blast is active
108. clasp cast ends after the aftermath
109. clasp cooldown blocks recast
110. clasp recast after cooldown
111. far clasp-family pose is not clasp
112. far clasp-family pose stays red
113. clasp warming before a hand drops
114. dropped-hand clasp does not fire red
115. dropped-hand clasp still casts
116. lone index hand still fires red

**無量空処 定格 3 秒开场动画**

117. void under 3s no cinematic
118. void held 3s starts cinematic
119. cinematic hides UI chrome
120. cinematic ring reveals void field
121. cinematic field fades in
122. cinematic streaks dissolve
123. ring holds on black before fade
124. black stage fades, ring stays
125. ring fades at the tail
126. cinematic ends and restores UI
127. cinematic no loop while holding
128. cinematic replays after re-entry

**长时间无量空处**

129. long void switch exists
130. long void switch toggles on
131. long timeline outlives its voice
132. long void under 1 s no cinematic
133. long void plays the long voice at the 1 s trigger
134. long void skips the short voice
135. long void waits 8 s before cinematic
136. long void starts long cinematic after 8 s
137. long voice does not replay at cinematic start
138. long cinematic ends after the voice
139. long void switch toggles off

**音频库（9 条）**

140. audio block lists every clip
141. audio block includes the clasp track
142. audio row click plays the clip
143. audio block includes the failure clip
144. audio block includes the creed clip
145. failure clip plays on click
146. creed clip plays on click
147. audio labels drop the old year
148. purple voice uses the renamed clip
149. about shows the build tag
150. viewport meta enables phone layout
151. camera video is inline and muted
152. phone layout has a small-screen rule

**左侧栏三菜单 + 释放音效**

153. left rail has three sub-menu tabs
154. rail tab order
155. main tab is open by default
156. main tab holds settings and audio
157. guide tab switches the panel
158. guide drops the old year
159. about tab switches the panel
160. main tab returns
161. settings keep start/debug/voice/voidlong/sfx/egg
162. settings include a sound-effects switch
163. sound effects play when enabled
164. sound-effects switch toggles off
165. sound effects stay silent when switched off
166. sound-effects switch toggles back on
167. first visit shows the intro modal
168. intro has welcome plus four technique pages
169. intro credits the original project, fork author and site
170. intro promises local-only processing
171. intro carries the asset notice
172. tutorial technique order
173. tutorial images live under assets
174. tutorial image files are served
175. intro starts at step one
176. intro acknowledgement button exists
177. acknowledgement opens the blue tutorial
178. tutorial walks through to the void page
179. purple tutorial text drops the old year
180. finishing the tutorial closes the modal
181. intro gate reaches the app
182. camera and model are idle before opt-in
183. settings include the start switch
184. start switch defaults off with a click-to-start hint
185. start switch calls the camera once
186. start switch waits for tracking
187. start switch shows running
188. switching off stops the camera
189. start switch returns to off
190. settings include the void easter egg
191. void easter egg defaults off
192. egg switch turns on
193. egg offers two versions and starts at one
194. egg version two is selected
195. void egg overlay starts hidden
196. void cinematic arms for the egg
197. egg waits for the transit to finish
198. egg cuts in when the transit ends
199. egg plays the selected bilibili video
200. egg can be closed and clears the iframe
201. egg switch turns off again
202. end（收尾标记）

### 1.5 加用例的坑

- **2 秒冷却**：赫/茈/無量空処触发后要空步 drain ~60~80 帧（×33ms ≈ 2~2.6s）；苍释放是 2.5s 演出 + 2s 锁，
  需要 ~140~180 帧。现有用例习惯多 drain 到 180~260 帧，稳。参考红冷却的 9→10→11 节奏。
- **EMA 与帧数**：进入要 smoothed ≥0.75，姿势切换给足 20~25 帧；`redFormSeen` 这类「立即清零」的逻辑
  在单帧上生效，不需要长窗口。
- **苍 = 持掌 2 秒**：`armBlue1` 是 `step(open1(x), 100)`（3 帧起算 + 2000ms ≈ 64 帧，留余量）。
  持掌不足的负例用 40 帧。想在同一用例里做第二段持掌，必须**用握拳帧断掉上一次保持**
  （`step(fist1(0.5), 3)`）：无手帧早退时不会清 `blueHandStates`，直接空步会让旧 stage=1 续上，
  第二段持掌一开局就完成。冷却期内的开掌帧会被 `othersOwnHands` 重置，不会偷偷攒苍。
- **术式语音（赫/無量空処 1 秒、苍构筑后 2 秒）**：`updateTechniqueVoices` 由 `runFrame` 每帧调用、
  走合成时钟；断言数「尝试播放次数」而不是听声音（测试页里 `play()` 会被浏览器拒绝，驱动统计
  `audioPlayCounts` 与 `lastAudioKey`）。赫/無量空処保持 1s ≈ 进入技法后再 30+ 帧；断「不足 1s」给
  <30 帧。苍的计时读 `blueCharge.startedMs`：构筑成型（2s）后还要再 60 帧左右才播，断「不足 2s」
  给 ~44 帧；`blueCharge` 消失即复位 `blueVoicePlayed`，提前释放/取消不播。测完语音可直接
  `cancelBlueCharge()` 清场（不要让它走释放，否则会带出 2.5s 演出 + 2s 锁）。
- **音频库**：`AUDIO_TRACKS` 按页面里实际存在的 `<audio>` 过滤；回归页有完整侧栏，应得 9 行。
  点击态用 `toggleAudioClip(key)` 或直接 `row.click()`，断言 `audioPlayCounts[key]` +1 与 `.playing` 类；
  同一时间只播一条的行为由 `playAudioClip` 先暂停其它轨道保证。
- **长时间无量空处**：`longBtn.click()` 切换 `voidLongMode`；打开后保持 void 1 秒：
  领域展开并立即 `audioPlayCounts['void-long']` +1（`audioPlayCounts['void']` 不变），
  但 **8 秒等待内不会开播 cinematic**（`runFrame` 里 `maybeTriggerVoidCinematic` 要等
  `holdMs 1000 + startDelayMs 8000`）。合成时钟下持续 `step(void1, …)` 约 9 秒（~275 帧）才启动长版
  （`voidCinematic.timeline === VOID_CINEMA_LONG`），启动时长语音计数不再增加（不重播）。
  用 `VOID_CINEMA_LONG.endMs`（33800，动画从黑幕算）快进收尾，断言 `endMs > audioMs + 1000`；
  收尾后关掉开关（`resetRealClockFx` 也会把 `voidLongMode` 复位）。
- **前推链**：`scaledOpen1` / `scaledGun1` 的缩放必须逐帧递增且持续 ≥110ms、累计 ≥24% 才会释放；
  中间一帧不涨即断链。写「应该释放」的用例时给足 5 帧以上；写「不该释放」的用例时，
  一个 2~3 帧的尺寸跳变即可复现旧版误触。
- **拇指外弹**：用 `thumbUnder1`（拇指内扣）+ `gun1`（拇指外张）模拟跳变；`thumbLerp1` 做慢速外张的
  反例。跳变必须在 `PURPLE_CAST.snapWindowMs`（500ms）内且 `thumbGapRatio` 增幅 ≥0.15 才发射；
  用例之间重新蓄势要 drain 上一发的 2s 冷却（`step(gun1, 70)` 足够）。
- **双手契印（长动画）**：用 `clasp2()`（两只手放在 0.455/0.545，`thumbUnderPts`）触发；触发需要攒
  4 帧/120ms，给 10 帧足够。时间轴全部由 `CLASP_CAST` 的 getter 派生（`redEndMs 4000 / convergeEndMs 7000 /
  collideStartMs 13000 / explodeAtMs 20000 / endMs 23000`）；快进用改 `claspCast.startMs` + `updateClaspCast(t)`
  （`finishClasp()` 封装好收尾，且会先置 `voicePlayed`），不要在用例里用 `performance.now()`，否则冷却会写到合成未来。
  位置/尺寸/对称性用纯函数 `claspOrbLayout(ageMs, halfW)` 直接断言（不依赖 WebGL 是否画出来），
  碰撞节拍用 `claspCollisionPulse`。语音 0.5s 门槛用 10~15 帧跨过（33ms/帧，15 帧 ≈0.5s）。
  注意 `updateClaspCast` 由 `runFrame` → `computeFrameScores` 每帧驱动，语音也是它触发的。
  结束后有「必须松开姿势」锁，要先 `step([], 30)` 再重新扣合；双手分离的负例用 `claspFar2()`。
- **無量空処开场动画**：`maybeTriggerVoidCinematic` 用合成时钟的 `lastFrameNowMs`，所以
  `step(void1(0.5), …)` 攒够 3 秒就会在 `runFrame` 里自动开播；播报期间 `runFrame` 冻结（镜像
  `onResults`），此时 `step` 不会推进任何手势状态。快进同样直接改 `voidCinematic.startMs` 再
  `updateVoidCinematic(t)`；「结束」也走它（age ≥ `VOID_CINEMA.endMs` 即收尾）。一次保持只播一次，
  重播要先 `step([], 30)` 松手。

### 1.6 视觉演示态

`?logictest=1&end=charge|blue|red|purplecharge|purpleburst|void|voidform|voidring|voidclear|voidlong|claspblue|claspred|claspconverge|claspvortex|claspclash|claspburst`（加 `&nobanner=1` 可隐藏左上角测试横幅，加 `&noui=1` 可隐藏侧栏与菜单按钮看构图）：

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
- `voidlong`：直接 `startVoidCinematic(performance.now(), true)`，把相位冻结在长版换环后的
  黑幕保持段——验证 24 秒长黑幕上白环仍亮、bloom 在慢呼吸；
- `claspblue`：触发契印，把时间轴冻在蓝球长到 75%——右侧一颗巨大蓝球，左侧还没有红球；
- `claspred`：冻在红球将满（约 3.7s）——左右对称的一蓝一红巨球；
- `claspconverge`：冻在靠拢 60%——两球压小、向中心聚拢；
- `claspvortex`：冻在漩涡段中点——紫色三臂星系 + 三道倾斜陀螺环（可直接目检旋臂与环是否分得开）；
- `claspclash`：冻在碰撞拍点（`collideStartMs + 30ms`）——螺旋收拢撞击、bloom 拉满；
- `claspburst`：快进到爆发，把紫色爆炸钉在 life≈0.42（径向条纹最清楚），并保持顶部状态为「虚式「茈」」。
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
- 主人的三张双手扣合实拍（同参数 MediaPipe）里，最稳的双手帧是 `wristGap` 0.66~0.68、
  `indexTipGap` 0.05~0.06，而 `middleTipGap` 0.73~1.03（食指压在一起、中指分开）；多数帧模型只给一只手。
- 最终判据（比扫描时的草稿更紧）：`wristGap 0.30~2.2`、`tipGap<0.50`、`middleGap>0.55`、
  handedness 标签必须不同（`handsAreDistinct`）、真实双手姿势 ≥2 帧（`claspRealPoseFrames`）；
  同一只手被识别两次由 `minWristGap`/同标签/`middleGap` 三重否决（`tipGap==middleGap`，不可能同时满足）。
- 契印必须**双手扣合**，無量空処始终**单手**：`voidSignShape` 守卫排除领域手型，
  单手领域手势永远不会发动契印（回归 `one hand void is not clasp` / `duplicate void hand is not clasp`）。
- **真正的根因在掉手嫌疑窗**：从前 `claspSuspect` 把任何单手 index-up 都当「契印掉手」，
  于是单手领域手势能在 600ms 内续上已有一帧真姿势的契印 run、直接发动。现在 `claspSuspect`
  显式排除 `voidSignShape`，回归 `domain sign after clasp context is not a cast` 锁死。
- 扣合掉成单手时可能和领域手型相似，所以契印候选期间仍强制清空 void 分（防止误开领域）；
  这只是形状相似，不是一个「双手领域」技法。

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
for m in claspblue claspred claspconverge claspvortex claspclash claspburst; do
xvfb-run -a -s "-screen 0 1280x900x24" bash /tmp/ffshot.sh \
  "http://127.0.0.1:8787/logic-test.html?logictest=1&end=$m&nobanner=1&noui=1" /tmp/shot-$m.png 22
done
xvfb-run -a -s "-screen 0 1280x900x24" bash /tmp/ffshot.sh \
  "http://127.0.0.1:8787/logic-test.html?logictest=1&end=voidlong&nobanner=1&noui=1" /tmp/shot-voidlong.png 36
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

### 2.5 手机排版与假摄像头追踪验证

无头 Chromium（Playwright 缓存里的 `chrome-linux64/chrome`）能开软件 WebGL，适合验窄屏排版：

```bash
CHROME=~/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome
"$CHROME" --headless=new --no-sandbox --disable-dev-shm-usage \
  --use-angle=swiftshader --enable-unsafe-swiftshader --force-device-scale-factor=1 \
  --hide-scrollbars --window-size=420,900 --virtual-time-budget=8000 \
  --screenshot=/tmp/c-phone-intro.png "http://127.0.0.1:8787/"
```

应用本体（logic-test 会自己走完教程，等 45s）：

```bash
"$CHROME" --headless=new --no-sandbox --disable-dev-shm-usage \
  --use-angle=swiftshader --enable-unsafe-swiftshader --force-device-scale-factor=1 \
  --hide-scrollbars --window-size=420,900 --virtual-time-budget=45000 \
  --screenshot=/tmp/c-phone-app.png "http://127.0.0.1:8787/logic-test.html?logictest=1&nobanner=1"
```

验「摄像头能开但没追踪」不需要真机：加
`--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`，用 CDP（`websockets` +
`--remote-debugging-port`）点完教程、点「启动按钮」；启动行应从「等待追踪…」变成「追踪中」，
D 面板里 `camera: tracking frames:N last:...ms err:-` 持续增长。首次要下载/编译约 23MB 模型，
**10s 左右才出第一帧是正常的**；20s 仍无结果看门狗才报「追踪无输出」。

## 3. 交付前验收清单

- [ ] `node --check` 通过
- [ ] 重建 `logic-test.html`，截图确认 `LOGICTEST PASS`（202 项）
- [ ] 动过视觉 → 截 `end=charge` / `end=red` / `end=purplecharge` / `end=purpleburst` / `end=void` / `end=voidform` / `end=voidring` / `end=voidclear` / `end=voidlong` / `end=claspblue` / `end=claspred` / `end=claspconverge` / `end=claspvortex` / `end=claspclash` / `end=claspburst`（或相应态）确认无穿帮
- [ ] 动过顶栏/侧栏 → 确认：闲置时中央无字、技法名白色居中、菜单按钮开合侧栏、三个小菜单可切换、设置 5 个开关（D/H/V/L/SFX）可切换、音频库 9 行可播放/停止、右上提示随「茈」模式变化
- [ ] 动过性能相关（fieldIdle、粒子数、DPR）→ D 面板看 fps，至少不劣化
- [ ] 仓库无临时文件（`git status` 干净；`logic-test.html` 保持 untracked）
- [ ] 提交（本地，不 push），汇报：做了什么 / 没动什么 / 风险点
