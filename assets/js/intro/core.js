// Homepage intro core. Picks one of the registered variants, runs it on a
// full-screen canvas, then carries the word from the centre onto the header logo
// (the same text) while the page fades in underneath. Runs only when the inline
// head script has added html.intro-play (see layouts/partials/intro/head.html).
//
// A variant is a factory registered on window.__introVariants before this file:
//   __introVariants.name = function (api) { ...; return { formed: ms, frame: fn(t) } }
// It returns null if it cannot draw this word. frame(t) draws one frame; the word
// is in place by `formed` ms, when the handoff starts. A variant whose word is the
// real text by then returns realText: true, so the core does not crossfade it.
// See `api` below.
(function () {
  "use strict";

  var registry = window.__introVariants || {};
  window.__introVariants = undefined;

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
  var logo = document.querySelector(".header .logo > a");
  var measurer = document.createElement("canvas").getContext("2d");

  // After `formed`: handoff, then the background and canvas fade out. The real logo
  // fades in only once the word has fully arrived, so the two never sit offset.
  var HANDOFF = 650, BG_AT = 280, BG_DUR = 380, LANDED_AT = 650, FADE_AT = 680, FADE_DUR = 250, END_AT = 950;

  var params = new URLSearchParams(location.search);
  // Local preview only: ?intro=name&introAt=800 freezes the timeline at 800 ms.
  var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var freezeAt = local && params.has("introAt") ? Number(params.get("introAt")) : -1;

  var done = false, raf = 0, t0 = 0, startWidth = 0, landed = false;
  var variant, target, textNode;

  function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
  function mix(a, b, t) { return a + (b - a) * t; }
  var ease = {
    smooth: function (t) { t = clamp01(t); return t * t * (3 - 2 * t); },
    outExpo: function (t) { t = clamp01(t); return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); },
    inExpo: function (t) { t = clamp01(t); return t <= 0 ? 0 : Math.pow(2, 10 * t - 10); },
    inOutExpo: function (t) {
      t = clamp01(t);
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      return t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
    },
    outCubic: function (t) { t = 1 - clamp01(t); return 1 - t * t * t; },
    inOutCubic: function (t) {
      t = clamp01(t);
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
  };

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

  function nameNode() {
    for (var i = 0; i < logo.childNodes.length; i++) {
      var n = logo.childNodes[i];
      if (n.nodeType === 3 && n.nodeValue.trim()) return n;
    }
    return null;
  }

  // Everything a variant may use. Word-space coordinates are pixels at the centre
  // size, relative to the pen origin (x) and the baseline (y) of the word.
  var api = {
    ctx: ctx, W: 0, H: 0, dpr: 1,
    text: "", font: null, size: 0, width: 0, asc: 0, desc: 0, x0: 0, y0: 0,
    colors: {}, rgb: {},
    labels: { name: el.getAttribute("data-name") || "", lang: root.lang || "en" },
    // Current placement of the word (updated by the core every frame):
    // screen = (x + u * k, y + v * k) for a word-space point (u, v).
    k: 1, x: 0, y: 0,
    out: 0,       // handoff progress, 0 to 1: fade decorations with (1 - out)
    wordAlpha: 1, // multiply the word's own alpha by this; the core fades in the real text
    clamp01: clamp01, mix: mix, ease: ease,
    mono: function (px) { return "500 " + px + "px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"; },
    rgba: function (key, a) { var c = api.rgb[key]; return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; },
    // Draw in word space (true) or in screen space (false).
    wordSpace: function () {
      var s = api.dpr * api.k;
      ctx.setTransform(s, 0, 0, s, api.dpr * api.x, api.dpr * api.y);
    },
    screenSpace: function () { ctx.setTransform(api.dpr, 0, 0, api.dpr, 0, 0); },
    // The word in the logo font at the centre size, on its own canvas.
    // Returns { canvas, data (RGBA), w, h, ox, oy }; (ox, oy) is the pen origin.
    raster: function (pad, colour) {
      pad = pad || 4;
      var w = Math.ceil(api.width + api.size * 0.2) + pad * 2;
      var h = Math.ceil(api.asc + api.desc) + pad * 2;
      var c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      var o = c.getContext("2d", { willReadFrequently: true });
      var ox = pad + Math.ceil(api.size * 0.1), oy = pad + Math.ceil(api.asc);
      o.font = api.font(api.size);
      o.fillStyle = colour || "#000";
      o.fillText(api.text, ox, oy);
      return { canvas: c, data: o.getImageData(0, 0, w, h).data, w: w, h: h, ox: ox, oy: oy };
    },
    // Each character's pen offset and ink box in word space.
    glyphs: function () {
      measurer.font = api.font(api.size);
      var out = [];
      for (var i = 0; i < api.text.length; i++) {
        var ch = api.text.charAt(i);
        var m = measurer.measureText(ch);
        // Measured through this letter, so kerning with the previous letter counts.
        var x = measurer.measureText(api.text.slice(0, i + 1)).width - m.width;
        out.push({
          ch: ch, x: x, advance: m.width,
          left: x - (m.actualBoundingBoxLeft || 0), right: x + (m.actualBoundingBoxRight || m.width),
          top: -(m.actualBoundingBoxAscent || 0), bottom: m.actualBoundingBoxDescent || 0
        });
      }
      return out;
    },
    // The real text at the current placement.
    drawText: function (alpha, colour) {
      if (alpha <= 0) return;
      api.screenSpace();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = colour || api.colors.fg;
      ctx.font = api.font(api.size * api.k);
      ctx.textBaseline = "alphabetic";
      ctx.fillText(api.text, api.x, api.y);
      ctx.globalAlpha = 1;
    }
  };

  function readColours() {
    var css = getComputedStyle(root);
    var keys = { bg: ["--theme", "#ffffff"], fg: ["--primary", "#1e1e1e"], dim: ["--secondary", "#6c6c6c"],
                 faint: ["--tertiary", "#d6d6d6"], accent: ["--accent", "#002fa7"] };
    for (var k in keys) {
      api.rgb[k] = rgb(css.getPropertyValue(keys[k][0]), keys[k][1]);
      api.colors[k] = "rgb(" + api.rgb[k].join(",") + ")";
    }
  }

  function layout() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    api.dpr = dpr;
    api.W = window.innerWidth;
    api.H = window.innerHeight;
    startWidth = api.W;
    canvas.width = Math.round(api.W * dpr);
    canvas.height = Math.round(api.H * dpr);

    measurer.font = api.font(100);
    var per100 = measurer.measureText(api.text).width || 1;
    api.size = Math.max(28, Math.min(128, (api.W * 0.86) / per100 * 100));
    measurer.font = api.font(api.size);
    var m = measurer.measureText(api.text);
    api.width = m.width;
    api.asc = Math.ceil(m.actualBoundingBoxAscent || api.size * 0.8);
    api.desc = Math.ceil(m.actualBoundingBoxDescent || api.size * 0.2);
    // Centre the glyphs (not the line box) on the screen.
    api.x0 = api.W / 2 - api.width / 2;
    api.y0 = api.H / 2 + (api.asc - api.desc) / 2;
    api.k = 1;
    api.x = api.x0;
    api.y = api.y0;
  }

  // Where the word ends: the header logo text, same font, smaller.
  function logoTarget() {
    var range = document.createRange();
    range.selectNodeContents(textNode);
    var r = range.getBoundingClientRect();
    var px = parseFloat(getComputedStyle(logo).fontSize);
    measurer.font = api.font(px);
    var m = measurer.measureText(api.text);
    var a = m.fontBoundingBoxAscent, d = m.fontBoundingBoxDescent;
    var baseline = a && d ? r.top + (r.height - (a + d)) / 2 + a : r.top + r.height * 0.78;
    return { k: px / api.size, x: r.left, y: baseline };
  }

  // A forced ?intro=name first, then the configured list in random order, then particles.
  function candidates() {
    var list = [];
    var forced = params.get("intro");
    if (forced && registry[forced]) list.push(forced);
    var pool = (el.getAttribute("data-variants") || "").split(/\s+/).filter(function (n) { return registry[n]; });
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    list = list.concat(pool);
    if (registry.particles) list.push("particles");
    return list;
  }

  function frame(now) {
    if (done) return;
    if (!t0) t0 = now;
    var t = freezeAt >= 0 ? freezeAt : now - t0;
    var hs = variant.formed;

    var h = clamp01((t - hs) / HANDOFF);
    if (h > 0 && !target) target = logoTarget();
    var he = ease.inOutExpo(h);
    if (target) {
      api.k = mix(1, target.k, he);
      api.x = mix(api.x0, target.x, he);
      api.y = mix(api.y0, target.y, he);
    }
    api.out = he;
    api.wordAlpha = variant.realText ? 1 : 1 - ease.smooth((h - 0.55) / 0.4);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    api.screenSpace();
    variant.frame(t);
    ctx.restore();
    if (!variant.realText && api.wordAlpha < 1) api.drawText(1 - api.wordAlpha);

    bg.style.opacity = String(1 - ease.smooth((t - hs - BG_AT) / BG_DUR));
    canvas.style.opacity = String(1 - clamp01((t - hs - FADE_AT) / FADE_DUR));

    if (!landed && t >= hs + LANDED_AT) {
      landed = true;
      root.classList.add("intro-landed");
    }
    if (t >= hs + END_AT && freezeAt < 0) {
      finish(false);
    } else if (freezeAt < 0 || t0 === now) {
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

  function start(shown) {
    // The head script drops intro-play on activation if the intro played elsewhere meanwhile.
    textNode = root.classList.contains("intro-play") && logo && nameNode();
    if (!ctx || !textNode || (!shown && document.hidden)) {
      finish(false);
      return;
    }
    api.text = textNode.nodeValue.trim();
    var logoStyle = getComputedStyle(logo);
    api.font = function (px) { return logoStyle.fontWeight + " " + px + "px " + logoStyle.fontFamily; };
    readColours();
    layout();

    var names = candidates();
    for (var i = 0; i < names.length && !variant; i++) {
      try {
        variant = registry[names[i]](api);
      } catch (e) {
        variant = null;
      }
    }
    if (!variant) {
      finish(false);
      return;
    }
    el.setAttribute("data-variant", names[i - 1]);
    bind();
    raf = requestAnimationFrame(frame);
  }

  // The overlay is in place now, so the head-level cover can go.
  root.classList.add("intro-ready");

  // A prerendered page stays hidden until the visitor opens it; start then.
  if (document.prerendering) {
    document.addEventListener("prerenderingchange", function () { start(true); }, { once: true });
  } else {
    start(false);
  }
})();
