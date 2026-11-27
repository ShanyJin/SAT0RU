# 测试与验收 · SAT0RU

两条线：**逻辑靠无摄像头回归**（合成关键点喂真实管线，300 项 PASS/FAIL），
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

### 1.4 断言清单（300 项）

名字与回归横幅逐字一致（`LOGICTEST` 面板里能直接对照）；末项 `end` 只是收尾标记。
下面 1–265 是最终版之前的原有编号；最终版新增的断言见 §1.4b（实际执行顺序以驱动为准，
新增项穿插在欢迎页、教程、语言与加载各段之后，未重新编号旧列表）。


**苍 / 赫 基础与语音**

1. neutral
2. gun motion does not arm blue
3. red gun form shows
4. red orb is a small compact ball
5. red orb holds a small point budget
6. red orb breathes instead of shaking
7. red orb burn-out fades in place
8. red blanks the shared swarm
9. red cast starts with the field
10. red cast aims along the raised finger
11. red cast starts as a muzzle flash
12. red cast travels forward with age
13. red cast stays narrow (not an explosion)
14. red cast ends after the shot
15. red field snaps up and recoils
16. red lance geometry moves forward only
17. red gun releases on drop
18. red release starts a burn-out
19. red burn-out falls instead of shooting
20. red burn-out ends
21. red never eases back to the centre
22. red pointing shows
23. red form handoff stays red
24. red survives brief pose gap
25. red releases on drop
26. red recovers after 2s
27. red 2s cooldown blocks retrigger
28. red 2s cooldown recovers
29. blue blocked by red cooldown
30. red after cooldown
31. red started for the hold robustness tests
32. thumbnail pose sits in the old dropout band
33. red survives a thumb near the void line
34. red bridges a longer tracking dropout
35. red orb ignores landmark jitter
36. red orb follows a real move smoothly <one>/<later>
37. red orb damping is slow enough to read as floating
38. camera shake is an impulse, not a held offset
39. void still takes over from a clear tuck
40. red voice waits for the 1 s hold
41. red voice fires after a 1 s hold
42. red voice picks a local clip
43. red voice plays once per hold
44. red voice fires on the gun form too
45. blue voice waits for the 2 s hold
46. blue voice waits 2 s after the charge
47. blue voice fires 2 s after the charge
48. blue voice picks the local clip
49. blue voice plays once per charge
50. short open hold does not arm blue
51. bent fingers do not arm blue
52. bent fingers stay neutral

**苍 释放（弯指负例、握拳、甩出、前推、合掌、丢手）**

53. blue1 charge armed (no bloom)
54. slow drag keeps charge
55. finger/size jitter keeps charge
56. fast sideways fling releases blue
57. fling release blooms blue
58. point during charge keeps charge
59. fist releases the blue charge
60. fist release blooms blue
61. blue re-armed for the push test
62. forward push releases
63. anim: other gestures ignored
64. cooldown: red ignored
65. blue2 charge armed
66. tracking loss releases
67. palms charge armed
68. palms together releases

**负例与 無量空処 基础**

69. open only no trigger
70. fist>open alone no trigger
71. red gun is not void
72. void gesture triggers
73. void voice waits for the 1 s hold
74. void holds while gesture held
75. void voice fires after a 1 s hold
76. void voice picks the local clip
77. void voice plays once per hold
78. void releases when gesture drops

**茈 按钮模式（收紧后的蓄势/发射）**

79. purple mode button exists
80. purple mode button toggles on
81. purple mode button toggles off
82. purple gun flash does not arm
83. purple gun arms orb
84. purple mode blocks red gun
85. purple pose drop cancels
86. purple pinch arms orb
87. purple thumb-under arms orb
88. purple instant snap while arming is ignored
89. purple snap fires once armed
90. purple snap shot impacts
91. purple snap cooldown blocks recharge
92. purple snap cooldown recovers
93. purple slow drift does not fire
94. purple forward push fires
95. purple shot plays the short clip
96. purple shot impacts
97. purple 2s cooldown blocks recharge
98. purple cooldown recovers
99. purple thumb-under flick fires
100. purple rearmed for snap tests
101. purple slow thumb-out stays charging
102. purple thumb-out snap fires
103. purple snap survives tracking gap

