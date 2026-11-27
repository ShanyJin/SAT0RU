# 部署 · GitHub Pages 与宝塔服务器

本项目是**纯静态单页应用**：手部识别（MediaPipe Hands）、粒子渲染（three.js）、音频与教程图
全部在浏览器本地完成，服务器只负责发文件。所以不需要 Node/Python 后端，任何能托管静态文件的
地方都能跑；摄像头要求 **HTTPS 或 localhost**。

`index.html` 里的资源路径全是**相对路径**（`vendor/…`、`audio/…`、`assets/…`），
因此站点放在域名根目录或子目录（如 `/SAT0RU/`）都能正常工作。

---

## 一、GitHub Pages（GitHub 官方静态托管，推荐用来分流）

GitHub 没有可执行后端的「云服务器」，但提供官方的 **GitHub Pages**：免费、HTTPS、
走 GitHub/Fastly 的 CDN，适合这种纯静态项目。限制（免费公开仓库）：站点 ≤ 1 GB、
月流量约 100 GB 软限制、每小时 10 次构建；本仓库约 23 MB，个人使用绰绰有余。

### 开启

1. 仓库 **Settings → Pages**
2. **Build and deployment → Source** 选 `Deploy from a branch`
3. Branch 选 `main`，目录选 `/(root)`，Save
4. 等 1–2 分钟，站点地址：**https://shanyjin.github.io/SAT0RU/**

仓库根目录已有 `.nojekyll`，GitHub 不会用 Jekyll 处理文件；`logic-test.html` 在
`.gitignore` 里，不会被发布。

### 注意

- **子路径**：项目站的 URL 是 `/<仓库名>/`。本项目的资源路径已改成相对路径，所以直接可用；
  如果以后又把路径改回 `/vendor/...` 这种根绝对路径，项目站会 404，需要自定义域名或改回相对路径。
- **响应头**：Pages 不能自定义 `Cache-Control`（默认约 10 分钟）和 gzip 配置；文本由 Fastly
  自动压缩。需要一年 immutable 缓存时用宝塔/Nginx/Cloudflare。
- **MIME**：Pages 对 `.wasm` 返回 `application/wasm`；`.data`/`.tflite` 作为二进制下载即可，
  MediaPipe 用 `fetch` 读 ArrayBuffer，不依赖 MIME。部署后可用
  `curl -sI https://shanyjin.github.io/SAT0RU/vendor/mediapipe/hands/hands_solution_simd_wasm_bin.wasm`
  确认。
- **公开性**：公开仓库的 Pages 站点是公开的，不能设访问密码；私人仓库的 Pages 需要付费方案。
- **自定义域名**（可选）：Settings → Pages → Custom domain 填如 `sat0ru.shany.cc`，
  DNS 加 CNAME 指向 `shanyjin.github.io`，勾选 Enforce HTTPS；证书由 GitHub 自动签发。
  用根域名或自定义域名后，根绝对路径也能工作，但本项目已不需要。

### 更新

推 `main` 即自动重新发布：

```bash
git push mine final
git push --force-with-lease mine final:main
```

---

## 二、宝塔面板（自己的服务器）

### 1. 建站

- 宝塔 → 网站 → 添加站点：域名填你的域名（如 `sat0ru.example.com`），
  PHP 版本选「纯静态」或「静态」，根目录如 `/www/wwwroot/sat0ru`。
- 上传代码（公开仓库，直接在服务器上 clone 最省事）：

```bash
cd /www/wwwroot
git clone https://github.com/ShanyJin/SAT0RU.git sat0ru
# 以后更新
cd /www/wwwroot/sat0ru && git pull
```

  也可以把仓库打包上传后解压，确保 `index.html` 在站点根目录。

- **不要**把 `.git` 暴露出去（见下面的 Nginx 规则），或者把站点根目录指到一个只含
  `index.html`、`vendor/`、`audio/`、`assets/` 的发布目录。

### 2. HTTPS

宝塔 → 网站 → 设置 → SSL → Let's Encrypt，申请证书并开启「强制 HTTPS」。
摄像头只在安全上下文可用，手机访问也必须 HTTPS。

### 3. Nginx 配置

在宝塔该站点的「配置文件」里、`server { … }` 内加入（或合并到已有配置）：

```nginx
# 正确的 MIME（新版 Nginx 的 mime.types 不一定含 wasm）
location ~* \.wasm$  { default_type application/wasm; }
location ~* \.(data|tflite)$ { default_type application/octet-stream; }
location ~* \.m?js$  { default_type text/javascript; }

# 站点根与单页入口
location / {
    try_files $uri $uri/ /index.html;
}

# 保护源码与隐藏文件
location ~ /\.(git|env|ht) { deny all; }

# 缓存：入口不缓存，静态资源一年
location = /index.html {
    add_header Cache-Control "no-cache";
}
location ~* ^/(vendor|assets|audio)/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
}

# gzip（宝塔默认可能已开，重复时保留一处即可）
gzip on;
gzip_min_length 1024;
gzip_comp_level 6;
gzip_types text/css text/javascript application/javascript application/json image/svg+xml application/wasm application/octet-stream;
```

如果 `default_type` 没生效（说明 `mime.types` 已把该扩展名映射成别的类型），直接编辑
`/www/server/nginx/conf/mime.types`，加入：

```nginx
application/wasm              wasm;
application/octet-stream      data tflite;
text/javascript               js mjs;
```

然后 `nginx -t && nginx -s reload`（或在宝塔里「重载配置」）。

### 4. 验证

```bash
curl -sI https://你的域名/ | grep -iE 'HTTP/|content-type|cache-control'
curl -sI https://你的域名/vendor/three/build/three.module.js | grep -iE 'content-type|content-encoding|cache-control'
curl -sI https://你的域名/vendor/mediapipe/hands/hands_solution_simd_wasm_bin.wasm | grep -i content-type
```

浏览器打开站点 → 点「启动」→ 允许摄像头 → 顶部按钮变「追踪中」。
首次启动要加载约 23 MB 本地模型，等几秒到十几秒是正常的。

### 可选：直接跑 `tools/serve.py`

不想改 Nginx 也可以把 `tools/serve.py` 作为宝塔「Python 项目」运行（监听 `127.0.0.1:8787`），
再用 Nginx 反代到它；`serve.py` 已带正确的 MIME、gzip 与缓存头。代价是多一个常驻进程，
静态站点 + Nginx 更简单、更省资源。

---

## 三、怎么选

- **只想减轻自己服务器的压力**：用 GitHub Pages，静态文件全走 GitHub CDN，宝塔只留作备用/内网。
- **要自定义缓存头、访问控制、或不想依赖 GitHub**：宝塔静态站 + 上面的 Nginx 配置。
- 两边可以同时存在：同一份 `main`，Pages 负责公网展示，宝塔负责内网/备用。

> 注意：任何公网部署都会把教程图、语音和关于页（含联系邮箱）公开；本项目原本是单人娱乐用途，
> 公开前请确认你接受这一点。