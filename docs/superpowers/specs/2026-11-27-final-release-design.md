# 最终版设计：中英双语 · 更名 · 开场重排 · 目录整理 · 加载优化

日期：2026-11-27
状态：待主人确认
范围：`index.html`（单文件应用）、`tools/serve.py`、`tools/logic-test-driver.js`、`assets/tutorial/`、
`vendor/`（仅确认不删）、仓库根目录、`docs/`、`README.md`、`AGENTS.md`

## 1. 意图

这是 SAT0RU 改版的最后一版。主人要：

1. 站点名统一为 **五条悟术式模拟**，浏览器标题（`<title>`）一并改为同名；
   原副标题「咒术回战手势粒子工具 · 五条悟模式 · 单人拍摄 / 娱乐用途」改为「咒术回战手势触发模拟」。
2. 在开场界面提供语言选择，做一套**英文界面**。只翻译界面/说明文字；
   **技能名保持繁体中文**（蒼 / 赫 / 茈 / 無量空処、術式順転 / 術式反転 / 領域展開 / 虚式、以及术式字幕）。
3. 重新排版欢迎页：告诉用户支持/推荐的浏览器，以及主要性能提醒。
4. 整理文件夹与文档。
5. 做加载与资源优化，降低首屏体积、缩短重复访问与启动等待。

这是收尾版本，不引入新玩法，不改识别阈值。

## 2. 目标 / 非目标 / 反目标

**目标**

- 中文（默认）与英文两套完整界面，随时可切换、刷新后记住。
- 欢迎页重排后仍保留现有隐私声明、原作者/原项目/改版作者/网站、素材来源与联系邮箱。
- 首屏传输入账（gzip 后估算）：现状 ≈ HTML 60K + three/后处理 ~330K + MediaPipe 头脚本 ~57K（未压缩）
  + 音频 2.6M + 教程图 828K ≈ **3.9MB**；目标 ≈ HTML 60K + three/后处理 ~330K ≈ **0.4MB**，
  音频、教程图、启动模型全部推迟；重复访问由缓存直接命中。
  （three.js 保持静态 import，不为此重排场景构建；详见 §9.1。）
- 目录清晰：根目录只留入口与说明；无用留档移入 `docs/archive/`；文档与实现同步。
- 全量无摄像头回归 PASS（当前 265 项，新增语言/加载断言后数量上升），并做双语截图验收。

**非目标**

- 不翻译技能名、术式字幕、语音内容、`assets/tutorial` 里的手势图。
- 不新增外部请求、CDN、在线字体；仍然零外网请求。
- 不改手势识别、阈值、状态机、粒子/动画时间轴。
- 不把文档整体译成英文；文档仍以中文为主。

**反目标（即使技术可行也算失败）**

- 切换语言后技法名被译成英文，或字幕变成英文。
- 为了懒加载导致手势语音漏播、延迟明显，或首次点「启动」后长时间无反馈。
- 把 `index.html` 拆成多文件、引入构建步骤。
- 删除上游署名链接或把 `reinesana/SAT0RU` 改成自己的名字。

## 3. 约束

- 铁律：只本地提交、绝不 push；一切应用改动集中在 `index.html`；改后跑全量回归；
  视觉验收用 Xvfb + 有头 Firefox；临时文件不入库。
- 单文件应用，不引入外部 locale JSON。i18n 字典必须内嵌在 `index.html`。
- 服务只绑 `127.0.0.1:8787`，经 SSH 隧道/Tailscale 访问；手机端也要能用。
- 现有回归驱动大量断言中文文案与 DOM id，改造必须同步更新驱动并重建 `logic-test.html`。

## 4. 方案取舍

### 4.1 双语实现

