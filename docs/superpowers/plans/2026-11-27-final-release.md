# 五条悟术式模拟 · 最终版实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 SAT0RU 改版收尾为「五条悟术式模拟」最终版：中英双语界面（技能繁中名不译）、重排欢迎页、整理目录文档、优化加载与缓存，并保持全量回归通过。

**Architecture:** 在 `index.html` 内用内嵌字典 + `data-i18n` 驱动双语，语言状态存 `localStorage`，字典与静态应用放在 module 之前的 classic inline script 以避免英文刷新闪中文；动态区域由同一字典重渲染。加载侧把音频/教程图/MediaPipe 头脚本改为按需，`tools/serve.py` 加 gzip 与强缓存。技能繁中名、术式字幕、顶部技法名保持原样。

**Tech Stack:** 单文件 HTML + three.js r160 + MediaPipe Hands（本地 vendor）+ Python `http.server`；回归用 `tools/logic-test-driver.js` 注入生成 `logic-test.html`，Xvfb + 有头 Firefox 读取窗口标题验收。

**Spec:** `docs/superpowers/specs/2026-11-27-final-release-design.md`

## Global Constraints

- 只本地提交，**绝不 push**；提交信息中文、`feat:`/`fix:` 前缀，末尾 `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`。
- 应用逻辑只改 `index.html`；工具在 `tools/`；不拆文件、不加构建步骤、不发外部请求。
- 技能名 `蒼`/`赫`/`茈`/`無量空処` 及全名、术式字幕、顶部技法名在两种语言下都保持繁体中文。
- 默认语言中文；`localStorage` 键 `sat0ru.language`，值 `zh`|`en`。
- 站点名中文 `五条悟术式模拟`，英文 `Gojo Satoru Cursed Technique Simulator`；
  副标题中文 `咒术回战手势触发模拟`，英文 `A cursed-technique gesture simulator`。
- 不改识别阈值、状态机、粒子数量、动画时间轴。
- 回归：现基线 265 项，任务完成后必须全量 PASS，数量记入文档。
- 临时文件只放 `/tmp`；`logic-test.html` 保持 untracked（已在 `.gitignore`）。
- 服务只绑 `127.0.0.1`；测试服务器用 8799 端口，避开常驻的 8787。

## Review Focus

1. **已保存英文后刷新**：首帧不能先显示中文再跳变；由 module 前的 classic inline script 应用静态文案。验证：预置 `sat0ru.language=en` 后重载截图。
2. **iOS/被拒的自动播放**：长版/契印语音首次触发必须能播或被重试；iOS 首次手势静音试播全部 9 条，`play()` 被拒则下次 pointerdown 重试。
3. **技法进行中切换语言**：不得重置当前技法/蓄势/字幕，顶部技法名仍是繁中。回归断言切换后 `currentTech === 'red'`。
4. **MediaPipe 懒加载幂等与竞态**：重复调用不得重复注入脚本（回归断言恰好 3 个）；
   加载期间关掉「启动」不得在之后创建 `Hands`（`startCameraPipeline()` await 后检查 `cameraEnabled`，代码审阅）。
5. **420×900 与低矮横屏的欢迎页**：两张卡片不得横向溢出或把按钮挤出可视区。用 Chromium 窄屏截图验收。

---

### Task 1: 仓库清理与旧页归档

**Files:**
- Delete: `ost.mp3`, `.DS_Store`, `package-lock.json`
- Move: `DomainExpansion-infintevoid/` → `docs/archive/domain-expansion-pr7/`
- Create: `docs/archive/README.md`
- Modify: `.gitignore`, `README.md`, `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/CHANGELOG.md`

**Interfaces:**
- Consumes: 无
- Produces: 归档路径 `docs/archive/domain-expansion-pr7/`；根目录不再有 18MB 音频与元数据垃圾

- [ ] **Step 1: 确认文件无引用，记录回滚点**

```bash
cd /home/lain/sat0ru
git rev-parse HEAD
grep -rn "ost.mp3" index.html tools/ audio/ assets/ || true
grep -rn "package-lock" index.html tools/ README.md || true
grep -rn "DomainExpansion-infintevoid" --exclude-dir=.git --exclude-dir=.git . | head
```

Expected: `ost.mp3` 只在 `README.md`/`docs` 的留档说明中出现；`package-lock` 无代码引用。

- [ ] **Step 2: 删除无用文件并更新 .gitignore**

```bash
git rm ost.mp3 .DS_Store package-lock.json
printf '\n# macOS 元数据\n.DS_Store\n' >> .gitignore
```

- [ ] **Step 3: 归档旧开场页**

```bash
mkdir -p docs/archive
git mv DomainExpansion-infintevoid docs/archive/domain-expansion-pr7
```

- [ ] **Step 4: 写归档说明**

`docs/archive/README.md`：

```markdown
# 归档

## domain-expansion-pr7/

旧 PR #7 的独立「無量空処」开场页（HTML/CSS/参考图）。动画已移植进主场景
（`index.html` 的 `VOID_CINEMA`），此页**不接入 UI**，仅作留档。
它引用 `/vendor/fonts/` 的绝对路径，经 `tools/serve.py` 仍可打开；不属于主应用加载路径。
```

- [ ] **Step 5: 更新文档中的旧路径**

把以下文件里的 `DomainExpansion-infintevoid/` 改成 `docs/archive/domain-expansion-pr7/`，
并把 `ost.mp3` 行从「文件留档」改为「已删除，可在 git 历史找回」：

- `README.md:145` 附近
- `AGENTS.md` 目录表
- `docs/ARCHITECTURE.md:350` 附近
- `docs/CHANGELOG.md:483` 附近

- [ ] **Step 6: 验证**

```bash
test ! -e ost.mp3 && test ! -e .DS_Store && test ! -e package-lock.json && echo clean
test -d docs/archive/domain-expansion-pr7 && echo archived
grep -rn "DomainExpansion-infintevoid" --exclude-dir=.git . || echo no-stale-paths
python3 tools/serve.py . 8799 & SERVER=$!; sleep 0.5
curl -sI http://127.0.0.1:8799/ | head -1
curl -sI http://127.0.0.1:8799/docs/archive/domain-expansion-pr7/DomainExpansion_infinite-void.html | head -1
kill $SERVER
```

