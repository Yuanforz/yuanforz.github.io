# yuanforz.github.io

基于 Hugo + PaperMod 的中英双语个人主页与博客，支持轻量 LaTeX 公式渲染（KaTeX）。

## 已实现能力

- 中英双语站点结构
- 首页 / 博客 / 关于页
- 按文章启用的 KaTeX 公式渲染
- GitHub Actions 自动构建并发布到 GitHub Pages

## 快速开始

### 1. 安装与检查 Hugo Extended

推荐使用 Hugo Extended 版本（工作流内已固定版本）。

在新终端里执行：

```powershell
hugo version
```

如果 Windows 终端还未刷新 PATH，可临时使用绝对路径（示例）：

```powershell
$hugoExe = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages\Hugo.Hugo.Extended_Microsoft.Winget.Source_8wekyb3d8bbwe\hugo.exe"
& $hugoExe version
```

### 2. 本地开发预览

```powershell
hugo server -D
```

默认本地地址：

- http://localhost:1313/zh/
- http://localhost:1313/en/

### 3. 生产构建验证

```powershell
hugo --gc --minify
```

## 项目结构

```text
.
├─ .github/workflows/hugo.yml
├─ archetypes/default.md
├─ content/
│  ├─ _index.zh.md
│  ├─ _index.en.md
│  ├─ about/
│  │  ├─ index.zh.md
│  │  └─ index.en.md
│  └─ posts/
│     ├─ _index.zh.md
│     ├─ _index.en.md
│     ├─ welcome.zh.md
│     ├─ welcome.en.md
│     ├─ math-notes.zh.md
│     └─ math-notes.en.md
├─ layouts/partials/extend_head.html
├─ themes/PaperMod (git submodule)
└─ hugo.toml
```

## 写文章流程

直接写 Markdown。

中英文文章命名示例：

- content/posts/my-post.zh.md
- content/posts/my-post.en.md

建议使用相同的 slug 与 translationKey 关联翻译文章。

## 公式渲染（KaTeX）

### 启用方式

在文章 Front Matter 中设置：

```toml
math = true
```

只有设置为 true 的页面才会加载公式资源。

### 语法示例

行内公式：

```text
$E = mc^2$
```

块级公式：

```text
$$
\int_{0}^{1} x^2 dx = \frac{1}{3}
$$
```

## 自动部署到 GitHub Pages

工作流文件：

- .github/workflows/hugo.yml

已配置：

- push 到 main 自动触发构建
- 拉取主题子模块
- 使用 Hugo Extended 构建
- 发布 public 目录到 GitHub Pages

仓库设置中请确认 Pages 使用 GitHub Actions 作为来源。

## 主题维护

更新主题子模块：

```powershell
git submodule update --remote --merge
```
