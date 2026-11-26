# 测试与验收 · SAT0RU

两条线：**逻辑靠无摄像头回归**（合成关键点喂真实管线，25 项 PASS/FAIL），
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

### 1.4 25 项断言（按顺序）

1. neutral 初始
2. 枪形动作不误触苍（张开→收指→张开恰好凑成蓝时序的回归）
3. 赫 枪形触发
4. 赫 枪形收手退场
5. 赫 食指指触发
6. 两形态互换不断档
7. 短暂丢手（8 帧）桥接仍红
8. 收手退场
9. 冷却期重指不触发
10. 冷却期回摆不误触苍
11. 冷却结束赫恢复
12. 苍1 构筑武装（open 8 → fist 6 → open 6），同一断言确认仍未绽放（currentTech 仍 neutral）
13. 慢速拖动 ~0.36/s 不打断，球只跟手
14. 手指/掌尺寸抖动不打断（交替 ±8% 缩放 + 3 帧 +24% 关键点跳变）
15. 快速横向挥手 ~1.8/s 不打断
16. 构筑期指赫不打断
17. 持续前推释放（掌尺寸 1.0→1.5，连续增长 ≥110ms、累计 ≥24%，blue）
18. 动画中其他手势被忽略
19. 冷却期赫被忽略
20. 苍2 双手构筑
21. 丢追踪释放（丢手 34 帧 ≈1.1s 后，blue）
22. 合掌构筑武装
23. 合掌释放（blue）
24. 只张开不触发
25. 握拳→张开不触发

### 1.5 加用例的两个坑

- **8 秒冷却**：任何一次 blue/red 触发后，后续用例必须先空步 drain（约 180~260 帧 × 33ms ≈ 6~8.6s），
  否则测的是冷却而不是你想测的东西。参考用例 9→10→11 的节奏。
- **EMA 与帧数**：进入要 smoothed ≥0.75，姿势切换给足 20~25 帧；`redFormSeen` 这类「立即清零」的逻辑
  在单帧上生效，不需要长窗口。
- **前推链**：`scaledOpen1` 的缩放必须逐帧递增且持续 ≥110ms、累计 ≥24% 才会释放；中间一帧不涨即断链。
  写「应该释放」的用例时给足 5 帧以上；写「不该释放」的用例时，一个 2~3 帧的尺寸跳变即可复现旧版误触。

### 1.6 视觉演示态

`?logictest=1&end=charge|blue|red`：

- `charge`：武装苍后把球钉在屏幕中央并轻微摆动（看构筑球 + 尘埃被吸引、绕球）；
- `blue`：触发释放（看屏幕中央蓝爆 + 尘埃炸开）；
- `red`：合成枪形手保持 30 帧（看红场 + 尘埃被排开成净空）。

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

调用（等 16~18s 让 llvmpipe 把粒子跑起来）：

```bash
cd /home/lain/sat0ru
python3 tools/serve.py . 8787 &   # 或 systemctl --user start sat0ru
xvfb-run -a -s "-screen 0 1280x900x24" bash /tmp/ffshot.sh \
  "http://127.0.0.1:8787/logic-test.html?logictest=1" /tmp/shot-test.png 16
xvfb-run -a -s "-screen 0 1280x900x24" bash /tmp/ffshot.sh \
  "http://127.0.0.1:8787/logic-test.html?logictest=1&end=charge" /tmp/shot-charge.png 18
xvfb-run -a -s "-screen 0 1280x900x24" bash /tmp/ffshot.sh \
  "http://127.0.0.1:8787/logic-test.html?logictest=1&end=red" /tmp/shot-red.png 18
```

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
- [ ] 重建 `logic-test.html`，截图确认 `LOGICTEST PASS`（25 项）
- [ ] 动过视觉 → 截 `end=charge` / `end=red`（或相应态）确认无穿帮
- [ ] 动过性能相关（fieldIdle、粒子数、DPR）→ D 面板看 fps，至少不劣化
- [ ] 仓库无临时文件（`git status` 干净；`logic-test.html` 保持 untracked）
- [ ] 提交（本地，不 push），汇报：做了什么 / 没动什么 / 风险点