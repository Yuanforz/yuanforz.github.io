// Strokes: ribbons of three thin parallel lines fly in from the screen edges along
// each letter's stroke direction and write the word in a chamfered monoline; a
// slanted wipe then fills the ribbons solid before the word moves onto the logo.
(window.__introVariants = window.__introVariants || {}).strokes = function (api) {
  "use strict";

  var ctx = api.ctx, ease = api.ease;

  // Monoline skeletons in a w x h box of stem centres (origin bottom-left, y up);
  // e is half a stem, so open ends can reach the ink edge. Each stroke is a flat
  // point list; its first segment sets the direction its lines fly in from.
  // Strokes are listed bottom to top: branches first, so they tuck under the stems.
  var SKELETONS = {
    Y: function (w, h, e) {
      var jy = h * 0.42;
      return [[w, h + e, w / 2, jy], [w / 2, -e, w / 2, jy, 0, h + e]];
    },
    u: function (w, h, e) {
      var c = Math.min(w * 0.42, h * 0.45);
      return [[0, h + e, 0, c, c, 0, w - c, 0, w, c], [w, -e, w, h + e]];
    },
    a: function (w, h, e) {
      var c = w * 0.34, t = w * 0.16, bt = h * 0.56, c2 = Math.min(w * 0.26, bt * 0.4);
      return [[w, bt, c2, bt, 0, bt - c2, 0, c2, c2, 0, w - c2, 0, w, c2],
              [w, -e, w, h - c, w - c, h, t, h, 0, h - t]];
    },
    n: function (w, h, e) {
      var c = Math.min(w * 0.42, h * 0.45);
      return [[w, -e, w, h - c, w - c, h, c, h, 0, h - c], [0, h + e, 0, -e]];
    },
    F: function (w, h, e) {
      var m = h * 0.54;
      return [[0, m, w * 0.84 + e, m], [w + e, h, 0, h, 0, -e]];
    },
    o: function (w, h) {
      var c = Math.min(w, h) * 0.3;
      return [[0, h / 2, 0, c, c, 0, w - c, 0, w, c, w, h - c, w - c, h, c, h, 0, h - c, 0, h / 2]];
    },
    r: function (w, h, e) {
      var c = Math.min(w * 0.55, h * 0.4);
      return [[w + e, h, c, h, 0, h - c], [0, h + e, 0, -e]];
    },
    z: function (w, h, e) {
      return [[-e, h, w, h, 0, 0, w + e, 0]];
    }
  };

  var text = api.text, W = api.W, H = api.H, size = api.size;
  for (var i = 0; i < text.length; i++) {
    if (text.charAt(i) !== " " && !SKELETONS[text.charAt(i)]) return null;
  }

  // Each letter's ink box in word space. The pen position comes from the width of
  // the text up to and including the letter, so kerning with the previous one counts.
  var m = document.createElement("canvas").getContext("2d");
  m.font = api.font(size);
  var glyphs = [];
  for (i = 0; i < text.length; i++) {
    var ch = text.charAt(i), gm = m.measureText(ch);
    var gx = m.measureText(text.slice(0, i + 1)).width - gm.width;
    glyphs.push({
      ch: ch, x: gx,
      left: gx - (gm.actualBoundingBoxLeft || 0), right: gx + (gm.actualBoundingBoxRight || gm.width),
      top: -(gm.actualBoundingBoxAscent || 0), bottom: gm.actualBoundingBoxDescent || 0
    });
  }

  // Stem width: the median run of ink across the middle of the x-height.
  var xh = m.measureText("x").actualBoundingBoxAscent || size * 0.52;
  var r = api.raster(4), row = r.oy - Math.round(xh / 2), runs = [], run = 0;
  for (var x = 0; x < r.w; x++) {
    if (r.data[(row * r.w + x) * 4 + 3] > 128) run++;
    else if (run) { runs.push(run); run = 0; }
  }
  runs.sort(function (a, b) { return a - b; });
  var stem = runs.length ? runs[runs.length >> 1] : size * 0.13;

  var lw = Math.max(1, Math.min(2.2, size * 0.016));  // line width
  var rw = stem * 0.96;                                // ribbon width, outer edge to outer edge
  var ko = lw * 1.6;                                   // clearance cut around a ribbon at crossings
  var hs = stem / 2;

  // Timeline (ms).
  var DUR = 760, LAG = 45, SET_AT = 1000, SET_DUR = 340, FORMED = 1420;
  var TAIL = Math.max(140, Math.min(W, H) * 0.5);
  var ACC = Math.max(8, size * 0.14);

  // Distance from (x, y) to beyond the screen edge, walking along (dx, dy).
  function exitDistance(x, y, dx, dy) {
    var d = Infinity;
    if (dx > 1e-6) d = Math.min(d, (W - x) / dx);
    if (dx < -1e-6) d = Math.min(d, -x / dx);
    if (dy > 1e-6) d = Math.min(d, (H - y) / dy);
    if (dy < -1e-6) d = Math.min(d, -y / dy);
    return (isFinite(d) ? Math.max(0, d) : 0) + 60;
  }

  var strokes = [], gi = 0;
  glyphs.forEach(function (g) {
    var make = SKELETONS[g.ch];
    if (!make) return;
    var bx = g.left + hs, by = g.bottom - hs;
    var w = Math.max(1, g.right - g.left - 2 * hs), h = Math.max(1, g.bottom - g.top - 2 * hs);
    make(w, h, hs).forEach(function (pts, si) {
      var path = new Path2D(), len = 0, px = 0, py = 0;
      for (var k = 0; k < pts.length; k += 2) {
        var u = bx + pts[k], v = by - pts[k + 1];
        if (k) {
          path.lineTo(u, v);
          len += Math.hypot(u - px, v - py);
        } else {
          path.moveTo(u, v);
        }
        px = u;
        py = v;
      }
      var sx = bx + pts[0], sy = by - pts[1];
      var dx = pts[2] - pts[0], dy = -(pts[3] - pts[1]), dl = Math.hypot(dx, dy) || 1;
      dx /= dl;
      dy /= dl;
      var lin = exitDistance(api.x0 + sx, api.y0 + sy, -dx, -dy);
      strokes.push({
        path: path, len: len, lin: lin, sx: sx, sy: sy, dx: dx, dy: dy,
        start: 60 + gi * 52 + si * 95 + Math.random() * 50, order: gi * 10 + si
      });
    });
    gi++;
  });
  strokes.sort(function (a, b) { return a.order - b.order; });

  // Guides: baseline, x-height and cap height across the screen.
  var capH = 0;
  glyphs.forEach(function (g) { if (/[A-Z]/.test(g.ch)) capH = Math.max(capH, -g.top); });
  var guides = [0, -xh];
  if (capH) guides.push(-capH);

  function head(s, t) {
    return (s.lin + s.len) * ease.outCubic((t - s.start) / DUR);
  }

  // The comet's tail: a fixed length behind the head that shrinks to nothing, so the
  // lead-in is gone by the time the letter is written.
  function tail(s, t, h) {
    var shrink = 1 - ease.inOutCubic(((t - s.start) / DUR - 0.25) / 0.5);
    return Math.min(Math.max(h - TAIL * shrink, 0), s.lin);
  }

  // A point at distance d along the lead-in (d = lin is the stroke's start).
  function lx(s, d) { return s.sx - s.dx * (s.lin - d); }
  function ly(s, d) { return s.sy - s.dy * (s.lin - d); }

  function streak(s, from, to, off, width) {
    var nx = -s.dy * off, ny = s.dx * off;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(lx(s, from) + nx, ly(s, from) + ny);
    ctx.lineTo(lx(s, to) + nx, ly(s, to) + ny);
    ctx.stroke();
  }

  function dash(len, offset) {
    ctx.setLineDash([Math.max(0, len), 1e5]);
    ctx.lineDashOffset = -(offset || 0);
  }

  function drawGuides(t) {
    var grow = ease.outExpo((t - 40) / 520);
    var a = (1 - ease.smooth((t - 1150) / 320)) * (1 - api.out);
    if (grow <= 0 || a <= 0) return;
    var cx = api.x0 + api.width / 2, half = (W / 2 + 20) * grow;
    ctx.globalAlpha = a;
    ctx.fillStyle = api.colors.faint;
    for (var i = 0; i < guides.length; i++) {
      var y = Math.round((api.y0 + guides[i]) * api.dpr) / api.dpr;
      ctx.fillRect(cx - half, y, half * 2, 1);
    }
    // Ticks at each letter's pen position, below the baseline.
    ctx.fillStyle = api.colors.dim;
    var by = Math.round(api.y0 * api.dpr) / api.dpr;
    for (var j = 0; j <= glyphs.length; j++) {
      var tk = ease.outExpo((t - 120 - j * 30) / 300);
      if (tk <= 0) break;
      var gx = j < glyphs.length ? glyphs[j].x : api.width;
      ctx.fillRect(Math.round(api.x0 + gx), by + 3, 1, 5 * tk);
    }
    ctx.globalAlpha = 1;
  }

  // Once written, a slanted wipe with an accent edge fills the ribbons solid.
  var inkTop = -(capH || xh), inkBottom = 0;
  glyphs.forEach(function (g) { inkBottom = Math.max(inkBottom, g.bottom); });
  function drawSet(t) {
    var p = ease.inOutCubic((t - SET_AT) / SET_DUR);
    if (p <= 0) return;
    var mg = size * 0.12, top = inkTop - mg, bottom = inkBottom + mg, rise = bottom - top;
    var front = api.mix(-rise, api.width + rise, p);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-rise * 2, top);
    ctx.lineTo(front + rise / 2, top);
    ctx.lineTo(front - rise / 2, bottom);
    ctx.lineTo(-rise * 2, bottom);
    ctx.closePath();
    ctx.clip();
    ctx.globalAlpha = api.wordAlpha;
    ctx.strokeStyle = api.colors.fg;
    ctx.lineWidth = rw;
    for (var i = 0; i < strokes.length; i++) ctx.stroke(strokes[i].path);
    ctx.restore();
    var ea = 1 - ease.smooth((p - 0.8) / 0.2);
    if (ea > 0) {
      ctx.globalAlpha = ea * api.wordAlpha;
      ctx.strokeStyle = api.colors.accent;
      ctx.lineWidth = lw * 1.5;
      ctx.beginPath();
      ctx.moveTo(front + rise / 2, top);
      ctx.lineTo(front - rise / 2, bottom);
      ctx.stroke();
    }
  }

  function frame(t) {
    drawGuides(t);

    api.wordSpace();
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    ctx.miterLimit = 3;
    // Fully set: only the solid letters are left.
    if (t >= SET_AT + SET_DUR) {
      drawSet(t);
      ctx.globalAlpha = 1;
      return;
    }
    var fg = api.colors.fg, alpha = api.wordAlpha, off = rw / 2 - lw / 2;

    for (var i = 0; i < strokes.length; i++) {
      var s = strokes[i];
      if (t <= s.start) continue;
      var h1 = head(s, t), h2 = head(s, t - LAG);
      var t1 = tail(s, t, h1), t2 = tail(s, t - LAG, h2);
      var accA = 1 - ease.smooth(((t - s.start) / DUR - 0.75) / 0.25);

      // Lead-in: three parallel lines, fading out towards the tail.
      if (t1 < s.lin) {
        ctx.setLineDash([]);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = alpha;
        var e1 = Math.min(h1, s.lin), e2 = Math.min(h2, s.lin);
        var gr = ctx.createLinearGradient(lx(s, t1), ly(s, t1), lx(s, e1), ly(s, e1));
        gr.addColorStop(0, api.rgba("fg", 0));
        gr.addColorStop(1, fg);
        ctx.strokeStyle = gr;
        streak(s, t1, e1, 0, lw);
        if (t2 < e2) {
          streak(s, t2, e2, off, lw);
          streak(s, t2, e2, -off, lw);
        }
        if (h1 < s.lin) {
          ctx.strokeStyle = api.colors.accent;
          streak(s, Math.max(t1, h1 - ACC), h1, 0, lw * 1.6);
        }
      }

      // The letter itself: cut a clearance through what is underneath, then draw
      // the outer pair as a hollow ribbon and the centre line.
      var d1 = h1 - s.lin, d2 = h2 - s.lin;
      if (d1 <= 0) continue;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = rw + ko * 2;
      dash(d1);
      ctx.stroke(s.path);
      if (d2 > 0) {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = fg;
        ctx.lineWidth = rw;
        dash(d2);
        ctx.stroke(s.path);
        ctx.globalCompositeOperation = "destination-out";
        ctx.globalAlpha = 1;
        ctx.lineWidth = rw - lw * 2;
        ctx.stroke(s.path);
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = fg;
      ctx.lineWidth = lw;
      dash(d1);
      ctx.stroke(s.path);
      if (accA > 0) {
        var a0 = Math.max(0, d1 - ACC);
        ctx.globalAlpha = alpha * accA;
        ctx.strokeStyle = api.colors.accent;
        ctx.lineWidth = lw * 1.6;
        dash(d1 - a0, a0);
        ctx.stroke(s.path);
      }
    }
    ctx.setLineDash([]);
    ctx.globalCompositeOperation = "source-over";
    drawSet(t);
    ctx.globalAlpha = 1;
  }

  return { formed: FORMED, frame: frame };
};