| 方案 | 说明 | 取舍 |
|---|---|---|
| A. 内嵌字典 + `data-i18n` 标记（**采用**） | 中文原文保留在 HTML，新增 `I18N.en` 字典；静态节点用 `data-i18n` / `data-i18n-html` / `data-i18n-attr`，动态区域（指南、音频库、设置、教程、关于、状态文案）由同一字典重渲染 | 单一数据源、可测试、守住单文件；需要给现有节点补 key，改动面大但机械 |
| B. 中英两份 DOM，切换显隐 | 复制整块界面 | 文件暴增、易漂移、回归要维护两份，否 |
| C. 外部 `locales/*.json` | 运行时 fetch | 违反单文件铁律，首屏多请求，否 |

### 4.2 语言入口

采用主人选定：**欢迎页头部「中文 / English」切换，默认中文；左侧栏设置里加「语言」行可随时改；
选择写入 `localStorage`（`sat0ru.language`）**。切换即时生效，不重载页面。

默认不跟随浏览器语言：中文用户打开就是中文，避免英文系统误入英文版。

### 4.3 加载优化

| 方案 | 说明 | 取舍 |
|---|---|---|
| A. 全面（**采用**） | 音频按需、教程图懒加载并转 WebP、MediaPipe 脚本推迟到启动/空闲、`serve.py` gzip+缓存头、页面隐藏暂停渲染 | 首屏最轻；首次启动需等脚本加载（用「启动中」状态 + 空闲预取缓解） |
| B. 温和 | 只做懒加载 + 服务器缓存 | 首屏仍带 MediaPipe 脚本与 JPG，收益较小 |
| C. 激进 vendor 瘦身 | 再删 lite 模型、字体、非 SIMD wasm | 兼容性风险；本次不采用 |

保留 `vendor/fonts/`：主应用不引用、不会下载，但归档的旧开场页 CSS 仍引用它。
保留 `hand_landmark_lite.tflite` 与两套 wasm：`hands.js` 在 `modelComplexity=0` 或无 SIMD 时才回退使用，
不属于“无用文件”，删除会破坏兼容路径。

### 4.4 目录清理

采用主人选定：删除无用文件 + 旧页归档（详见 §7）。

## 5. 命名与文案

### 5.1 站点名

| 位置 | 中文（默认） | 英文 |
|---|---|---|
| `<title>` | 五条悟术式模拟 | Gojo Satoru Cursed Technique Simulator |
| 欢迎页品牌行 | 五条悟术式模拟 | Gojo Satoru Cursed Technique Simulator |
| 欢迎页大标题 | 欢迎来到 五条悟术式模拟 | Welcome to Gojo Satoru Cursed Technique Simulator |
| 欢迎页副标题 | 咒术回战手势触发模拟 | A cursed-technique gesture simulator |
| 左侧栏副标题 | 五条悟术式模拟 · GOJO MODE | GOJO SATORU · GOJO MODE |
| 顶部栏左侧 | 保持「呪術廻戦 / Domain Expansion」作为作品标识 | 同左 |

- 上游署名中的 `reinesana/SAT0RU`、改版仓库 `github.com/shanyaojinjin/SAT0RU`、关于页
  “SAT0RU · 原版项目”等**保留原名**，它们指项目而非本站站点名。
- 构建标记 `BUILD_TAG` 更新为最终版标识（如 `11-27 · 最终版`）。

### 5.2 技能名例外

以下在两种语言下都原样显示繁体中文，不进入翻译字典：

- 短名：`蒼`、`赫`、`茈`、`無量空処`
- 全名：`術式順転「蒼」`、`術式反転「赫」`、`虚式「茈」`、`領域展開「無量空処」`
- 术式字幕（`SUBTITLE_CALL_OUTS` 的 `術式順轉` / `術式反轉` / `領域展開` / `虛式` 与 `『…』`）
- 顶部栏技法名（`updateState` 写入的 `#technique-name` 内容）
- 教程页 `<h2>` 与图注里的繁中技名（图注可保留 `· 引力 / Lapse: Blue` 这类中英说明，说明部分随语言变）

英文句子里第一次提到技法时用“繁中名 + 英文说明”，例如：
`Blue (蒼)`, `Red (赫)`, `Purple (茈)`, `Domain Expansion: Infinite Void (無量空処)`；
之后可直接用英文名。音频库行如 `術式反転「赫」 · I`、`領域展開「無量空処」 · Solo`。

