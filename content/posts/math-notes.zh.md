+++
title = "数学公式渲染测试"
date = 2026-04-04T22:40:00+08:00
slug = "math-notes"
translationKey = "math-notes"
summary = "验证 KaTeX 在 Hugo 页面中的行内与块级公式渲染。"
tags = ["math", "katex", "hugo"]
draft = false
math = true
+++

这篇文章用于验证轻量 LaTeX 公式渲染。

行内公式示例：$E = mc^2$。

块级公式示例：

$$
\int_{0}^{1} x^2 dx = \frac{1}{3}
$$

再测试一个矩阵：

$$
A = \begin{bmatrix}
1 & 2 \\
3 & 4
\end{bmatrix}
$$

代码块不应被公式渲染影响：

```python
import math
print(math.sqrt(16))
```
