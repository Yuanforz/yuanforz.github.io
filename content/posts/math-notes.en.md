+++
title = "Math Rendering Check"
date = 2026-04-04T22:40:00+08:00
slug = "math-notes"
translationKey = "math-notes"
summary = "Validate inline and block math rendering with KaTeX in Hugo pages."
tags = ["math", "katex", "hugo"]
draft = false
math = true
+++

This post validates lightweight LaTeX rendering.

Inline formula example: $E = mc^2$.

Block formula example:

$$
\int_{0}^{1} x^2 dx = \frac{1}{3}
$$

A matrix sample:

$$
A = \begin{bmatrix}
1 & 2 \\
3 & 4
\end{bmatrix}
$$

Code blocks should remain unaffected:

```python
import math
print(math.sqrt(16))
```