## 6. i18n 设计

### 6.1 状态与字典

```js
const LANG_KEY = 'sat0ru.language';       // 'zh' | 'en'，默认 'zh'
let lang = 'zh';
const I18N = { zh: {...}, en: {...} };    // 以 key 为索引；zh 可从现有 HTML 文案抽取
function t(key, vars) { ... }             // 支持 {n} 插值
function setLanguage(next, persist = true) { ... } // 更新 state、<html lang>、title、全部节点，重渲染动态区
```

- `lang` 变化时：`document.documentElement.lang = 'zh-CN' | 'en'`；
  `document.title = t('site.title')`；`aria-label`/`title`/`placeholder`/`alt` 一并更新。
- **首帧不闪中文（已保存英文的用户刷新）**：字典与 `setLanguage()` 的静态部分放进 `</body>` 前的
  classic inline `<script>`（早于 module 执行；此时 body DOM 已解析），读取
  `localStorage['sat0ru.language']` 并立即应用标题、`<html lang>` 与所有 `data-i18n` 节点，
  置 `window.__sat0ruLang`。module 内的动态渲染沿用同一份全局字典并补渲染动态区。
  module 仍静态 import three（约 1.27MB raw），但英文界面不会先显示中文再跳变。
- 静态节点标记：
  - `data-i18n="key"` → `textContent`
  - `data-i18n-html="key"` → `innerHTML`（含 `<strong>`、`<a>`、`<code>` 的段落）
  - `data-i18n-attr="title:key,aria-label:key2,placeholder:key3,alt:key4"`
- 动态区域：`I18N` 中存数组/对象，`renderGuide()`、`buildAudioLibrary()`、`updateKeybindMenu()`、
  `updateStartButton()`、`updateEggPanel()`、`renderAbout()`、`showIntroPage()` 每次按当前语言生成。
  切换语言时直接调用这些渲染函数 + `applyStaticI18n()`，不重建事件监听（用事件委托的地方保持）。
- 现有中文文案作为 `zh` 字典的基准；HTML 中默认文本保留中文，保证禁用 JS/加载失败时仍可读。

### 6.2 覆盖清单

