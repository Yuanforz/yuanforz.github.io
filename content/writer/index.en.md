+++
title = "Writer"
slug = "writer"
translationKey = "writer"
draft = false
+++

Redirecting to the writing tool.

If no automatic redirect happens, use one of the links below:

- [Open local writer](http://127.0.0.1:1313/tools/writer/)
- [Continue with web writer](/tools/writer/)

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
      "You are on the public site.\n\nOpen the local writer now?\n\nPlease make sure hugo server -D is running on your machine."
    );

    if (shouldOpenLocal) {
      window.location.href = localUrl;
    }
  })();
</script>
