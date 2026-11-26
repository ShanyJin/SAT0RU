# 测试与验收 · SAT0RU

两条线：**逻辑靠无摄像头回归**（合成关键点喂真实管线，48 项 PASS/FAIL），
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

### 1.4 48 项断言（按顺序）

1. neutral 初始
2. 枪形动作不误触苍（张开→收指→张开恰好凑成蓝时序的回归）
3. 赫 枪形触发
4. 赫 枪形收手退场
5. 赫 食指指触发
6. 两形态互换不断档
7. 短暂丢手（8 帧）桥接仍红
8. 收手退场
9. 2s 后赫恢复（旧的 8s 锁已废）
10. 2s 冷却内重指不触发
11. 2s 冷却结束赫恢复
12. 冷却期回摆不误触苍
13. 冷却结束双手指赫恢复
14. 苍1 构筑武装（open 8 → fist 6 → open 6），同一断言确认仍未绽放（currentTech 仍 neutral）
15. 慢速拖动 ~0.36/s 不打断，球只跟手
16. 手指/掌尺寸抖动不打断（交替 ±8% 缩放 + 3 帧 +24% 关键点跳变）
17. 快速横向挥手 ~1.8/s 不打断
18. 构筑期指赫不打断
19. 持续前推释放（掌尺寸 1.0→1.5，连续增长 ≥110ms、累计 ≥24%，blue）
20. 动画中其他手势被忽略
21. 冷却期赫被忽略
22. 苍2 双手构筑
23. 丢追踪释放（丢手 34 帧 ≈1.1s 后，blue）
24. 合掌构筑武装
25. 合掌释放（blue）
26. 只张开不触发
27. 握拳→张开不触发
28. 赫枪形仍是赫、不是無量空処（拇指外张）
29. 無量空処手势触发（两指举起 + 拇指内扣）
30. 無量空処保持（手势持续）
31. 無量空処松手退场
32. 顶部「茈」按钮存在
33. 点击「茈」开启模式（`purpleMode` + `aria-pressed=true`）
34. 再点关闭（`purpleMode=false` + `aria-pressed=false`）
35. 茈模式枪形蓄势出小球（`purpleCharge` 非空）
36. 茈模式枪形不触发赫（`currentTech` 仍 neutral）
37. 姿势丢失 280ms 后蓄势取消（`purpleCharge=null`）
38. 捏合蓄势出小球
39. 拇指内扣的待发姿势本身也能蓄势出小球
40. 前推发射（`purpleShot` 非空）
41. 飞行 380ms 后命中，`currentTech=purple`
42. 命中后 2s 冷却内不能再蓄势
43. 2s 冷却结束后恢复蓄势
44. 拇指在下、指尖上挑的 flick 发射（旧路径仍保留）
45. 重新蓄势（为拇指外弹用例准备）
46. 拇指**慢慢**外张（~660ms）不发射，蓄势保持
47. 拇指内扣 → 快速外张（指尖不动）发射
48. 同样外弹但中途丢 2 帧追踪：蓄势不取消，手重现为外张时仍发射

### 1.5 加用例的四个坑

- **2 秒冷却**：赫/茈/無量空処触发后要空步 drain ~60~80 帧（×33ms ≈ 2~2.6s）；苍释放是 2.5s 演出 + 2s 锁，
  需要 ~140~180 帧。现有用例习惯多 drain 到 180~260 帧，稳。参考红冷却的 9→10→11 节奏。
- **EMA 与帧数**：进入要 smoothed ≥0.75，姿势切换给足 20~25 帧；`redFormSeen` 这类「立即清零」的逻辑
  在单帧上生效，不需要长窗口。
- **前推链**：`scaledOpen1` / `scaledGun1` 的缩放必须逐帧递增且持续 ≥110ms、累计 ≥24% 才会释放；
  中间一帧不涨即断链。写「应该释放」的用例时给足 5 帧以上；写「不该释放」的用例时，
  一个 2~3 帧的尺寸跳变即可复现旧版误触。
- **拇指外弹**：用 `thumbUnder1`（拇指内扣）+ `gun1`（拇指外张）模拟跳变；`thumbLerp1` 做慢速外张的
  反例。跳变必须在 `PURPLE_CAST.snapWindowMs`（500ms）内且 `thumbGapRatio` 增幅 ≥0.15 才发射；
  用例之间重新蓄势要 drain 上一发的 2s 冷却（`step(gun1, 70)` 足够）。

### 1.6 视觉演示态

`?logictest=1&end=charge|blue|red|purplecharge|purpleburst|void`（加 `&nobanner=1` 可隐藏左上角测试横幅）：

- `charge`：武装苍后把球钉在屏幕中央并轻微摆动（看构筑球 + 尘埃被吸引、绕球）；
- `blue`：触发释放（看屏幕中央蓝爆 + 尘埃炸开）；
- `red`：合成枪形手保持 30 帧（看红场 + 尘埃被排开成净空）；
- `purplecharge`：开启茈模式、合成枪形蓄势，球钉在世界原点轻微摆动（看顶部按钮激活 + 小紫球 + 拖尾）；
- `purpleburst`：发射后把爆炸**钉在 94% 剩余时长**（约 100ms 处的早期爆心），避免软件渲染低帧率
  错过 1.6s 的爆炸；按钮冷却环同时保持可见；
- `void`：`forceTechnique('void')` + `updateState('void', true)`，直接展示白环 + 蓝色球壳的领域场
  （不需要摄像头）。

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
```

`nobanner=1` 只影响测试横幅；页面标题仍是 `LOGICTEST PASS`，也可以从窗口标题
（`xwininfo -root -tree`）确认结果。

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
- [ ] 重建 `logic-test.html`，截图确认 `LOGICTEST PASS`（48 项）
- [ ] 动过视觉 → 截 `end=charge` / `end=red` / `end=purplecharge` / `end=purpleburst` / `end=void`（或相应态）确认无穿帮
- [ ] 动过性能相关（fieldIdle、粒子数、DPR）→ D 面板看 fps，至少不劣化
- [ ] 仓库无临时文件（`git status` 干净；`logic-test.html` 保持 untracked）
- [ ] 提交（本地，不 push），汇报：做了什么 / 没动什么 / 风险点