| 区域 | 处理 |
|---|---|
| 欢迎页 5 页 | 标题、副标题、提示、卡片、步骤、图注说明、按钮、页脚提示、步骤计数 |
| 左侧栏 | 三个 tab、面板标题、设置行（调试/语音/长时间无量空处/自定义无量空处/**语言**）、音频库、指南、关于、底部提示 |
| 顶栏 | 启动按钮 6 种状态、摄像头 title、茈提示、茈按钮 title |
| 自定义无量空处弹层 | 标题、提示、关闭、版本说明、输入框 placeholder、保存按钮、校验提示、iframe title |
| 技法字幕 | **不翻译**（保持现繁中） |
| 控制台日志 | 不翻译（非界面），保留 `SAT0RU` 前缀 |
| 动态技法名 | **不翻译**（繁中） |

### 6.3 语言选择 UI

- 欢迎页头部品牌行右侧：`[中文] [English]` 两个 pill，当前语言高亮，带 `aria-pressed`。
- 设置面板新增一行「语言 · Language」，右侧两个小按钮 `中` / `EN`；切换后整页即时更新，
  欢迎页若仍打开也同步更新。
- 所有切换入口共用 `setLanguage()`。

## 7. 欢迎页重排

保留对话框结构、5 页流程和页脚按钮；只重排第 1 页（welcome）。

```
┌──────────────────────────────────────────────────────┐
│ 五条悟术式模拟            [中文] [English]    01 / 05 │
├──────────────────────────────────────────────────────┤
│ 欢迎来到 五条悟术式模拟                               │
│ 咒术回战手势触发模拟                                   │
│                                                      │
│ ┌── 推荐环境 ──────────┐ ┌── 性能提醒 ─────────────┐ │
│ │ • Chrome / Edge 最新版 │ │ • 开启浏览器硬件加速      │ │
│ │   （桌面端最佳）        │ │ • 关闭其他占显卡的标签页  │ │
│ │ • Firefox 最新版可用    │ │ • 光线充足、背景清晰      │ │
│ │ • Safari 17+ 可用，     │ │ • 低端设备/软件渲染可能   │ │
│ │   部分 iPhone 性能较弱  │ │   只有 1–3 fps，属正常    │ │
│ │ • 需要 HTTPS 或         │ │ • 桌面 Chrome / Edge      │ │
│ │   localhost、摄像头权限 │ │   体验最佳               │ │
│ │   WebGL + WebAssembly   │ │                          │ │
│ └───────────────────────┘ └──────────────────────────┘ │
│                                                      │
│ 隐私：不会上传任何内容…（保留原文关键句）              │
│ 原作 / 原版项目 / 改版作者 / 个人网站                  │
│ 素材声明 + 联系邮箱                                    │
│                                         [我已知晓]    │
└──────────────────────────────────────────────────────┘
```

- 文案要点：
  - 推荐 Chrome / Edge 最新版（桌面端最佳）；Firefox 最新版可用；Safari 17+ 可用但部分 iPhone/iPad 性能较弱。
  - 必须 HTTPS 或 localhost、允许摄像头、浏览器支持 WebGL 与 WebAssembly。
  - 性能：开启硬件加速、关闭其他占用 GPU 的标签页/程序；光线充足、背景清晰；
    低端设备或软件渲染可能掉到 1–3 fps，属正常现象；桌面 Chrome / Edge 体验最佳。
- 保留回归断言依赖的关键中文短语：`芥见下下`、`reinesana/SAT0RU`、`闪耀金金`、`shany.cc`、
  `不会上传任何内容`、`MediaPipe Hands`、`所有用到的素材均来源于网络`、`shanyaojinjin@gmail.com`、
  `光线充足`、`背景清晰`。重排时不要改掉这些词。
- 窄屏/横屏：两卡片改为纵向堆叠；`max-height` 与滚动沿用现有规则。

## 8. 目录与文档整理

### 8.1 删除 / 移动

| 操作 | 对象 | 理由 |
|---|---|---|
| `git rm` | `ost.mp3`（18MB） | 音乐开关已移除，代码无引用；README 标注为留档，但无展示价值，git 历史可找回 |
| `git rm` | `.DS_Store` | macOS 垃圾文件 |
| `git rm` | `package-lock.json`（85B，空包） | 无 node 依赖/构建 |
| `git mv` | `DomainExpansion-infintevoid/` → `docs/archive/domain-expansion-pr7/` | 未接入 UI 的旧 PR #7 开场页，归档到 docs 下；内部 CSS 用绝对 `/vendor/fonts/...`，经 `serve.py` 仍可打开 |
| 新增 | `docs/archive/README.md` | 说明归档内容、为何保留、不接入主应用 |
| 新增 | `.gitignore` 增加 `.DS_Store` | 防止再次入库 |
| 替换 | `assets/tutorial/*.jpg` → `*.webp` | 见 §9；原 JPG 由 git 历史保留 |

### 8.2 文档更新

- `README.md`：站点名、副标题、双语特性、浏览器/性能要求、新目录树、加载策略、回归数量。
- `AGENTS.md`：首段描述、命名、双语锚点（`setLanguage`、`I18N`、`data-i18n`、`sat0ru.language`）、
  懒加载锚点、目录表（归档路径）、回归数量。
- `docs/ARCHITECTURE.md`：标题更名；修正过期行数（现约 5553 行，不是 2100）；
  新增 §「本地化（i18n）」与 §「加载与缓存」；更新归档路径与回归数量。
- `docs/TESTING.md`：新回归数量与命令；新增语言切换、懒加载、缓存头验收步骤；
  双语欢迎页截图菜谱。
- `docs/CHANGELOG.md`：新增最终版条目（更名、双语、欢迎页重排、目录整理、加载优化、验证结果）。
- 保留本设计文档于 `docs/superpowers/specs/`。

## 9. 加载与资源优化

### 9.1 `index.html`

1. **MediaPipe 脚本懒加载**
   - 移除 `<head>` 中三条 `vendor/mediapipe/...` 同步 `<script src>`（三者合计约 57KB：
     camera_utils 7.9K + hands 45.6K + drawing_utils 3.8K）。
   - 新增 `loadMediaPipeScripts()`：按 `camera_utils → hands → drawing_utils` 顺序动态注入，
     `crossorigin="anonymous"`，返回 Promise；`startCameraPipeline()` 首先 await 它，失败则
     `cameraStatus='error'`、按钮显示「启动失败」。
   - 教程关闭后空闲时（`requestIdleCallback`，兜底 `setTimeout 2000`）用 `<link rel="prefetch">`
     预热这三条小脚本，但不下载 15MB wasm/模型；真正的启动等待仍来自 `new Hands` 之后拉取的
     `hands_solution_*_bin.js`（约 553KB）与 wasm/`.data`/`.tflite`（约 15MB）。
   - three.js 与场景构建**保持现状静态 import / 立即初始化**：那是应用本体，推迟会重排整个 module
     且拖慢首屏粒子可见时间，收益只是把 330KB gzip 挪后。首屏目标按 §2 的 0.4MB 记账。
2. **音频按需**
   - 9 个 `<audio>` 全部改 `preload="none"`。
   - 桌面/Android：`primeAudio()` 只静音试播短音频（blue、he-1、he-2、void、purple、fail、creed）；
     长音频 `void-long`（1.2MB）、`purple-clasp`（0.88MB）在教程关闭后空闲预取，首次触发时确保 `load()`。
   - iOS/Safari：autoplay 解锁需要逐元素在用户手势内试播，故首次 pointerdown 仍静音试播**全部 9 条**
     （本次手势内开始下载约 2.6MB），避免长版/契印首次在 MediaPipe 回调里 `play()` 被拒。
     用 `isIOS`/Safari 检测分流；桌面路径不受影响。
   - `play()` 若仍被拒：记录待播 key，在下一次 pointerdown 重试一次；字幕仍只跟随真实播放，
     不改变现有字幕时间轴与断言。
   - 字幕时长回退值不变；播放计数逻辑不变。
3. **教程图**
   - 4 张 JPG（828KB）转 WebP（质量 ~82，目标合计 < 300KB；实测后定），路径改 `.webp`。
   - `<img>` 改为 `data-src`，进入对应教程页时才设置 `src`；欢迎页显示后空闲预取第一张（blue）。
   - 保留 `alt`（随语言翻译）与图注繁中技名；补 `width/height` 或 CSS 比例避免布局跳动。
4. **渲染**
   - `WebGLRenderer` 增加 `powerPreference: 'high-performance'`。
   - `document.hidden` 时暂停 RAF（或 `renderer.setAnimationLoop(null)`），恢复时重置时钟增量，
     避免回到前台时粒子跳变。
   - 不改粒子数量、bloom 参数、像素比上限（1.5）。

### 9.2 `tools/serve.py`

- **缓存头**：`/vendor/`、`/assets/`、`/audio/` → `Cache-Control: public, max-age=31536000, immutable`；
  `*.html` 与 `/` → `Cache-Control: no-cache`（每次校验，保证更新即生效）。
- **gzip**：当 `Accept-Encoding` 含 gzip 时，对 `.html/.js/.css/.json/.svg/.wasm/.data/.tflite` 压缩；
  设置 `Content-Encoding: gzip`、`Vary: Accept-Encoding`。压缩结果按 `(path, mtime, size)` 内存缓存
  （上限约 64MB，带锁，适配 `ThreadingHTTPServer`），避免大 wasm 每次请求重复压缩。
- 保留现有 MIME 映射与 127.0.0.1 绑定；不加 Range（当前播放只需从头读）。
- 交付时 `systemctl --user restart sat0ru` 使服务器改动生效。

### 9.3 预期收益

- 首屏：HTML gzip 约 50–80KB + three/后处理 gzip 约 330KB ≈ **0.4MB**；
  不再在打开页面时下载 2.6MB 音频、828KB 教程图、57KB MediaPipe 头脚本。
- 重复访问：vendor/音频/图片强缓存（immutable），只重新校验 HTML；three 与 HTML 命中缓存后更快。
- 启动：空闲预热三条头脚本（57KB，命中缓存）；wasm/模型 15MB 仍在这一刻下载，
  「启动中」状态可见，避免误以为没反应。
- 教程：欢迎页不再拉四张图；进入对应技式页才加载单张 WebP。
- 手机/iOS：首次手势会多下载音频（解锁必须），但首屏与教程图收益不变。

## 10. 测试与验收

1. **回归**：更新 `tools/logic-test-driver.js` 后重新生成 `logic-test.html`，全量 PASS。新增断言：
   - 中文默认：title/品牌/副标题为新名；欢迎页含浏览器与性能提醒关键句。
   - 切换 English：`<html lang="en">`、title 英文、品牌英文、启动按钮英文、
     技法音频标签仍含 `術式反転「赫」` 等繁中技名、字幕仍繁中。
   - 刷新持久化：`localStorage['sat0ru.language'] === 'en'` 后再加载仍英文。
   - 教程图：切换语言/进入页面前 `data-src` 为 `.webp`、进入后 `src` 被设置、四个文件可 fetch。
   - 音频：`preload="none"`；首次交互只预热短音频；长音频首次触发后可播。
   - MediaPipe：初始页面无 `script[src*="mediapipe"]`；模拟点击「启动」后注入三条脚本（回归里用
     stub/可注入标记，不真正建 Hands）。
   - 欢迎页关键中文短语仍在（旧断言保持通过）。
2. **服务验收**：`curl -H 'Accept-Encoding: gzip' -I` 检查 `Content-Encoding`、`Cache-Control`；
   浏览器二次加载看 Network（from memory/disk cache）。
3. **视觉验收**：Xvfb + 有头 Firefox，截图欢迎页中文/英文（窄屏各一张）、设置面板（语言行）、
   指南/关于英文、顶部启动状态。临时文件不留在仓库。
4. **体积核对**：首屏 transferred、启动耗时 before/after。
5. **收尾**：中文提交信息、`feat:`/`fix:` 前缀、末尾 `Co-Authored-By`；只本地提交，不 push。

## 11. 风险与缓解

| 风险 | 缓解 |
|---|---|
| i18n 漏改或切换后动态区仍是旧语言 | 统一 `applyStaticI18n()` + 动态渲染函数；回归逐区断言 |
| 懒加载 MediaPipe 导致首次启动等待变长 | 「启动中」状态、空闲预热三条头脚本、错误状态可见；大头 wasm/模型本来就在启动时下载 |
| 音频按需导致语音漏播/延迟 | 桌面短音频首次交互即预热、长音频空闲预取；iOS/Safari 首次手势静音试播全部 9 条以解锁；被拒则下次手势重试 |
| 英文用户刷新先闪中文 | 字典与静态应用提前到 `</body>` 前 classic inline script，早于 module 执行 |
| WebP 兼容 | 目标浏览器（Chrome/Edge/Firefox 最新版、Safari 17+）均支持；回归 fetch 校验 |
| serve.py 压缩拖慢大文件 | 内存缓存 + 锁；只压缩文本类；实测启动时间 |
| 删除文件不可逆感 | 全部走 git 历史，可在本地恢复；提交前汇总清单给主人 |
| 回归数量/文档过期 | 交付时同步 TESTING/ARCHITECTURE/AGENTS 的实际数量 |

## 12. 留给实现者的判断

- 英文文案的最终措辞（在保持信息量与语气一致的前提下可微调）。
- WebP 质量参数与是否保留 `width/height` 具体值。
- 欢迎页两卡片在 600px/横屏下的具体断点与间距。
- `requestIdleCallback` 的兜底时长与预取顺序。
- 语言切换是否播放任何过渡（默认不加动画）。