**双手契印（开关门禁、单手张开手、漩涡与掉手）**

104. clasp needs the purple switch
105. one hand void is not clasp
106. two open palms are not clasp
107. duplicate void hand is not clasp
108. void next to a flared open palm is not clasp
109. clasp fires after the near misses
110. duplicate clasp hand is not a cast
111. same-label duplicate hand is not a cast
112. offset duplicate clasp hand is not a cast
113. open hands held apart are not a cast
114. solo open hand flash does not cast
115. solo open hand casts after the solo hold
116. flared open palm never casts the clasp
117. clasp purple choreography spans 16 s
118. clasp audio ends before the animation
119. clasp cast starts
120. clasp pose does not become void
121. clasp starts in the blue phase
122. clasp voice waits for 0.5 s
123. clasp blue orb sits on the right, red absent
124. clasp blue grows to at least half the screen
125. clasp voice starts 0.5 s after the trigger
126. clasp voice plays once per cast
127. clasp red grows on the left after the blue
128. clasp orbs are symmetric when red is full
129. clasp red phase follows the blue
130. clasp converge phase follows the red
131. clasp purple vortex phase starts after 7 s
132. clasp vortex core appears at the centre
133. clasp vortex fills a readable share of the view
134. clasp vortex gyro rings tilt apart
135. clasp vortex slams on the beat
136. clasp vortex rebounds between collisions
137. clasp shockwave expands after a collision
138. clasp shockwave fades before the next beat
139. clasp vortex hides for the blast
140. clasp bursts into purple at 20 s
141. clasp blast is active
142. clasp cast ends after the aftermath
143. clasp cooldown blocks recast
144. clasp recast after cooldown
145. far clasp-family pose is not clasp
146. far clasp-family pose stays neutral
147. clasp warming before a hand drops
148. dropped-hand clasp does not fire red
149. dropped-hand clasp still casts
150. lone index hand still fires red

**無量空処 定格 3 秒开场动画**

151. void under 3s no cinematic
152. void held 3s starts cinematic
153. cinematic hides UI chrome
154. cinematic ring reveals void field
155. cinematic field fades in
156. cinematic streaks dissolve
157. ring holds on black before fade
158. black stage fades, ring stays
159. ring fades at the tail
160. cinematic ends and restores UI
161. cinematic no loop while holding
162. cinematic replays after re-entry

**长时间无量空处**

163. long void switch exists
164. long void switch toggles on
165. long timeline outlives its voice
166. long void under 1 s no cinematic
167. long void plays the long voice at the 1 s trigger
168. long void skips the short voice
169. long void waits 8 s before cinematic
170. long void starts long cinematic after 8 s
171. long voice does not replay at cinematic start
172. long cinematic ends after the voice
173. long void switch toggles off

**音频库（9 条）**

174. audio block lists every clip
175. audio block includes the clasp track
176. audio row click plays the clip
177. audio block includes the failure clip
178. audio block includes the creed clip
179. failure clip plays on click
180. creed clip plays on click
181. audio labels drop the old year
182. purple voice uses the renamed clip
183. about shows the build tag
184. viewport meta enables phone layout
185. camera video is inline and muted
186. phone layout has a small-screen rule

**左侧栏三菜单 + 语音开关**

