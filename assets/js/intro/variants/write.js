// Write: every letter is written along its own strokes in writing order (z goes
// top-left, top-right, down the diagonal, out along the tail), all letters at once.
// The real glyph is revealed through a brush stroked along a hand-made centreline.
(window.__introVariants = window.__introVariants || {}).write = function (api) {
  "use strict";

  var ctx = api.ctx, ease = api.ease, clamp01 = api.clamp01, dpr = api.dpr;
  var T = { start: 120, stagger: 50, letter: 800, pause: 0.06, fill: 140 };

  // Centrelines inside each glyph's ink box, 0-100 on both axes (y down), in
  // writing order; each string is one pen-down stroke. Traced from SF Pro Bold.
  // Stroke ends run past the terminals so the butt-capped brush covers them.
  // "A cx cy rx ry from to" is an elliptical arc in degrees.
  var PATHS = {
    Y: ["M 8.5 -6.6 L 50.3 62.3", "M 92 -6.6 L 50.3 62.3 L 50.3 103"],
    u: ["M 14.8 -4 L 14.8 54.7 C 14.8 79.5 25.5 88.8 44.8 88.8 C 66.9 88.8 82.1 79.5 85.5 62",
        "M 85.5 -4 L 85.5 104"],
    a: ["M 18.3 35 C 18.3 19 31 10.7 50 10.7 C 73.2 10.7 84.5 20.2 84.5 38.7 L 84.5 104",
        "M 73.2 48.5 L 43 49.1 C 21.8 49.7 14.8 59.5 14.8 69.9 C 14.8 83.4 27.5 90.8 41.5 90.8 C 57 90.8 69.7 84.7 76.8 75.5"],
    n: ["M 14.8 -4 L 14.8 104",
        "M 15.9 47.8 C 18.6 24.2 35.2 11.2 55.9 11.2 C 77.9 11.2 85.2 23.6 85.2 42.9 L 85.2 104"],
    F: ["M 15.9 -3 L 15.9 103", "M 15.9 8.7 L 105 8.7", "M 15.9 52.6 L 99 52.6"],
    o: ["A 50 50 36.1 39.8 -60 -430"],
    r: ["M 23.6 -4 L 23.6 104", "M 26.4 47.8 C 29.7 25.5 50.5 11.8 79.1 11.8 L 106 11.8"],
    z: ["M -5 10.4 L 88.4 10.4 L 13.2 89.9 L 105 89.9"]
  };
  // Any other character: one straight sweep down its ink box, with a brush as wide as the box.
  var SWEEP = "M 50 -5 L 50 105";

  // Stem width of the logo font: the ink width of a capital I.
  var probe = document.createElement("canvas").getContext("2d");
  probe.font = api.font(api.size);
  var mI = probe.measureText("I");
  var stem = (mI.actualBoundingBoxLeft || 0) + (mI.actualBoundingBoxRight || 0) || api.size * 0.145;
  var BRUSH = stem * 1.45;

  // Flatten a path string into points in word space within the box.
  function flatten(d, box) {
    var tok = d.trim().split(/\s+/), i = 0, pts = [], cx = 0, cy = 0;
    function X(u) { return box.x0 + (box.x1 - box.x0) * u / 100; }
    function Y(v) { return box.y0 + (box.y1 - box.y0) * v / 100; }
    function num() { return Number(tok[i++]); }
    function add(x, y) { pts.push(x, y); cx = x; cy = y; }
    while (i < tok.length) {
      var c = tok[i++], n, k, s;
      if (c === "M" || c === "L") {
        add(X(num()), Y(num()));
      } else if (c === "C") {
        var x1 = X(num()), y1 = Y(num()), x2 = X(num()), y2 = Y(num()), x3 = X(num()), y3 = Y(num());
        var x0 = cx, y0 = cy;
        for (k = 1; k <= 16; k++) {
          s = k / 16;
          var a = (1 - s) * (1 - s) * (1 - s), b = 3 * (1 - s) * (1 - s) * s, e = 3 * (1 - s) * s * s, f = s * s * s;
          add(a * x0 + b * x1 + e * x2 + f * x3, a * y0 + b * y1 + e * y2 + f * y3);
        }
      } else if (c === "A") {
        var ex = num(), ey = num(), rx = num(), ry = num(), from = num(), to = num();
        n = Math.ceil(Math.abs(to - from) / 8);
        for (k = 0; k <= n; k++) {
          var th = (from + (to - from) * k / n) * Math.PI / 180;
          add(X(ex + rx * Math.cos(th)), Y(ey + ry * Math.sin(th)));
        }
      }
    }
    var len = [0];
    for (k = 2; k < pts.length; k += 2) len.push(len[len.length - 1] + Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1]));
    return { pts: pts, len: len, total: len[len.length - 1] };
  }

  // Stroke the first s pixels of a flattened stroke on context o.
  function partial(o, st, s) {
    if (s <= 0) return;
    s = Math.min(s, st.total);
    var len = st.len, p = st.pts, j = 1;
    while (j < len.length - 1 && len[j] < s) j++;
    var f = clamp01((s - len[j - 1]) / (len[j] - len[j - 1] || 1));
    o.beginPath();
    o.moveTo(p[0], p[1]);
    for (var k = 1; k < j; k++) o.lineTo(p[2 * k], p[2 * k + 1]);
    o.lineTo(p[2 * j - 2] + (p[2 * j] - p[2 * j - 2]) * f, p[2 * j - 1] + (p[2 * j + 1] - p[2 * j - 1]) * f);
    o.stroke();
  }

  var glyphs = api.glyphs(), letters = [], maxW = 1, maxH = 1;
  var ink = glyphs.filter(function (g) { return g.right - g.left >= 1; });
  var stagger = ink.length > 1 ? Math.min(T.stagger, 420 / (ink.length - 1)) : 0;
  ink.forEach(function (g, n) {
    var box = { x0: g.left, x1: g.right, y0: g.top, y1: g.bottom };
    var sweep = !PATHS[g.ch];
    var strokes = (PATHS[g.ch] || [SWEEP]).map(function (d) { return flatten(d, box); });
    // A pen lift costs a short pause, counted as extra path length.
    var gap = T.pause * strokes.reduce(function (a, s) { return a + s.total; }, 0);
    var total = 0;
    strokes.forEach(function (s, k) { s.from = total + (k ? gap : 0); total = s.from + s.total; });

    // The glyph alone, in the foreground colour, on its own canvas at device scale.
    var pad = 2, gx = Math.floor(g.left - pad), gy = Math.floor(g.top - pad);
    var gw = Math.ceil(g.right + pad) - gx, gh = Math.ceil(g.bottom + pad) - gy;
    var c = document.createElement("canvas");
    c.width = Math.ceil(gw * dpr);
    c.height = Math.ceil(gh * dpr);
    var o = c.getContext("2d");
    o.setTransform(dpr, 0, 0, dpr, -gx * dpr, -gy * dpr);
    o.font = api.font(api.size);
    o.fillStyle = api.colors.fg;
    o.fillText(g.ch, g.x, 0);
    maxW = Math.max(maxW, c.width);
    maxH = Math.max(maxH, c.height);

    letters.push({
      strokes: strokes, total: total, canvas: c, gx: gx, gy: gy, gw: gw, gh: gh,
      brush: sweep ? g.right - g.left + 2 * pad + 2 : BRUSH,
      t0: T.start + n * stagger
    });
  });
  if (!letters.length) return null;

  // Shared scratch canvas: brush mask, then the glyph composited into it.
  var work = document.createElement("canvas");
  work.width = maxW;
  work.height = maxH;
  var w = work.getContext("2d");
  w.lineCap = "butt";
  w.lineJoin = "miter";

  var last = letters[letters.length - 1];
  var formed = Math.round(last.t0 + T.letter + T.fill + 20);

  function frame(t) {
    // Handoff: every glyph is whole by now; the real text stays sharp as it shrinks.
    if (t >= formed) {
      api.drawText(api.wordAlpha);
      return;
    }
    api.wordSpace();
    for (var i = 0; i < letters.length; i++) {
      var L = letters[i], local = t - L.t0;
      if (local <= 0) continue;
      var s = ease.inOutCubic(local / T.letter) * L.total;
      var fill = clamp01((local - T.letter) / T.fill);

      ctx.globalAlpha = api.wordAlpha;
      if (fill < 1) {
        w.setTransform(1, 0, 0, 1, 0, 0);
        w.globalCompositeOperation = "source-over";
        w.clearRect(0, 0, L.canvas.width, L.canvas.height);
        w.setTransform(dpr, 0, 0, dpr, -L.gx * dpr, -L.gy * dpr);
        w.lineWidth = L.brush;
        w.strokeStyle = "#000";
        for (var k = 0; k < L.strokes.length; k++) partial(w, L.strokes[k], s - L.strokes[k].from);
        w.setTransform(1, 0, 0, 1, 0, 0);
        w.globalCompositeOperation = "source-in";
        w.drawImage(L.canvas, 0, 0);
        ctx.drawImage(work, 0, 0, L.canvas.width, L.canvas.height, L.gx, L.gy, L.canvas.width / dpr, L.canvas.height / dpr);
      }
      // Once written, settle into the whole glyph, in case the brush missed a corner.
      if (fill > 0) {
        ctx.globalAlpha = api.wordAlpha * fill;
        ctx.drawImage(L.canvas, L.gx, L.gy, L.canvas.width / dpr, L.canvas.height / dpr);
      }
    }
  }

  // The revealed glyphs are the real text, so the core needs no crossfade.
  return { formed: formed, frame: frame, realText: true };
};
