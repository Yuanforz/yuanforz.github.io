+++
title = "写作工具"
slug = "writer"
translationKey = "writer"
draft = false
+++

正在跳转写作工具。

如果没有自动跳转，请手动点击：

- [打开本地写作工具](http://127.0.0.1:1313/tools/writer/)
- [继续使用网页写作工具](/tools/writer/)

<script>
  (function () {
    var localUrl = "http://127.0.0.1:1313/tools/writer/";
    var webUrl = "/tools/writer/";
    var host = window.location.hostname;
    var isLocalHost = host === "127.0.0.1" || host === "localhost";

    if (isLocalHost) {
      window.location.replace(webUrl);
      return;
    }

    var shouldOpenLocal = window.confirm(
      "检测到你在线上站点。\n\n是否跳转到本地写作工具？\n\n请先在本机启动 hugo server -D。"
    );

    if (shouldOpenLocal) {
      window.location.href = localUrl;
    }
  })();
</script>
