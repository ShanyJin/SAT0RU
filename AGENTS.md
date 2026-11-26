# AGENTS.md · SAT0RU

给新会话的第一页。读完这页就能上手；深水区在 `docs/`。

## 这是什么

主人的私人「咒术回战」手势粒子工具（含摄像头实拍合成），默认「五条悟模式」：

- **術式順転「蒼」**（引力）：张开→握拳→张开 → 构筑蓝色粒子球 → 用力前推/合掌释放（慢移、横挥只跟手）
- **術式反転「赫」**（排斥）：食指向上指，或枪形（食指+中指并拢、拇指外张）→ 红色场

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
3. **改识别/阈值后必须跑 25 项无摄像头回归**（`docs/TESTING.md` 有完整命令），跑完再交付。
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
| `docs/CHANGELOG.md` | 十二次改造史（含每轮为什么改） |

## 去哪改（grep 锚点）

- 手势判定/阈值 → `handShape()`、`computeHandScores()`、`TUNING`、`CHARGE`、`BLUE_SEQ`
- 苍的形态 → `ORB_RINGS`、`fillOrbPositions()`、`animate()` 的 charge 块
- 赫的手势/锚点 → `gunForm`、`redAnchor`、`redFollow`
- 环境尘埃（苍吸/赫斥）→ `DUST_COUNT` 种子 + `animate()` 的 dust 块
- 技法名/指南 → `updateState()` 的 `nameEl`、`GUIDE_GOJO`、`GUIDE_ALL`
- 参数怎么调、为什么是现在这个值 → `docs/ARCHITECTURE.md` §参数速查

## 交付习惯

- 改完：重建回归 → 25/25 PASS →（涉及视觉就）截图验 → 提交 → 汇报做了什么/没动什么/风险点。
- 提交信息中文、`feat:/fix:` 前缀，末尾带 `Co-Authored-By` 行。