187. left rail has three sub-menu tabs
188. rail tab order
189. main tab is open by default
190. main tab holds settings and audio
191. guide tab switches the panel
192. guide drops the old year
193. about tab switches the panel
194. about credits the manga author
195. about lists both bilibili videos with thanks
196. about gives an infringement contact email
197. about says all assets come from the internet
198. about credits the two build models
199. main tab returns
200. settings keep debug/voice/voidlong/egg
201. synthesized SFX are gone for good
202. technique voices are on by default
203. gesture voice plays while the switch is on
204. voice switch turns off
205. gesture voice is silent when switched off
206. manual audio-library click still plays when voices are off
207. voice switch turns back on
208. first visit shows the intro modal
209. intro has welcome plus four technique pages
210. intro credits the manga author, original project, fork author and site
211. intro promises local-only processing
212. intro carries the asset notice and contact
213. intro asks for a bright clear play space
214. tutorial technique order
215. tutorial images live under assets
216. tutorial image files are served
217. intro starts at step one
218. intro acknowledgement button exists
219. acknowledgement opens the blue tutorial
220. tutorial walks through to the void page
221. purple tutorial text drops the old year
222. finishing the tutorial closes the modal
223. intro gate reaches the app
224. camera and model are idle before opt-in
225. top bar holds the start button
226. start button defaults off with a click-to-start label
227. start button calls the camera once
228. start button waits for tracking
229. start button shows running
230. switching off stops the camera
231. start button returns to off
232. settings no longer hold the start row
233. settings include the custom void easter egg
234. custom void defaults off
235. custom void switch turns on
236. egg panel opens with the switch
237. egg info starts collapsed
238. egg info explains the custom video
239. egg info arrow expands the description
240. egg offers three versions and starts at one
241. egg version two is selected
242. void egg overlay starts hidden
243. void cinematic arms for the egg
244. egg waits for the transit to finish
245. egg cuts in when the transit ends
246. egg plays the selected bilibili video
247. egg can be closed and clears the iframe
248. custom egg rejects b23.tv short links
249. custom egg parser extracts the BV id and page
250. custom egg rejects text without a video id
251. egg version three waits for a link
252. custom egg input appears for version three
253. custom egg saves the pasted link
254. custom egg plays through the bilibili player
255. custom egg link persists locally
256. custom egg confirms the saved link
257. egg switch turns off again
258. call-out subtitle element exists
259. call-out lines are traditional fansub titles
260. call-out only appears for the playing clip
261. call-out timing tracks the clip length
262. call-out ends with its clip
263. domain call-out fades on the black cut
264. black stage never keeps a call-out
265. end

### 1.4b 最终版新增断言

**欢迎页与教程图**
- welcome lists supported browsers
- welcome warns about performance
- English welcome keeps the support and performance cards
- tutorial images are local webp files
- tutorial images wait for their page
- tutorial images load as their pages open

**中英双语**
- language defaults to Chinese
- site title uses the new Chinese name
- welcome uses the new Chinese name and tagline
- settings hold a language row outside the switches
- English switch updates html lang
- English switch updates the title
- English switch localizes the rail tabs
- English start label is localized
- English keeps technique names in Traditional Chinese
- language choice is persisted
- switching back restores Chinese
- switching back restores the Chinese title
- English localizes the welcome tutorial body
- English localizes the settings labels
- English localizes the gesture guide
- English localizes the about page labels
- English localizes the custom void panel
- English audio labels keep the Traditional Chinese technique name
- English keeps the top-bar technique name in Traditional Chinese
- a technique in progress survives a language switch

**加载与缓存**
- audio elements do not preload at startup（驱动启动时快照，避免状态机播放长音频后误判）
- MediaPipe scripts stay out of the first load
- MediaPipe lazy loader exists
- MediaPipe header scripts load on demand
- MediaPipe lazy loading is idempotent
- a rejected long clip queues a retry
- long clip retry respects the voice gate
- long clip retry is dropped while voices are off
- long clip retry takes over the audio stage
- long clip retry counts as a normal play

gzip/缓存头不在浏览器回归里，按 §2.6 的 `curl` 菜谱单独验。

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
- **术式字幕**：断言走真实函数（`playAudioClip`/`showTechniqueSubtitle`/`subtitleTiming`/
  `cueDomainSubtitleBlackCut`/`startVoidCinematic`），不依赖声音；`play()` 在测试页会被拒绝，但字幕由
  `showTechniqueSubtitle` 直接驱动，所以文案/门控/时长都能断言。`&end=sub&call=<key>` 是字幕截图态，
  `&live=1` 让它走真实定时器并断言排程（`shown/fade/gone` 三时刻，允许 ±1000ms 以吸收后台节流）。
  注意：软件渲染下 CSS 过渡的 `opacity` 会被合成器节流（读到恒 0/跳变），所以「淡出是否平滑」只能靠
  排程断言 + 真机肉眼看，别试图用 `getComputedStyle` 逐帧采样。