Expected: `clean`、`archived`、`no-stale-paths`、两条 `200 OK`。

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "chore: 清理仓库垃圾文件并把旧开场页归档

Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>"
```

---

### Task 2: i18n 基础设施 + 更名 + 语言切换

**Files:**
- Modify: `index.html`（`<title>`、欢迎页 head、module 前新增 classic script、`setLanguage()`、设置行、`setRailOpen`）
- Modify: `tools/logic-test-driver.js`（新增语言断言，插在 `} catch (err) {` 之前）
- Modify: CSS（语言 pill / 设置行样式）

**Interfaces:**
- Consumes: 无
- Produces:
  - `window.SAT0RU_I18N = { zh, en }`
  - `window.SAT0RU_LANG`（`'zh'|'en'`）
  - `window.sat0ruT(key, vars?) -> string`
  - `window.sat0ruApplyStaticI18n()`
  - module 内 `setLanguage(next: 'zh'|'en', persist = true)`：更新静态+动态并写 `localStorage`
  - DOM：欢迎页 `#intro-lang` 两个按钮 `[data-lang="zh"]`/`[data-lang="en"]`；设置面板 `#lang-row`（**不带** `data-action`）

- [ ] **Step 1: 写失败回归断言**

在 `tools/logic-test-driver.js` 的 `        } catch (err) {` 之前插入（保持 `try` 内、demo 分支之外）：

```js
        if (!endMode) {
            const langBtn = (code) => document.querySelector('#intro-lang [data-lang="' + code + '"]');
            const welcomeTextLater = document.querySelector('#intro-modal [data-intro-page="welcome"]')?.textContent || '';
            markState('language defaults to Chinese', 'zh-CN', document.documentElement.lang || 'missing');
            markState('site title uses the new Chinese name', '五条悟术式模拟', document.title || 'missing');
            markState('welcome uses the new Chinese name and tagline', 'ok ok',
                [welcomeTextLater.includes('五条悟术式模拟'), welcomeTextLater.includes('咒术回战手势触发模拟')]
                    .map((ok) => (ok ? 'ok' : 'missing')).join(' '));
            markState('settings hold a language row outside the switches', 'yes',
                (document.getElementById('lang-row')
                    && !document.getElementById('lang-row').closest('[data-action]')) ? 'yes' : 'no');
            if (langBtn('en')) langBtn('en').click();
            markState('English switch updates html lang', 'en', document.documentElement.lang || 'missing');
            markState('English switch updates the title', 'Gojo Satoru Cursed Technique Simulator', document.title || 'missing');
            markState('English switch localizes the rail tabs', 'Mode & Audio,Guide,About',
                Array.from(document.querySelectorAll('#left-rail .rail-tab')).map((b) => b.textContent.trim()).join(','));
            markState('English start label is localized', 'yes',
                ['Start', 'Starting…', 'Waiting for tracking', 'Tracking', 'Tracking error', 'Start failed']
                    .includes((document.getElementById('start-btn-label') || {}).textContent || '') ? 'yes' : 'no');
            markState('English keeps technique names in Traditional Chinese', 'ok ok',
                [document.getElementById('audio-list')?.textContent.includes('術式反転「赫」'),
                    document.getElementById('audio-list')?.textContent.includes('術式順転「蒼」')]
                    .map((ok) => (ok ? 'ok' : 'missing')).join(' '));
            markState('language choice is persisted', 'en', localStorage.getItem('sat0ru.language') || 'missing');
            if (langBtn('zh')) langBtn('zh').click();
            markState('switching back restores Chinese', 'zh-CN', document.documentElement.lang || 'missing');
            markState('switching back restores the Chinese title', '五条悟术式模拟', document.title || 'missing');
        }
```

- [ ] **Step 2: 重建并运行回归，确认新断言 FAIL**

```bash
python3 tools/make-logic-test.py index.html logic-test.html tools/logic-test-driver.js
# 常驻服务已在 127.0.0.1:8787 提供本仓库；若未运行：systemctl --user start sat0ru
cat > /tmp/ffcheck.sh <<'EOF'
#!/bin/bash
set -u
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
user_pref("datareporting.policy.dataSubmissionPolicyBypassNotification", true);
UJS
export LIBGL_ALWAYS_SOFTWARE=1
firefox --profile "$PROFILE" --new-instance --no-remote "$1" &
FPID=$!
sleep "${2:-24}"
xwininfo -root -tree | grep -o 'LOGICTEST[^"]*' | head -1
kill "$FPID" 2>/dev/null; wait "$FPID" 2>/dev/null; rm -rf "$PROFILE"
EOF
chmod +x /tmp/ffcheck.sh
xvfb-run -a -s "-screen 0 1280x900x24" bash /tmp/ffcheck.sh "http://127.0.0.1:8787/logic-test.html?logictest=1" 24
```

Expected: 窗口标题 `LOGICTEST FAIL ...`，明细含 `language defaults` / `site title` 等。

- [ ] **Step 3: 写早期 bootstrap 与字典**

在 `    <div id="debug-panel"></div>` 与 `<script type="module">` 之间插入 classic `<script>`：

- `const LANG_KEY='sat0ru.language';`
- `const I18N={zh:{...},en:{...}};`
- 必需键（两种语言）：
  - `site.title`: `五条悟术式模拟` / `Gojo Satoru Cursed Technique Simulator`
  - `welcome.brand`: 同上
  - `welcome.title`: `欢迎来到 五条悟术式模拟` / `Welcome to Gojo Satoru Cursed Technique Simulator`
  - `welcome.tagline`: `咒术回战手势触发模拟` / `A cursed-technique gesture simulator`
  - `rail.sub`: `五条悟术式模拟 · GOJO MODE` / `GOJO SATORU · GOJO MODE`
  - `rail.tab.main|guide|about`: `模式与音频|指南|关于` / `Mode & Audio|Guide|About`
  - `start.off|starting|waiting|tracking|stalled|error`: `启动|启动中|等待追踪|追踪中|追踪异常|启动失败` /
    `Start|Starting…|Waiting for tracking|Tracking|Tracking error|Start failed`
  - `menu.expand|collapse`: `打开控制栏|收起控制栏` / `Open control rail|Collapse control rail`
  - `lang.row`, `lang.zh`, `lang.en`: `语言 · Language|中文|English` / `Language · 语言|中文|English`
- 函数 `t(key,vars)` 支持 `{name}` 插值；`applyStaticI18n()` 遍历
  `[data-i18n]`、`[data-i18n-html]`、`[data-i18n-attr]`（格式 `attr:key,...`）。
- 初始化：读 `localStorage`，无值用 `zh`；设置 `document.documentElement.lang`、`document.title`、
  应用静态节点；`window.SAT0RU_I18N=I18N; window.SAT0RU_LANG=lang; window.sat0ruT=t; window.sat0ruApplyStaticI18n=applyStaticI18n;`
- 暴露 `window.sat0ruSetLang(next, persist)` 供 module 调用，内部只做 lang/storage/静态应用，不改动态区。

- [ ] **Step 4: 标记静态节点并更名**

- `<title>` 改 `五条悟术式模拟`；`<html lang>` 保持 `zh-CN`（运行时会改）。
- 欢迎页品牌行：`<div class="intro-brand">SAT0RU <span>五条悟模式 · 启动说明</span></div>`
  → `<div class="intro-brand"><span data-i18n="welcome.brand">五条悟术式模拟</span>
  <span data-i18n="welcome.brandSub">启动说明</span></div>`（英文 `Setup`）。
- 欢迎大标题与副标题加 `data-i18n="welcome.title"` / `welcome.tagline`，文本改为新名/新副标题。
- 左侧栏 `#rail-mode` 初始文本改 `五条悟术式模拟 · GOJO MODE`，加 `data-i18n="rail.sub"`；
  删除 module 中 `railModeEl.innerText = 'SAT0RU · GOJO MODE'` 的硬编码。
- 三个 `.rail-tab` 加 `data-i18n`。
- 在欢迎页 `.intro-head` 的品牌行后加：

```html
<div class="intro-lang" id="intro-lang" role="group" aria-label="语言 / Language">
    <button class="intro-lang-btn active" type="button" data-lang="zh" aria-pressed="true">中文</button>
    <button class="intro-lang-btn" type="button" data-lang="en" aria-pressed="false">English</button>
</div>
```

- 设置面板 `#settings-list` 之后加（与开关行同视觉，但**不要** `data-action`）：

```html
<div class="set-row lang-row" id="lang-row">
    <span class="kb-key" aria-hidden="true">文</span>
    <span class="set-label" data-i18n="lang.row">语言 · Language</span>
    <span class="lang-picks" role="group" aria-label="语言 / Language">
        <button class="lang-pick active" type="button" data-lang="zh" aria-pressed="true">中</button>
        <button class="lang-pick" type="button" data-lang="en" aria-pressed="false">EN</button>
    </span>
</div>
```

- 其余界面文案此时可暂留中文（Task 3 处理），但不得出现第二个 `SAT0RU` 品牌位。

- [ ] **Step 5: 模块内接上 setLanguage 与事件**

- `const t = (key, vars) => window.sat0ruT(key, vars);`
- `function setLanguage(next, persist = true) { window.sat0ruSetLang(next, persist); syncLangButtons(); buildGuide(); buildAudioLibrary(); updateKeybindMenu(); updateEggPanel(); showIntroPage(introPage); updateStartButton(); setRailOpen(railOpen); }`
  （`buildGuide`/`buildAudioLibrary` 在 Task 3 才真正按语言生成，此处调用它们保证顺序正确。）
- `syncLangButtons()`：所有 `[data-lang]` 按 `window.SAT0RU_LANG` 设 `active` 与 `aria-pressed`。
- 事件委托：`#intro-lang` 与 `#lang-row` 上监听 `[data-lang]`，调用 `setLanguage(btn.dataset.lang)`。
- 启动时调用 `syncLangButtons()`；`updateStartButton()` 用 `t('start.'+cameraStatus)` 映射（`off`/`starting`/`on`→`waiting`/`tracking`/`stalled`/`error`）。
- `setRailOpen` 的 label 改用 `t('menu.expand'|'menu.collapse')`。
- `updateKeybindMenu()`：语言行不重建；仅确保 `#lang-row` 存在时调用 `syncLangButtons()`。

- [ ] **Step 6: 加 CSS**

- `.intro-lang { margin-left:auto; display:flex; gap:4px; }`；`.intro-lang-btn` 圆形/胶囊小按钮，
  激活用 `--accent`；`#intro-lang` 在窄屏可换行。
- `.lang-row` 沿用 `.set-row` 的布局但不带 track；`.lang-picks` 右对齐，两个小按钮。
- `#lang-row` 放在 `#settings-list` 之后，不参与 `.set-track` 的开关动画。

- [ ] **Step 7: 重建并运行回归，确认 PASS**

```bash
python3 tools/make-logic-test.py index.html logic-test.html tools/logic-test-driver.js
xvfb-run -a -s "-screen 0 1280x900x24" bash /tmp/ffcheck.sh "http://127.0.0.1:8787/logic-test.html?logictest=1" 26
```

Expected: 窗口标题 `LOGICTEST PASS`（Task 3 前允许其它旧断言仍通过）。

- [ ] **Step 8: 语法检查**

```bash
python3 -I - <<'EOF'
import re
html = open('index.html', encoding='utf-8').read()
m = re.findall(r'<script type="module">(.*?)</script>', html, re.S)
open('/tmp/sat0ru-check.mjs','w',encoding='utf-8').write(m[-1])
open('/tmp/sat0ru-boot.js','w',encoding='utf-8').write(
    re.findall(r'<script>(.*?)</script>', html, re.S)[-1])
EOF
node --check /tmp/sat0ru-check.mjs && node --check /tmp/sat0ru-boot.js
```

- [ ] **Step 9: 提交**

```bash
git add index.html tools/logic-test-driver.js
git commit -m "feat: 站点更名五条悟术式模拟并加入中英语言切换基础

Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>"
```

---

### Task 3: 全量界面双语覆盖

**Files:**
- Modify: `index.html`（欢迎页 5 页、顶栏、侧栏、关于、蛋面板、动态渲染函数、字幕保持）
- Modify: `tools/logic-test-driver.js`（各区英文断言）

**Interfaces:**
- Consumes: Task 2 的 `window.sat0ruT` / `setLanguage()` / `#intro-lang` / `#lang-row`
- Produces:
  - `GUIDE_GOJO` → `getGuide()` 返回当前语言行（中文内容保持原文）
  - `AUDIO_TRACKS` 仍存 key/dur，label 由 `audioLabel(trackKey)` 生成
  - 设置/状态/蛋面板所有文案经 `t()`

- [ ] **Step 1: 写失败回归断言**

在 Task 2 的 `if (!endMode) {...}` 块内、切回中文之前追加：

```js
            markState('English localizes the welcome tutorial body', 'yes',
                (document.querySelector('#intro-modal [data-intro-page="blue"]')?.textContent || '')
                    .includes('Four fingers fully extended') ? 'yes' : 'no');
            markState('English localizes the settings labels', 'yes',
                (document.getElementById('settings-list')?.textContent || '')
                    .includes('Technique Voices') ? 'yes' : 'no');
            markState('English localizes the gesture guide', 'yes',
                (document.getElementById('gesture-guide')?.textContent || '')
                    .includes('Construct') ? 'yes' : 'no');
            markState('English localizes the about page labels', 'yes',
                (document.getElementById('about-body')?.textContent || '')
                    .includes('Fork author') ? 'yes' : 'no');
            markState('English localizes the custom void panel', 'yes',
                (document.getElementById('egg-panel')?.textContent || '')
                    .includes('Custom Infinite Void') ? 'yes' : 'no');
            markState('English audio labels keep the Traditional Chinese technique name', 'yes',
                (document.getElementById('audio-list')?.textContent || '')
                    .includes('術式反転「赫」 · I') ? 'yes' : 'no');
            if (typeof updateState === 'function') updateState('red', true);
            markState('English keeps the top-bar technique name in Traditional Chinese', '術式反転「赫」',
                document.getElementById('technique-name')?.textContent.trim() || 'missing');
            if (langBtn('zh')) langBtn('zh').click(); // 在技法进行中切回中文
            markState('a technique in progress survives a language switch', 'red',
                (typeof currentTech !== 'undefined') ? currentTech : 'missing');
            if (typeof updateState === 'function') updateState('neutral', true);
```

- [ ] **Step 2: 重建并确认 FAIL**

```bash
python3 tools/make-logic-test.py index.html logic-test.html tools/logic-test-driver.js
xvfb-run -a -s "-screen 0 1280x900x24" bash /tmp/ffcheck.sh "http://127.0.0.1:8787/logic-test.html?logictest=1" 26
```

Expected: `LOGICTEST FAIL`，含 `English localizes ...`。

- [ ] **Step 3: 欢迎页与顶栏静态文案**

给以下节点加 `data-i18n` / `data-i18n-html` / `data-i18n-attr`，并在字典补齐英文：

- 欢迎页：游玩提示、隐私两段（含 `<strong>` 用 `-html`）、四条作者/项目信息、素材声明、页脚提示、
  `[data-intro-action]` 按钮、`#intro-step` 之外的按钮文案（由 `showIntroPage` 动态设置）。
- 教程四页：每步 `<strong>标签：</strong>` 与正文、`.intro-tip`、图注说明（技名保持繁中，
  说明如 `引力/斥力/投射/领域` 随语言变）、图片 `alt`（用 `data-i18n-attr="alt:key"`）。
  英文第一页蓝教程第一句必须含 `Four fingers fully extended`。
- 顶栏：`#purple-hint`（`Click to enable Imaginary Technique: Purple (茈)`）、
  `#purple-mode-btn` 的 `title`、`#start-btn` 的 `title`（动态）、`#menu-btn` 的 `title`（动态），
  左 h1 `呪術廻戦 / Domain Expansion` **保持原样**。
- 保留回归依赖的中文关键短语：`芥见下下`、`reinesana/SAT0RU`、`闪耀金金`、`shany.cc`、
  `不会上传任何内容`、`MediaPipe Hands`、`所有用到的素材均来源于网络`、`shanyaojinjin@gmail.com`、
  `光线充足`、`背景清晰`（中文态）。

- [ ] **Step 4: 侧栏/关于/蛋面板**

- 三个 tab 标题（Task 2 已加）、`#rail-panel-main/guide/about` 面板标题、
  `#audio` 区块标题、`#rail-foot`。
- 关于页所有 `.about-k`/`.about-note`/`.about-sep`/`.about-video` 文案逐条加 key；英文保留
  `Gege Akutami`、`reinesana/SAT0RU`、`shany.cc`、两条 BV 链接、mailto、开源项目名与许可证、
  `Fork author` 标签。
- 蛋面板：标题、提示、关闭按钮、版本标签、说明段落（`-html`，含 `<code>`）、
  `placeholder`（URL 不变）、保存按钮、`iframe title`。
- `document.title` 不由静态标记设置，继续由 `setLanguage` 管。

- [ ] **Step 5: 动态渲染函数按语言生成**

- `GUIDE_GOJO` 拆成 `getGuide(lang)`：中文内容原样保留；英文提供逐条翻译，
  `tech` 用 `Form`/`Release`/`Construct`/`Deploy`/`Launch`/`Auto`；
  `sep` 保留 `術式… · English` 原文（技名不译）。
- `AUDIO_TRACKS` 改存 `labelZh`/`labelEn`，或 `audioLabel(key)`：
  `blue: 術式順転「蒼」`；`he-1/he-2: 術式反転「赫」 · 一/二` → 英文 ` · I/II`；
  `void: 領域展開「無量空処」 · 単人` → ` · Solo`；`void-long: … · 長時間` → ` · Long`；
  `purple: 虚式「茈」 · 短` → ` · Short`；`purple-clasp: … · 双手契印` → ` · Two-Hand Clasp`；
  `fail: 失败 · 人声` → `Fail · Voice`；`creed: 校训 · 人声` → `Creed · Voice`。
  英文 `audio-list` 必须含 `術式反転「赫」 · I`。`title="播放 …"` 用 `Play …`。
- `updateKeybindMenu()`：设置标签走 `t()`；蛋行 note（`版本 3 · 未设链接`、`版本 N`、`B 站视频`）
  走 `t()`；**语言行不进入 `settings` 数组**，保证 `data-action` 顺序仍是 `debug,voice,voidlong,egg`。
- `showIntroPage()`：`introNextBtn.textContent`（`明白了，开始/下一个`）、`introFootNote` 三种状态、
  步骤计数保持数字；`INTRO_TECH_LABELS` 繁中不变。
- `updateStartButton()`：状态走 `start.*` key；title 用 `关闭摄像头 · {label}` / `启动摄像头` 的英文对应。
- `setRailOpen()`：`menu.*`；`updateEggPanel()`/`setEggCustomNote()`/`saveVoidEggCustom()`：
  已保存、未设链接、三种校验错误、版本说明全部走 `t()`（插值 `{video}`、`{version}`、`{page}`）。
- `describeVoidEggCustom()`：`（第 {n} 集）` → 英文 `(part {n})`。
- **不改**：`SUBTITLE_CALL_OUTS`、`SUBTITLE_FALLBACK_MS`、`updateState` 的技法名、
  `INTRO_TECH_LABELS`、控制台日志。

- [ ] **Step 6: 重建并确认 PASS**

```bash
python3 tools/make-logic-test.py index.html logic-test.html tools/logic-test-driver.js
xvfb-run -a -s "-screen 0 1280x900x24" bash /tmp/ffcheck.sh "http://127.0.0.1:8787/logic-test.html?logictest=1" 28
```

Expected: `LOGICTEST PASS`。

- [ ] **Step 7: 提交**

```bash
git add index.html tools/logic-test-driver.js
git commit -m "feat: 完成中英双语界面，技能繁中名保持不译

Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>"
```

---

### Task 4: 欢迎页重排（推荐环境 + 性能提醒）

**Files:**
- Modify: `index.html`（welcome 页 markup + CSS + 字典）
- Modify: `tools/logic-test-driver.js`（welcome 卡片断言）

**Interfaces:**
- Consumes: Task 2 的 `#intro-lang`、`sat0ruT`
- Produces: welcome 页新增 `推荐环境` / `性能提醒` 两卡片；保留原有四条署名、隐私、素材声明、关键短句

- [ ] **Step 1: 写失败断言**

在既有欢迎页断言后（`intro asks for a bright clear play space` 附近）追加：

```js
            markState('welcome lists supported browsers', 'yes',
                ['Chrome', 'Edge', 'Firefox', 'Safari'].every((b) => welcomeText.includes(b)) ? 'yes' : 'no');
            markState('welcome warns about performance', 'yes',
                (welcomeText.includes('硬件加速') && welcomeText.includes('1–3 fps')) ? 'yes' : 'no');
```

在 Task 3 的英文块（已切到 English 之后）追加，**重新读取**欢迎页文本（不能用切换前捕获的
`welcomeTextLater`）：

```js
            const welcomeTextEn = document.querySelector('#intro-modal [data-intro-page="welcome"]')?.textContent || '';
            markState('English welcome keeps the support and performance cards', 'ok ok',
                [welcomeTextEn.includes('Recommended setup'), welcomeTextEn.includes('Performance tips')]
                    .map((ok) => (ok ? 'ok' : 'missing')).join(' '));
```

- [ ] **Step 2: 重建确认 FAIL**

```bash
python3 tools/make-logic-test.py index.html logic-test.html tools/logic-test-driver.js
xvfb-run -a -s "-screen 0 1280x900x24" bash /tmp/ffcheck.sh "http://127.0.0.1:8787/logic-test.html?logictest=1" 28
```

Expected: `LOGICTEST FAIL`（浏览器/性能断言）。

- [ ] **Step 3: 重排 markup**

把 welcome 页改成（保留原有 facts/notice/asset 节点，仅调整顺序与容器）：

```html
<div class="intro-hero">
    <h2 class="intro-title" id="intro-welcome-title" data-i18n="welcome.title">欢迎来到 五条悟术式模拟</h2>
    <p class="intro-sub" data-i18n="welcome.tagline">咒术回战手势触发模拟</p>
</div>
<div class="intro-cards">
    <section class="intro-card">
        <div class="intro-card-title" data-i18n="welcome.supportTitle">推荐环境</div>
        <ul class="intro-card-list">
            <li data-i18n="welcome.supportChrome">Chrome / Edge 最新版（桌面端体验最佳）</li>
            <li data-i18n="welcome.supportFirefox">Firefox 最新版可用</li>
            <li data-i18n="welcome.supportSafari">Safari 17+ 可用；部分 iPhone / iPad 性能较弱</li>
            <li data-i18n="welcome.supportNeeds">需要 HTTPS 或 localhost、摄像头权限，以及 WebGL 与 WebAssembly</li>
        </ul>
    </section>
    <section class="intro-card">
        <div class="intro-card-title" data-i18n="welcome.perfTitle">性能提醒</div>
        <ul class="intro-card-list">
            <li data-i18n="welcome.perfAccel">开启浏览器硬件加速</li>
            <li data-i18n="welcome.perfTabs">关闭其他占用显卡的标签页或程序</li>
            <li data-i18n="welcome.perfLight">请在光线充足、背景清晰的环境中游玩，手部识别会更稳定</li>
            <li data-i18n="welcome.perfFps">低端设备或软件渲染可能只有 1–3 fps，属正常现象；桌面 Chrome / Edge 最佳</li>
        </ul>
    </section>
</div>
<!-- 原有 .intro-facts / .intro-notice / .intro-asset-note 依次放在卡片之后 -->
```

英文文案：`Recommended setup`、`Performance tips`，正文包含 `Chrome`、`Edge`、`Firefox`、`Safari`、
`hardware acceleration`、`1–3 fps`。

- [ ] **Step 4: CSS**

- `.intro-cards { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:12px 0; }`
- `.intro-card { border:1px solid var(--stroke); border-radius:10px; background:var(--bg-surface); padding:12px 14px; }`
- `.intro-card-title { font-size:12px; font-weight:600; color:var(--accent); margin-bottom:6px; }`
- `.intro-card-list { margin:0; padding-left:16px; font-size:12px; line-height:1.65; color:var(--text-secondary); }`
- `@media (max-width:600px)` / `max-height:480px`：`.intro-cards{grid-template-columns:1fr}`；
  `#intro-lang{flex-wrap:wrap}`；确保 `.intro-dialog` 仍可滚动。
- 删除旧的 `.intro-play-tip` 样式或改为卡片内提示（关键中文短句移到性能卡片）。

- [ ] **Step 5: 重建并确认 PASS**

```bash
python3 tools/make-logic-test.py index.html logic-test.html tools/logic-test-driver.js
xvfb-run -a -s "-screen 0 1280x900x24" bash /tmp/ffcheck.sh "http://127.0.0.1:8787/logic-test.html?logictest=1" 28
```

Expected: `LOGICTEST PASS`。

- [ ] **Step 6: 窄屏截图**

```bash
CHROME=~/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome
"$CHROME" --headless=new --no-sandbox --disable-dev-shm-usage \
  --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars \
  --window-size=420,900 --virtual-time-budget=6000 \
  --screenshot=/tmp/welcome-zh-420.png "http://127.0.0.1:8787/"
```

用 Read 查看截图：两张卡片纵向堆叠、语言按钮可见、`我已知晓` 不被挤出。

- [ ] **Step 7: 提交**

```bash
git add index.html tools/logic-test-driver.js
git commit -m "feat: 重排欢迎页，加入支持浏览器与性能提醒

Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>"
```

---

### Task 5: 加载与资源优化（index.html + 教程图）

**Files:**
- Modify: `index.html`（audio 元素、`primeAudio`、图片加载、MediaPipe 加载、renderer、animate/visibility）
- Create: `assets/tutorial/{blue,red,purple,void}.webp`
- Delete: `assets/tutorial/*.jpg`（git 历史保留）
- Modify: `tools/logic-test-driver.js`（懒加载断言、图片断言改写）

**Interfaces:**
- Consumes: 现有 `startCameraPipeline()`、`AUDIO_TRACKS`、`showIntroPage()`
- Produces:
  - `async function loadMediaPipeScripts(): Promise<void>`（幂等；脚本带 `data-mediapipe`）
  - `function isIOSLike(): boolean`
  - `function ensureLongAudio(key: string): void`
  - `window.__sat0ruAudioState()` → `{ primed: string[], prefetched: string[] }`
  - 教程图 `<img data-src="/assets/tutorial/*.webp">`，首次进入对应页才设 `src`

- [ ] **Step 1: 写失败断言**

**改写**现有教程图断言（约 `const introImgSources = ...` 一带）为：

```js
            const introImgs = Array.from(document.querySelectorAll('#intro-modal .intro-figure img'));
            const introImgSources = introImgs.map((img) => img.getAttribute('data-src') || '');
            markState('tutorial images are local webp files', 'local,local,local,local',
                introImgSources.map((src) => (src.startsWith('/assets/tutorial/') && src.endsWith('.webp') ? 'local' : 'remote')).join(','));
            const introImgServed = await Promise.all(introImgSources.map(async (src) => {
                try { return (await fetch(src)).ok; } catch (e) { return false; }
            }));
            markState('tutorial image files are served', '4/4',
                introImgServed.filter(Boolean).length + '/4');
            markState('tutorial images wait for their page', '0/4',
                introImgs.filter((img) => img.getAttribute('src')).length + '/4');
```

在走完教程到 void 页之后追加：

```js
            markState('tutorial images load as their pages open', '4/4',
                introImgs.filter((img) => (img.getAttribute('src') || '').endsWith('.webp')).length + '/4');
```

在 Task 3 英文块之后（`!endMode` 内）追加：

```js
            markState('audio elements do not preload at startup', '9/9',
                Array.from(document.querySelectorAll('audio')).filter((a) => a.preload === 'none').length + '/9');
            markState('MediaPipe scripts stay out of the first load', '0',
                String(document.querySelectorAll('script[src*="/vendor/mediapipe/"]').length));
            markState('MediaPipe lazy loader exists', 'function', typeof loadMediaPipeScripts);
            await loadMediaPipeScripts();
            markState('MediaPipe header scripts load on demand', '3',
                String(document.querySelectorAll('script[data-mediapipe]').length));
            markState('MediaPipe lazy loading is idempotent', '3',
                (await loadMediaPipeScripts(),
                    String(document.querySelectorAll('script[data-mediapipe]').length)));
```

- [ ] **Step 2: 重建确认 FAIL**

```bash
python3 tools/make-logic-test.py index.html logic-test.html tools/logic-test-driver.js
xvfb-run -a -s "-screen 0 1280x900x24" bash /tmp/ffcheck.sh "http://127.0.0.1:8787/logic-test.html?logictest=1" 28
```

Expected: `LOGICTEST FAIL`（webp / preload / lazy loader）。

- [ ] **Step 3: 转换教程图并取尺寸**

```bash
python3 -I - <<'EOF'
from PIL import Image
for name in ('blue', 'red', 'purple', 'void'):
    im = Image.open(f'assets/tutorial/{name}.jpg').convert('RGB')
    im.save(f'assets/tutorial/{name}.webp', 'WEBP', quality=82, method=6)
    print(name, im.size)
EOF
git rm assets/tutorial/blue.jpg assets/tutorial/red.jpg assets/tutorial/purple.jpg assets/tutorial/void.jpg
```

把打印出的宽高写进对应 `<img width height>`；转换后四张合计应 < 400KB（`du -ch assets/tutorial/*.webp`）。

- [ ] **Step 4: 教程图懒加载**

- `<img src=...>` → `<img data-src="/assets/tutorial/blue.webp" width="..." height="..." alt="..." ...>`。
- 新增 `loadIntroImage(name)`：取 `[data-intro-page=name] img[data-src]`，把 `data-src` 赋给 `src` 并移除 `data-src`。
- `showIntroPage(index)` 在切换后调用 `loadIntroImage(name)`（welcome 不加载）。
- `finishIntro()` 或首次 pointerdown 后空闲预取 `blue.webp`（`new Image().src = ...`），不阻塞。

- [ ] **Step 5: 音频按需**

- 9 个 `<audio>` 全部 `preload="none"`。
- 定义 `const LONG_AUDIO_KEYS = ['void-long', 'purple-clasp'];`
- `isIOSLike()`：`/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)`；Safari 判定用 `!/Chrome|CriOS|Edg/.test(ua) && /Safari/.test(ua)`。
- `primeAudio()`：
  - 记录 `primedAudioKeys`，只处理短音频（非 `LONG_AUDIO_KEYS`）；
  - 若 `isIOSLike() || isSafari`，仍静音试播全部 9 条；
  - 保留现有 muted→pause→unmute 逻辑与 `audioPrimed` 标记。
- `ensureLongAudio(key)`：`audio.preload='auto'; audio.load();`，记录 `prefetchedAudioKeys`。
- `playAudioClip(key, manual)`：若 key 在 `LONG_AUDIO_KEYS` 且未预取，先 `ensureLongAudio(key)`；
  `play()` 的 `.catch()` 中把 key 放入 `pendingAudioRetry`；`pointerdown` 监听器（非 once）重试一次并清空。
  **不要**改动计数与字幕逻辑。
- 教程关闭后 `requestIdleCallback(() => LONG_AUDIO_KEYS.forEach(ensureLongAudio), {timeout: 3000})`（兜底 `setTimeout 2500`）；iOS 已在手势内试播，跳过预取。
- 暴露 `window.__sat0ruAudioState = () => ({ primed: [...primedAudioKeys], prefetched: [...prefetchedAudioKeys] });`

- [ ] **Step 6: MediaPipe 懒加载**

- 删除 `<head>` 三条 MediaPipe `<script src>`。
- 新增：

```js
const MEDIA_PIPE_SCRIPTS = [
    '/vendor/mediapipe/camera_utils/camera_utils.js',
    '/vendor/mediapipe/hands/hands.js',
    '/vendor/mediapipe/drawing_utils/drawing_utils.js'
];
let mediaPipeLoadPromise = null;
function loadMediaPipeScripts() {
    if (mediaPipeLoadPromise) return mediaPipeLoadPromise;
    mediaPipeLoadPromise = MEDIA_PIPE_SCRIPTS.reduce((chain, src) => chain.then(() => new Promise((resolve, reject) => {
        const el = document.createElement('script');
        el.src = src;
        el.crossOrigin = 'anonymous';
        el.dataset.mediapipe = '1';
        el.onload = resolve;
        el.onerror = () => reject(new Error('MediaPipe script failed: ' + src));
        document.head.appendChild(el);
    })), Promise.resolve()).catch((err) => { mediaPipeLoadPromise = null; throw err; });
    return mediaPipeLoadPromise;
}
```

- `startCameraPipeline()` 首行 `await loadMediaPipeScripts();`（在 `cameraStarting = true` 之后、`new Hands` 之前）；
  catch 走现有错误路径。若 `!cameraEnabled` 已关，函数返回前不创建 `Hands`（现有 `if (!hands)` 之前加：
  `if (!cameraEnabled) return;`）。
- 教程结束后空闲 `requestIdleCallback` 注入 `<link rel="prefetch" href=... as="script">` 三条（兜底 2000ms），不下载 wasm/模型。
- 回归里的 `loadMediaPipeScripts` 会真正加载三条脚本（57KB），之后 `Hands`/`Camera` 全局可用，不影响 stub。

- [ ] **Step 7: 渲染优化**

- `new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })`。
- `animate()` 顶部改为：

```js
let renderRafId = 0;
function animate() {
    if (document.hidden) { renderRafId = 0; return; }
    renderRafId = requestAnimationFrame(animate);
    ...
}
```

- 现有 `visibilitychange` 监听器内追加：可见时 `if (!renderRafId) renderRafId = requestAnimationFrame(animate);`
  隐藏时 `cancelAnimationFrame(renderRafId); renderRafId = 0;`（先 cancel 再置 0，避免双循环）。
- 保留文件末尾的首次 `animate();` 调用不变：`animate()` 自己赋值 `renderRafId`，只启动一次；
  页面若在隐藏状态打开，则由 visibility 监听器在可见时启动。

- [ ] **Step 8: 语法检查 + 重建 + PASS**

```bash
python3 -I - <<'EOF'
import re
html = open('index.html', encoding='utf-8').read()
m = re.findall(r'<script type="module">(.*?)</script>', html, re.S)
open('/tmp/sat0ru-check.mjs','w',encoding='utf-8').write(m[-1])
open('/tmp/sat0ru-boot.js','w',encoding='utf-8').write(
    re.findall(r'<script>(.*?)</script>', html, re.S)[-1])
EOF
node --check /tmp/sat0ru-check.mjs && node --check /tmp/sat0ru-boot.js
python3 tools/make-logic-test.py index.html logic-test.html tools/logic-test-driver.js
xvfb-run -a -s "-screen 0 1280x900x24" bash /tmp/ffcheck.sh "http://127.0.0.1:8787/logic-test.html?logictest=1" 30
```

Expected: `LOGICTEST PASS`。

- [ ] **Step 9: 提交**

```bash
git add index.html assets/tutorial tools/logic-test-driver.js
git commit -m "feat: 教程图与音频按需加载，MediaPipe 脚本延迟到启动

Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>"
```

---

### Task 6: serve.py gzip 与缓存

**Files:**
- Modify: `tools/serve.py`

**Interfaces:**
- Consumes: 现有 MIME 与 `sys.argv` 用法（`serve.py <dir> <port>`）
- Produces: gzip 响应、`Cache-Control`、`Vary`；压缩结果内存缓存

- [ ] **Step 1: 记录现状（失败基线）**

```bash
cd /home/lain/sat0ru
python3 tools/serve.py . 8799 & SERVER=$!; sleep 0.5
curl -sI -H 'Accept-Encoding: gzip' http://127.0.0.1:8799/index.html | grep -Ei 'content-encoding|cache-control|vary' || echo none
kill $SERVER
```

Expected: `none`（无压缩/无缓存头）。

- [ ] **Step 2: 实现**

在 `tools/serve.py` 中：

- 顶部 `import gzip, io, os, threading`
- 常量：
  - `COMPRESSIBLE = {'.html','.js','.mjs','.css','.json','.svg','.wasm','.data','.tflite'}`
  - `IMMUTABLE_PREFIXES = ('/vendor/','/assets/','/audio/')`
  - `_cache = {}`、`_cache_lock = threading.Lock()`、`CACHE_MAX = 64 * 1024 * 1024`
- 函数 `cache_control_for(path)`：路径（URL 解码后）以 immutable 前缀开头 → `public, max-age=31536000, immutable`；
  `.html` → `no-cache`；其它 → `no-cache`。
- 覆盖 `send_head(self)`：
  1. 解析 `self.translate_path(self.path)`；**若目标是目录且含 `index.html`，改用该文件**（网页实际访问 `/`，
     不能绕过压缩）；非文件、后缀不在 `COMPRESSIBLE` 或客户端不接受 gzip → `super().send_head()`。
  2. `st = os.stat(path)`；键 `(path, st.st_mtime_ns, st.st_size)`；锁内查 `_cache`，未命中则 `gzip.compress(open(...).read(), mtime=0)` 并写入；
     总量超 `CACHE_MAX` 时清空缓存（简单可靠）。
  3. `send_response(200)`；`Content-Type: self.guess_type(path)[0]`；`Content-Encoding: gzip`；
     `Content-Length: len(body)`；`Last-Modified: self.date_time_string(st.st_mtime)`；
     `Cache-Control: cache_control_for(self.path)`；`Vary: Accept-Encoding`；`end_headers()`；返回 `io.BytesIO(body)`。
- 覆盖 `end_headers(self)`：若尚未发送，给非压缩分支补 `Cache-Control`（用 `cache_control_for`），再 `super().end_headers()`。
  简单做法：在 `send_head` 的 `super()` 分支后无法插入，改为重写 `dated_message`；更直接的是在 `end_headers` 里
  `if not getattr(self, '_cache_header_sent', False): self.send_header('Cache-Control', cache_control_for(self.path))`，
  然后在压缩分支发送前设 `self._cache_header_sent = True` 并自行发头。
- 保留 MIME 注册、`log_message` 静默、127.0.0.1 绑定与端口参数。

- [ ] **Step 3: 验证**

```bash
python3 tools/serve.py . 8799 & SERVER=$!; sleep 0.5
echo '--- html gzip ---'
curl -sI -H 'Accept-Encoding: gzip' http://127.0.0.1:8799/index.html | grep -Ei 'HTTP/|content-encoding|content-length|cache-control|vary'
echo '--- root gets the same gzip path ---'
curl -sI -H 'Accept-Encoding: gzip' http://127.0.0.1:8799/ | grep -Ei 'HTTP/|content-encoding|content-length|cache-control|vary'
echo '--- vendor immutable ---'
curl -sI -H 'Accept-Encoding: gzip' http://127.0.0.1:8799/vendor/three/build/three.module.js | grep -Ei 'HTTP/|content-encoding|cache-control'
echo '--- audio immutable, no gzip ---'
curl -sI -H 'Accept-Encoding: gzip' http://127.0.0.1:8799/audio/blue.mp3 | grep -Ei 'HTTP/|content-encoding|cache-control'
echo '--- no accept-encoding ---'
curl -sI http://127.0.0.1:8799/index.html | grep -Ei 'HTTP/|content-encoding|cache-control'
echo '--- decompressed body ---'
curl -s --compressed http://127.0.0.1:8799/index.html | head -c 40
echo
echo '--- wasm MIME ---'
curl -sI http://127.0.0.1:8799/vendor/mediapipe/hands/hands_solution_wasm_bin.wasm | grep -i content-type
kill $SERVER
```

Expected: html 与 `/` 都有 `Content-Encoding: gzip`；html/vendor 有 `Vary: Accept-Encoding`；html `Cache-Control: no-cache`；
vendor 与 audio `immutable`；audio 无 `Content-Encoding`；无 `Accept-Encoding` 时无 gzip；body 以 `<!DOCTYPE html>` 开头；
wasm `application/wasm`。

- [ ] **Step 4: 压缩比与耗时**

```bash
python3 tools/serve.py . 8799 & SERVER=$!; sleep 0.5
curl -s -o /dev/null -w 'html gz %{size_download} bytes %{time_total}s\n' -H 'Accept-Encoding: gzip' http://127.0.0.1:8799/index.html
curl -s -o /dev/null -w 'three gz %{size_download} bytes %{time_total}s\n' -H 'Accept-Encoding: gzip' http://127.0.0.1:8799/vendor/three/build/three.module.js
kill $SERVER
```

Expected: html gz < 100KB；three gz ≤ 400KB；第二次同类请求（缓存命中）耗时明显更低。

- [ ] **Step 5: 重启常驻服务**

```bash
systemctl --user restart sat0ru
systemctl --user is-active sat0ru
curl -sI -H 'Accept-Encoding: gzip' http://127.0.0.1:8787/ | grep -Ei 'HTTP/|content-encoding|cache-control'
```

Expected: `active`、`200 OK`、`Content-Encoding: gzip`。

- [ ] **Step 6: 提交**

```bash
git add tools/serve.py
git commit -m "feat: 静态服务器加 gzip 与缓存头，重复访问更快

Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>"
```

---

### Task 7: 全量验收、文档整理与最终提交

**Files:**
- Modify: `README.md`, `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `docs/CHANGELOG.md`
- Modify: `index.html`（`BUILD_TAG`）
- Include: `docs/superpowers/specs/2026-11-27-final-release-design.md`、本计划

**Interfaces:**
- Consumes: 前六个任务的全部产出
- Produces: 最终版文档、回归数量、截图记录

- [ ] **Step 1: 最终回归**

```bash
cd /home/lain/sat0ru
cat > /tmp/ffcheck.sh <<'EOF'
#!/bin/bash
set -u
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
user_pref("datareporting.policy.dataSubmissionPolicyBypassNotification", true);
UJS
export LIBGL_ALWAYS_SOFTWARE=1
firefox --profile "$PROFILE" --new-instance --no-remote "$1" &
FPID=$!
sleep "${2:-24}"
xwininfo -root -tree | grep -o 'LOGICTEST[^"]*' | head -1
kill "$FPID" 2>/dev/null; wait "$FPID" 2>/dev/null; rm -rf "$PROFILE"
EOF
chmod +x /tmp/ffcheck.sh
python3 tools/make-logic-test.py index.html logic-test.html tools/logic-test-driver.js
xvfb-run -a -s "-screen 0 1280x900x24" bash /tmp/ffcheck.sh "http://127.0.0.1:8787/logic-test.html?logictest=1" 32
```

Expected: `LOGICTEST PASS`。再截一张带横幅的图读取 `· N assertions`：

```bash
cat > /tmp/ffshot.sh <<'EOF'
#!/bin/bash
set -u
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
user_pref("datareporting.policy.dataSubmissionPolicyBypassNotification", true);
UJS
export LIBGL_ALWAYS_SOFTWARE=1
firefox --profile "$PROFILE" --new-instance --no-remote "$1" &
FPID=$!
sleep 32
gnome-screenshot -f "$2"
kill "$FPID" 2>/dev/null; wait "$FPID" 2>/dev/null; rm -rf "$PROFILE"
EOF
chmod +x /tmp/ffshot.sh
xvfb-run -a -s "-screen 0 1280x900x24" bash /tmp/ffshot.sh "http://127.0.0.1:8787/logic-test.html?logictest=1" /tmp/final-pass.png
```

Read 截图确认绿色横幅与断言总数，记下 N。

- [ ] **Step 2: 双语与状态截图**

```bash
# 中文欢迎页（Firefox 视觉）
xvfb-run -a -s "-screen 0 1280x900x24" bash /tmp/ffshot.sh "http://127.0.0.1:8787/" /tmp/final-welcome-zh.png
# 英文欢迎页：用 Chromium 预置 localStorage 后加载
CHROME=~/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome
"$CHROME" --headless=new --no-sandbox --disable-dev-shm-usage \
  --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars \
  --window-size=1280,900 --virtual-time-budget=8000 \
  --screenshot=/tmp/final-en-check.png \
  "http://127.0.0.1:8787/logic-test.html?logictest=1&nobanner=1"
```

英文态在回归末尾会自动切回中文；用 Chromium + CDP 预置 `localStorage` 后重载，直接验首帧英文
（同时覆盖 Review Focus 1）。`websockets` 10.4 没有 sync API，用 Node 24 自带 `WebSocket`：

```bash
cat > /tmp/sat0ru-cdp.mjs <<'EOF'
import fs from 'node:fs';
const tabs = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = tabs.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
let seq = 0;
ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    const done = pending.get(msg.id);
    if (done) { pending.delete(msg.id); done(msg); }
};
await new Promise((resolve) => { ws.onopen = resolve; });
const call = (method, params = {}) => new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const js = async (expression) => (await call('Runtime.evaluate', { expression })).result.result.value;
const shot = async (path) => {
    const r = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path, Buffer.from(r.result.data, 'base64'));
};
await js("localStorage.setItem('sat0ru.language','en')");
await call('Page.reload', { ignoreCache: true });
await sleep(6000);
console.log('title:', await js('document.title'));
await shot('/tmp/final-welcome-en.png');
await js("document.getElementById('intro-ack').click();");
await sleep(1000);
await shot('/tmp/final-blue-en.png');
await js("document.getElementById('intro-modal').hidden=true; document.getElementById('left-rail').classList.remove('collapsed'); document.querySelector('.rail-tab[data-tab=\"guide\"]').click();");
await sleep(1000);
await shot('/tmp/final-guide-en.png');
ws.close();
EOF

