# HANDOFF

## 踩过的坑

### 首页开场动画被 Chrome 预渲染"吃掉"（2026-10-31）

- 现象：动画上线后能看到，过几天就再也不出现，代码没改过。
- 原因：Chrome 会对常去的网址提前在后台预渲染（地址栏输入时、书签悬停等）。预渲染期间 `document.prerendering === true`、`document.hidden === true`，旧代码会立刻结束动画，并把"刚播放过"写进 localStorage。等用户真正打开时遮罩已经删掉，之后 5 分钟内也会被跳过。
- 修法：预渲染期间只加 `intro-play intro-wait` 铺遮罩，不写 localStorage；等 `prerenderingchange` 时再写时间戳、开始播放。CSS 的 5 秒保底只对 `:not(.intro-wait)` 生效，否则后台加载超过 5 秒就会提前掀开遮罩。
- 以后凡是"只在用户看到时才该发生"的逻辑（动画、计数、埋点），都要考虑 `document.prerendering`。

### 开场动画的交接（2026-10-31）

- 真 logo 必须等画布上的字完全落定（交接结束）后再淡入。提前淡入时两者差约 1% 的大小和位置，叠在一起会出现重影。
- 变体画的就是真实文字时要返回 `realText: true`。否则核心还会叠一层半透明文字做交叉淡入，两层半透明叠加会让 logo 短暂变淡约 25%。
- 所有变体会拼成一个 JS 文件，任何一个有语法错误都会让全部动画失效。改完先 `node --check`。
- 算字母位置要量到包含该字母为止再减去它的宽度（`measureText(text.slice(0, i + 1)) - 字母宽`），否则会漏掉 Y–u 这类字距调整。

## 开场动画结构

- `assets/js/intro/core.js`：遮罩、跳过、预渲染等待、把单词缩到 logo 的交接。`assets/js/intro/variants/*.js`：各个变体，只负责交接前的画面。模板 `layouts/partials/intro/overlay.html` 把它们拼成一个文件。
- `hugo.toml` 的 `params.intro.variants` 决定线上从哪几个里随机选。
- 线上只打包 `params.intro.variants` 里的变体（全部打包约 14KB gzip，脚本加载完之前首页被遮罩盖着）；`hugo server` 本地预览时打包全部。
- 预览：`/en/?intro=<变体名>` 强制播放某一版，不受 5 分钟限制；线上只对已打包的变体有效。只在 localhost 生效的 `&introAt=800` 会把画面定格在 800 ms，方便截图。

## 本地构建和测试

- 本机没有全局 hugo。从 GitHub releases 下载 `hugo_extended_0.159.2_darwin-universal.pkg`，用 `pkgutil --expand-full` 解开，二进制在 `Payload/hugo`。版本要和 `.github/workflows` 里的 `HUGO_VERSION` 一致。
- 复现预渲染：在同源页面放 `<script type="speculationrules">{"prerender":[{"source":"list","urls":["/en/"]}]}</script>`，几秒后 `location.href="/en/"` 即可激活；用 `--headless=new` 的 Chrome 加独立 `--user-data-dir` 跑，避免 localStorage 互相影响。