- **無量空処开场动画**：`maybeTriggerVoidCinematic` 用合成时钟的 `lastFrameNowMs`，所以
  `step(void1(0.5), …)` 攒够 3 秒就会在 `runFrame` 里自动开播；播报期间 `runFrame` 冻结（镜像
  `onResults`），此时 `step` 不会推进任何手势状态。快进同样直接改 `voidCinematic.startMs` 再
  `updateVoidCinematic(t)`；「结束」也走它（age ≥ `VOID_CINEMA.endMs` 即收尾）。一次保持只播一次，
  重播要先 `step([], 30)` 松手。

### 1.6 视觉演示态

`?logictest=1&end=charge|blue|red|redcast|redburn|purplecharge|purpleburst|void|voidform|voidring|voidclear|voidlong|claspblue|claspred|claspconverge|claspvortex|claspclash|claspburst`（加 `&nobanner=1` 可隐藏左上角测试横幅，加 `&noui=1` 可隐藏侧栏与菜单按钮看构图）：

- `charge`：武装苍后把球钉在屏幕中央并轻微摆动（看构筑球 + 尘埃被吸引、绕球）；
- `blue`：触发释放（看屏幕中央蓝爆 + 尘埃炸开）；
- `red`：合成枪形手保持 30 帧（看红场 + 尘埃被排开成净空）；
- `redcast`：触发赫后把激发的相位**钉在 `&age=<ms>`**（默认 170；建议 40 看枪口闪光、
  170 看枪矛出手、330 看锥面扩散）——验证「向前射出、不是炸开」；
- `redburn`：把原地燃尽的相位钉在 `&age=<ms>`（默认 200）——验证退场是下落余烬而不是淡回中央；
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
- 因此判定用「双手 + 张开手型 + 腕距（+腕相对形状差）」，配 400ms 短窗口累积；离群帧被窗口过滤。
- 主人的三张双手扣合实拍（同参数 MediaPipe）里，最稳的双手帧是 `wristGap` 0.66~0.68、
  `indexTipGap` 0.05~0.06，而 `middleTipGap` 0.73~1.03（食指压在一起、中指分开）；多数帧模型只给一只手。
- 最终判据：双手姿势 = `wristGap 0.30~2.2` + 至少一只手是「四指朝上、拇指内扣」的张开手
  （`claspOpenHandShape`）+ handedness 标签必须不同（`handsAreDistinct`）+ 腕相对形状差
  `minShapeDelta 0.40`（同一只手被识别两次的布局几乎重合，真实双手不会），真实双手姿势 ≥2 帧；
  同一只手被识别两次再由 `minWristGap`/同标签否决。旧版「指尖相压 / 中指分开」判据已删——
  它只是重复检测的间接症状，单手姿势根本判不了。
- **只认到一只手也认**（`claspSoloInfo`）：扣合时 MediaPipe 常只给张开的那只手；单手张开手型
  累积 9 帧 / 300ms（真双手只要 4 帧 / 120ms），避免随手一张开手掌放 23 秒长动画。
- 契印必须**双手扣合**或**单只张开手**，無量空処始终**单手**且是领域手型：`claspOpenHandShape`
  要求四指朝上（领域手型食指中指并拢、其余收拢），单手领域手势永远不会发动契印
  （回归 `one hand void is not clasp` / `duplicate void hand is not clasp`）。
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

### 2.2b 双语欢迎页与英文界面

欢迎页右上角的 **中文 / English** 按钮直接点就能看两种语言。要自动化，用 Chromium + CDP
先把 `sat0ru.language` 写进 localStorage 再刷新（Node 24 自带 `WebSocket`，脚本放 `/tmp`，别进仓库）：

```bash
CHROME=~/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome
"$CHROME" --headless=new --no-sandbox --disable-dev-shm-usage --remote-debugging-port=9333 \
  --use-angle=swiftshader --enable-unsafe-swiftshader --force-device-scale-factor=1 \
  --hide-scrollbars --window-size=1280,900 --user-data-dir=/tmp/sat0ru-cdp-profile \
  "http://127.0.0.1:8787/" &
node /tmp/sat0ru-cdp.mjs   # 里面 Runtime.evaluate 设语言 → Page.reload → Page.captureScreenshot
```