CHROME=~/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome
rm -rf /tmp/sat0ru-prof
"$CHROME" --headless=new --no-sandbox --disable-dev-shm-usage \
  --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars \
  --remote-debugging-port=9333 --user-data-dir=/tmp/sat0ru-prof \
  --window-size=1280,900 "http://127.0.0.1:8787/" &
CHROME_PID=$!
sleep 2
node /tmp/sat0ru-cdp.mjs
kill $CHROME_PID 2>/dev/null
```

Expected: 打印 `Gojo Satoru Cursed Technique Simulator`；三张图分别显示英文欢迎页（含两卡片）、
英文蓝教程、英文指南；技名仍为繁中 `術式順転「蒼」`。中文欢迎页截图同时确认两卡片与语言按钮。

- [ ] **Step 3: 更新 `BUILD_TAG`**

`index.html`：`const BUILD_TAG = '11-27 · 最终版 · 五条悟术式模拟';`
回归 `about shows the build tag` 会读取它，无需改断言。

- [ ] **Step 4: 更新文档**

- `README.md`：首行改名；新增「双语 / 推荐浏览器 / 性能提醒 / 加载优化」小节；目录树更新
  （`docs/archive/`、`assets/tutorial/*.webp`、无 `ost.mp3`）；回归数量改 N；
  说明 `preload="none"`、懒加载、`serve.py` gzip/缓存；保留上游署名与链接。
- `AGENTS.md`：首段改新名/副标题；目录表更新；「去哪改」新增：
  `window.SAT0RU_I18N`/`sat0ruT`/`setLanguage`/`#intro-lang`/`#lang-row`/`sat0ru.language`；
  `loadMediaPipeScripts`、`ensureLongAudio`、`data-src`、`serve.py` 缓存/gzip；技能繁中例外规则；
  回归数量 N。
- `docs/ARCHITECTURE.md`：标题改名；行数改为实际值（`wc -l index.html`）；新增「本地化（i18n）」与
  「加载与缓存」两节（字典位置、早期 bootstrap、技术名例外、音频/图片/MediaPipe 按需、serve.py 头）；
  归档路径更新；回归数量 N。
- `docs/TESTING.md`：回归数量 N；新增语言/懒加载/缓存断言说明；截图菜谱加双语欢迎页；
  交付清单把「设置 5 个开关」改为「设置开关 + 语言行」；确认无头/有头说明不变。
- `docs/CHANGELOG.md`：新增最终版条目，记录更名、双语、欢迎页、目录整理、加载优化、回归结果。

- [ ] **Step 5: 仓库收尾检查**

```bash
git status --short
git ls-files | grep -E '(^|/)\.DS_Store$|ost.mp3|package-lock.json|logic-test.html' || echo clean-tree
test -f docs/archive/domain-expansion-pr7/DomainExpansion_infinite-void.html && echo archive-ok
du -sh audio assets vendor docs
```

Expected: 工作区仅包含本次改动；无垃圾跟踪文件；`logic-test.html` untracked；归档存在；
`assets/tutorial` 只剩 webp。

- [ ] **Step 6: 提交文档与最终状态**

```bash
git add -A
git commit -m "docs: 最终版文档、目录与验收记录

Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>"
git log --oneline -8
```

Expected: 本地提交（不 push）；提交信息中文带前缀与 Co-Authored-By。

- [ ] **Step 7: 汇报**

向主人汇报：做了什么 / 没动什么（识别阈值、粒子、时间轴）/ 风险点（iOS 首次手势多下载音频、
首次启动仍要等 15MB 模型、Safari 性能较弱）/ 回归 N 项 PASS / 截图位置。

---

## Self-Review 记录

- **Spec coverage**：§5 命名→Task 2；§6 i18n→Task 2/3；§7 欢迎页→Task 4；§8 目录文档→Task 1/7；
  §9 加载→Task 5/6；§10 测试→各任务 + Task 7；§11 风险→Review Focus 与实现步骤。
- **Step scan**：每个 code step 给了函数签名、键名、精确英文/中文文案或数据结构；未写大段实现体。
- **Type consistency**：`setLanguage`、`loadMediaPipeScripts`、`ensureLongAudio`、`window.SAT0RU_*` 在
  各任务的 Interfaces 中一致；`data-action` 顺序保持 `debug,voice,voidlong,egg`。
- **Review Focus 测试**：刷新闪中文→Task 2 早期脚本 + Task 7 手动截图；iOS 音频→Task 5 分流/重试；
  切换中状态→Task 3 `updateState('red')` 断言；懒加载幂等→Task 5 断言；窄屏欢迎页→Task 4 截图。
- **比例**：本计划约 700 行，spec 约 260 行；没有贴大段产品代码，只固定接口、文案与断言。