// Homepage intro: particles gather into the site name at the centre of the screen,
// a thin accent line is drawn, then the particles shrink and land exactly on the
// header logo (the same text) while the page fades in underneath. Runs only when the inline head
// script has added html.intro-play (see layouts/partials/intro/head.html).
(function () {
  "use strict";

  var root = document.documentElement;
  var el = document.getElementById("intro-anim");
  if (!el) return;
  if (!root.classList.contains("intro-play")) {
    el.remove();
    return;
  }

  var canvas = el.querySelector("canvas");
  var bg = el.querySelector(".intro-bg");
  var ctx = canvas.getContext("2d");
  // The particles spell, and land on, the header logo text (site title).
  var logo = document.querySelector(".header .logo > a");
  var measurer = document.createElement("canvas").getContext("2d");

  // Timeline in milliseconds.
  var T = {
    orgStart: 150, orgDur: 700, stagger: 220,
    lineStart: 950, lineDur: 450, lineOut: 250,
    handoff: 1500, handoffDur: 600,
    bgStart: 1780, bgDur: 380,
    landed: 2000, fadeStart: 2100, fadeDur: 250,
    end: 2400
  };
  var BUCKETS = 8;
  var MAX_PARTICLES = 1600;

  var done = false;
  var raf = 0;
  var t0 = 0;
  var startWidth = 0;
  var landed = false;
  var W, H, textNode, name, font, shape, particles, palette, accent, lineY, lineW, handoffReady = false;

  function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
  function easeOutExpo(t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  function easeInOutExpo(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
  }
  function smooth(t) { return t * t * (3 - 2 * t); }

  // Resolve a CSS colour (hex or rgb()) to [r, g, b].
  function rgb(value, fallback) {
    measurer.fillStyle = fallback;
    measurer.fillStyle = (value || "").trim() || fallback;
    var s = measurer.fillStyle;
    if (s.charAt(0) === "#") {
      return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
    }
    var m = s.match(/[\d.]+/g);
    return [+m[0], +m[1], +m[2]];
  }

  function readColours() {
    var css = getComputedStyle(root);
    var from = rgb(css.getPropertyValue("--secondary"), "#888888");
    var to = rgb(css.getPropertyValue("--primary"), "#1e1e1e");
    var a = rgb(css.getPropertyValue("--accent"), "#002fa7");
    palette = [];
    for (var i = 0; i < BUCKETS; i++) {
      var k = i / (BUCKETS - 1);
      palette.push("rgba(" +
        Math.round(from[0] + (to[0] - from[0]) * k) + "," +
        Math.round(from[1] + (to[1] - from[1]) * k) + "," +
        Math.round(from[2] + (to[2] - from[2]) * k) + "," +
        (0.3 + 0.65 * k).toFixed(3) + ")");
    }
    accent = "rgb(" + a.join(",") + ")";
  }

  function nameNode() {
    for (var i = 0; i < logo.childNodes.length; i++) {
      var n = logo.childNodes[i];
      if (n.nodeType === 3 && n.nodeValue.trim()) return n;
    }
    return null;
  }

  // Draw the name once at a large size and keep a point for every filled cell.
  // Points are relative to the pen origin (x) and the baseline (y).
  function sampleName() {
    measurer.font = font(100);
    var per100 = measurer.measureText(name).width || 1;
    var size = Math.max(28, Math.min(128, (W * 0.86) / per100 * 100));
    var gap = Math.max(3, Math.round(size / 21));

    measurer.font = font(size);
    var m = measurer.measureText(name);
    var left = Math.ceil(m.actualBoundingBoxLeft || 0);
    var right = Math.ceil(m.actualBoundingBoxRight || m.width);
    var asc = Math.ceil(m.actualBoundingBoxAscent || size * 0.8);
    var desc = Math.ceil(m.actualBoundingBoxDescent || size * 0.2);
    var pad = 4;
    var cw = left + right + pad * 2;
    var ch = asc + desc + pad * 2;
    var ox = pad + left;
    var oy = pad + asc;

    var off = document.createElement("canvas");
    off.width = cw;
    off.height = ch;
    var o = off.getContext("2d", { willReadFrequently: true });
    o.font = font(size);
    o.textBaseline = "alphabetic";
    o.fillStyle = "#000";
    o.fillText(name, ox, oy);
    var data = o.getImageData(0, 0, cw, ch).data;

    var pts;
    do {
      pts = [];
      for (var y = 0; y < ch; y += gap) {
        for (var x = 0; x < cw; x += gap) {
          if (data[(y * cw + x) * 4 + 3] > 128) pts.push([x - ox, y - oy]);
        }
      }
      gap += 1;
    } while (pts.length > MAX_PARTICLES);

    return { pts: pts, size: size, gap: gap - 1, width: m.width, asc: asc, desc: desc };
  }

  function build() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    startWidth = W;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    shape = sampleName();
    // Centre the glyphs (not the line box) on the screen.
    var x0 = W / 2 - shape.width / 2;
    var y0 = H / 2 + (shape.asc - shape.desc) / 2;
    lineY = Math.round((y0 + shape.desc + Math.max(16, shape.size * 0.28)) * dpr) / dpr;
    lineW = Math.min(shape.width * 0.5, 320);

    particles = shape.pts.map(function (p) {
      return {
        px: p[0], py: p[1],
        bx: x0 + p[0], by: y0 + p[1],
        tx: 0, ty: 0,
        x0: Math.random() * W, y0: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.05, vy: (Math.random() - 0.5) * 0.05,
        s: Math.max(1.2, (shape.gap) * 0.4) * (0.85 + Math.random() * 0.3),
        delay: (p[0] / shape.width) * T.stagger + Math.random() * 60
      };
    });
    // Neighbouring particles share a colour bucket, so the fill colour rarely changes.
    particles.sort(function (a, b) { return a.delay - b.delay; });
  }

  // Where each particle ends up: the same glyph shape scaled onto the header logo.
  function computeHandoff() {
    var range = document.createRange();
    range.selectNodeContents(textNode);
    var r = range.getBoundingClientRect();
    var cs = getComputedStyle(logo);
    measurer.font = font(parseFloat(cs.fontSize));
    var m = measurer.measureText(name);
    var a = m.fontBoundingBoxAscent, d = m.fontBoundingBoxDescent;
    var baseline = a && d ? r.top + (r.height - (a + d)) / 2 + a : r.top + r.height * 0.78;
    var scale = r.width / shape.width;
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.tx = r.left + p.px * scale;
      p.ty = baseline + p.py * scale;
    }
    handoffReady = true;
  }

  function frame(now) {
    if (done) return;
    if (!t0) t0 = now;
    var t = now - t0;

    ctx.clearRect(0, 0, W, H);

    var hand = easeInOutExpo(clamp01((t - T.handoff) / T.handoffDur));
    if (hand > 0 && !handoffReady) computeHandoff();

    ctx.globalAlpha = clamp01(t / 120) * (1 - clamp01((t - T.fadeStart) / T.fadeDur));
    var last = -1;
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var k = easeOutExpo(clamp01((t - T.orgStart - p.delay) / T.orgDur));
      // A little drift while scattered, frozen once the particle starts to gather.
      var tf = Math.min(t, T.orgStart + p.delay);
      var sx = p.x0 + p.vx * tf;
      var sy = p.y0 + p.vy * tf;
      var x = sx + (p.bx - sx) * k;
      var y = sy + (p.by - sy) * k;
      var size = p.s * (0.6 + 0.4 * k);
      if (hand > 0) {
        x += (p.tx - x) * hand;
        y += (p.ty - y) * hand;
        size += (1.15 - size) * hand;
      }
      var b = Math.round(k * (BUCKETS - 1));
      if (b !== last) {
        ctx.fillStyle = palette[b];
        last = b;
      }
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
    }

    // The one accent: a thin line drawn under the name, gone before the handoff ends.
    var lp = easeOutExpo(clamp01((t - T.lineStart) / T.lineDur));
    var lf = 1 - clamp01((t - T.handoff) / T.lineOut);
    if (lp > 0 && lf > 0) {
      ctx.globalAlpha = lf;
      ctx.fillStyle = accent;
      var lw = lineW * lp;
      ctx.fillRect(W / 2 - lw / 2, lineY, lw, 1);
    }

    bg.style.opacity = String(1 - smooth(clamp01((t - T.bgStart) / T.bgDur)));

    if (!landed && t >= T.landed) {
      landed = true;
      root.classList.add("intro-landed");
    }

    if (t >= T.end) {
      finish(false);
    } else {
      raf = requestAnimationFrame(frame);
    }
  }

  function finish(quick) {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    unbind();
    root.classList.add("intro-ready", "intro-landed");
    var remove = function () {
      canvas.width = canvas.height = 0;
      el.remove();
      root.classList.remove("intro-play", "intro-ready", "intro-landed");
    };
    if (quick) {
      el.style.transition = "opacity 0.2s ease-in";
      el.style.opacity = "0";
      setTimeout(remove, 320);
    } else {
      remove();
    }
  }

  function skipNow() { finish(true); }
  function onKey(e) {
    if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
      if (e.key === " ") e.preventDefault();
      finish(true);
    }
  }
  function onResize() {
    // Phones resize the height when the address bar moves; only a width change matters.
    if (window.innerWidth !== startWidth) finish(true);
  }
  function onVisibility() { if (document.hidden) finish(false); }
  function onPageShow(e) { if (e.persisted) finish(false); }

  function bind() {
    el.addEventListener("click", skipNow);
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", skipNow, { passive: true });
    window.addEventListener("touchmove", skipNow, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);
  }
  function unbind() {
    el.removeEventListener("click", skipNow);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("wheel", skipNow);
    window.removeEventListener("touchmove", skipNow);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("pageshow", onPageShow);
    document.removeEventListener("visibilitychange", onVisibility);
  }

  // The overlay is in place now, so the head-level cover can go.
  root.classList.add("intro-ready");

  textNode = logo && nameNode();
  if (!ctx || !textNode || document.hidden) {
    finish(false);
    return;
  }
  name = textNode.nodeValue.trim();
  var logoStyle = getComputedStyle(logo);
  font = function (px) { return logoStyle.fontWeight + " " + px + "px " + logoStyle.fontFamily; };

  readColours();
  build();
  bind();
  raf = requestAnimationFrame(frame);
})();