`/tmp/sat0ru-cdp.mjs` 骨架（连接 `http://127.0.0.1:9333/json` 里的 page target，`Runtime.evaluate`
设 `localStorage.setItem('sat0ru.language','en')`，`Page.reload` 后等 9s 再 `Page.captureScreenshot`）。
看三张：欢迎页两张卡片（`Recommended environment` / `Performance notes` 文案与窄屏单列）、
英文教程页四页、英文侧栏（设置/指南/关于）。**技法名与 `#technique-name` 必须仍是繁体中文**；
用作者名/项目链接检查换行。窄屏再补一张 `--window-size=420,900` 的欢迎页，
确认卡片变单列、语言按钮不溢出。

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
`--remote-debugging-port`）点完教程、点顶部栏「启动」按钮；按钮标签应从「等待追踪」变成「追踪中」，
D 面板里 `camera: tracking frames:N last:...ms err:-` 持续增长。首次要下载/编译约 23MB 模型，
**10s 左右才出第一帧是正常的**；20s 仍无结果看门狗才报「追踪无输出」。

### 2.6 静态服务器的 gzip 与缓存头

`tools/serve.py` 的压缩/缓存只影响传输，回归里看不到；改了 `serve.py` 或缓存策略后单独验：

```bash
# 文本/模型：有 gzip，Content-Type 正确（注意不能是 "t" 这种被截断的怪值），HTML 为 no-cache
curl -sI -H 'Accept-Encoding: gzip' http://127.0.0.1:8787/ | grep -iE 'content-(type|encoding|length)|cache-control'
# 期望：text/html · Content-Encoding: gzip · Cache-Control: no-cache · Vary: Accept-Encoding

curl -sI -H 'Accept-Encoding: gzip' http://127.0.0.1:8787/vendor/three/build/three.module.js \
  | grep -iE 'content-(type|encoding)|cache-control'
# 期望：text/javascript · gzip · public, max-age=31536000, immutable

curl -sI -H 'Accept-Encoding: gzip' \
  http://127.0.0.1:8787/vendor/mediapipe/hands/hands_solution_packed_assets.data \
  | grep -iE 'content-type|content-encoding|cache-control'
# 期望：application/octet-stream · gzip · immutable（.data 属 COMPRESSIBLE；请求不带 Accept-Encoding 时无 Content-Encoding）

curl -sI http://127.0.0.1:8787/assets/tutorial/blue.webp | grep -iE 'content-type|cache-control'
# 期望：image/webp · immutable（webp 不压缩）
```

重复请求应几乎瞬时（压缩结果在内存 `_cache` 里）；**改了 `serve.py` 要重启服务**
（`systemctl --user restart sat0ru` 或重跑 `python3 tools/serve.py . 8787`），改 `index.html` 不用。

## 3. 交付前验收清单

- [ ] `node --check` 通过
- [ ] 重建 `logic-test.html`，截图确认 `LOGICTEST PASS`（300 项）
- [ ] 动过视觉 → 截 `end=charge` / `end=red` / `end=redcast` / `end=redburn` / `end=purplecharge` / `end=purpleburst` / `end=void` / `end=voidform` / `end=voidring` / `end=voidclear` / `end=voidlong` / `end=claspblue` / `end=claspred` / `end=claspconverge` / `end=claspvortex` / `end=claspclash` / `end=claspburst`（或相应态）确认无穿帮
- [ ] 动过顶栏/侧栏 → 确认：闲置时中央无字、技法名白色居中、菜单按钮开合侧栏、三个小菜单可切换、设置 5 个开关（D/H/V/L/★）可切换、设置底部的**语言行**（中文 / English）可切换且刷新后保持、音频库 9 行可播放/停止、右上提示随「茈」模式变化
- [ ] 动过中英双语 → 英文下逐个看欢迎页两张卡片、教程四页、设置、指南、关于、自定义无量空处；确认技法名与字幕仍是繁体中文
- [ ] 动过性能相关（fieldIdle、粒子数、DPR）→ D 面板看 fps，至少不劣化
- [ ] 仓库无临时文件（`git status` 干净；`logic-test.html` 保持 untracked）
- [ ] 提交（本地，不 push），汇报：做了什么 / 没动什么 / 风险点
