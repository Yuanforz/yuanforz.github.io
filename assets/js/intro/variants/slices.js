// Slices: the word is cut into horizontal strips that slide into a window between
// two hairline rails from alternating sides, carried by accent speed lines; they
// jolt once with an accent split, then lock.
(window.__introVariants = window.__introVariants || {}).slices = function (api) {
  "use strict";

  var ctx = api.ctx, ease = api.ease, clamp01 = api.clamp01, dpr = api.dpr;
  var W = api.W, size = api.size, x0 = api.x0, y0 = api.y0;

  // Strip heights (relative), the order they enter in, and the glitch offsets (in em).
  var WEIGHTS = [3, 5, 2, 6, 3, 4, 3];
  var ORDER = [2, 5, 0, 3, 6, 1, 4];
  var JOLT = [
    [0, 0.06, 0, -0.08, 0.03, 0, -0.05],
    [-0.025, 0, 0.04, 0.015, 0, -0.03, 0.015]
  ];
  var T = { rails: 0, railsDur: 480, enter: 120, stagger: 36, slide: 580, sharp: 12,
            jolt: 880, joltStep: 38, sweep: 990, sweepDur: 420, label: 1040, formed: 1400 };

  // The word at device resolution, in the text colour and in the accent.
  var side = Math.ceil(size * 0.12), pad = Math.ceil(size * 0.08);
  var cw = Math.ceil(api.width) + side * 2, ch = api.asc + api.desc + pad * 2;
  var ox = side, oy = pad + api.asc;
  function render(colour) {
    var c = document.createElement("canvas");
    c.width = Math.ceil(cw * dpr);
    c.height = Math.ceil(ch * dpr);
    var o = c.getContext("2d");
    o.scale(dpr, dpr);
    o.font = api.font(size);
    o.textBaseline = "alphabetic";
    o.fillStyle = colour;
    o.fillText(api.text, ox, oy);
    return c;
  }
  var ink = render(api.colors.fg), tint = render(api.colors.accent);

  // Strip boundaries in device rows, spread over the ink; the outer strips keep the padding.
  var top = Math.round(pad * dpr), bottom = Math.round((oy + api.desc) * dpr);
  var total = 0, i;
  for (i = 0; i < WEIGHTS.length; i++) total += WEIGHTS[i];
  var rows = [0], acc = 0;
  for (i = 0; i < WEIGHTS.length - 1; i++) {
    acc += WEIGHTS[i];
    rows.push(Math.round(top + (bottom - top) * acc / total));
  }
  rows.push(ink.height);

  var gap = Math.max(10, Math.round(size * 0.16));

  // Pin the word to device pixels so neighbouring strips meet without seams.
  var dx0 = Math.round((x0 - ox) * dpr) / dpr, dy0 = Math.round((y0 - oy) * dpr) / dpr;
  var strips = [];
  for (i = 0; i < WEIGHTS.length; i++) {
    var dir = i % 2 ? 1 : -1;
    strips.push({
      sy: rows[i], sh: rows[i + 1] - rows[i],
      dir: dir,
      // Start just outside the window on its side.
      dist: api.width + gap * 2,
      start: T.enter + ORDER.indexOf(i) * T.stagger
    });
  }

  // Rails above and below the word, ticks at its ends, and a small label.
  var railTop = Math.round((y0 - api.asc - gap) * dpr) / dpr;
  var railBottom = Math.round((y0 + api.desc + gap) * dpr) / dpr;
  var tickL = Math.round(x0 - gap), tickR = Math.round(x0 + api.width + gap);
  var labelPx = size < 60 ? 9 : 10;
  var label = (api.labels.name || "").toUpperCase();
  var labelX = [], lx = 0;
  ctx.font = api.mono(labelPx);
  var track = labelPx * 0.32;
  for (i = 0; i < label.length; i++) {
    labelX.push(lx);
    lx += ctx.measureText(label.charAt(i)).width + track;
  }
  var labelW = lx - track;

  // A sharp exponential ease-out: fast in, hard stop.
  function offset(s, t) {
    var p = clamp01((t - s.start) / T.slide);
    return s.dir * s.dist * (p >= 1 ? 0 : Math.pow(2, -T.sharp * p));
  }
  // Speed in px per ms, for the speed lines.
  function speed(s, t) {
    var p = clamp01((t - s.start) / T.slide);
    if (p <= 0 || p >= 1) return 0;
    return s.dist * T.sharp * Math.LN2 * Math.pow(2, -T.sharp * p) / T.slide;
  }

  function drawStrip(img, s, x) {
    var sh = s.sh / dpr;
    ctx.drawImage(img, 0, s.sy, img.width, s.sh, dx0 + x, dy0 + s.sy / dpr, cw, sh);
  }

  function frame(t) {
    // Decorations clear out quickly once the word starts to move.
    var out = (1 - api.out) * (1 - clamp01((t - T.formed) / 250));

    // Rails grow from the centre outwards; ticks and label sit on them.
    var rp = ease.outExpo((t - T.rails) / T.railsDur);
    if (rp > 0 && out > 0) {
      var half = (W / 2 + 2) * rp;
      ctx.globalAlpha = out;
      ctx.fillStyle = api.colors.faint;
      ctx.fillRect(W / 2 - half, railTop, half * 2, 1);
      ctx.fillRect(W / 2 - half, railBottom, half * 2, 1);
      var tk = ease.outExpo((t - T.rails - 160) / 300) * 5;
      if (tk > 0) {
        ctx.fillStyle = api.colors.dim;
        ctx.fillRect(tickL, railTop - tk, 1, tk * 2);
        ctx.fillRect(tickR, railTop - tk, 1, tk * 2);
        ctx.fillRect(tickL, railBottom - tk, 1, tk * 2);
        ctx.fillRect(tickR, railBottom - tk, 1, tk * 2);
      }
      // After the lock, an accent bar runs along the bottom rail.
      var sp = ease.outExpo((t - T.sweep) / T.sweepDur);
      if (sp > 0) {
        ctx.fillStyle = api.colors.accent;
        ctx.fillRect(tickL, railBottom - 1, (tickR - tickL + 1) * sp, 2);
      }
      // The name types on under the rail, right-aligned to the word.
      var shown = Math.floor(clamp01((t - T.label) / 260) * label.length + 0.001);
      if (shown > 0) {
        ctx.font = api.mono(labelPx);
        ctx.textBaseline = "top";
        ctx.fillStyle = api.colors.dim;
        var base = tickR + 1 - labelW;
        for (var c = 0; c < shown; c++) ctx.fillText(label.charAt(c), base + labelX[c], railBottom + 8);
      }
      ctx.globalAlpha = 1;
    }

    // Handoff: the real text follows the core's placement, so it stays sharp as it shrinks.
    if (t >= T.formed) {
      api.drawText(api.wordAlpha);
      return;
    }

    // Glitch: two hard-cut steps of strip offsets with an accent split, then lock.
    var step = Math.floor((t - T.jolt) / T.joltStep);
    var jolt = step >= 0 && step < JOLT.length ? JOLT[step] : null;
    if (t >= T.jolt + JOLT.length * T.joltStep) {
      ctx.drawImage(ink, dx0, dy0, cw, ch);
      return;
    }

    // A speed line trails each moving strip, up to where the strip shows in the window.
    var k, s, x, v;
    ctx.fillStyle = api.colors.accent;
    for (k = 0; k < strips.length; k++) {
      s = strips[k];
      v = speed(s, t);
      if (v < 0.08) continue;
      x = x0 + offset(s, t);
      var len = Math.min(v * 110, W);
      var cy = dy0 + Math.round(s.sy + s.sh / 2) / dpr;
      ctx.globalAlpha = clamp01(v / 1.2) * 0.9;
      if (s.dir < 0) {
        var endL = Math.min(x + api.width, Math.max(tickL, x));
        ctx.fillRect(endL - len, cy, len, 1);
      } else {
        var endR = Math.max(x, Math.min(tickR, x + api.width));
        ctx.fillRect(endR, cy, len, 1);
      }
    }
    ctx.globalAlpha = 1;

    // The strips only show inside the window between the rails and the end ticks.
    ctx.save();
    ctx.beginPath();
    ctx.rect(tickL + 1, railTop + 1, tickR - tickL - 1, railBottom - railTop - 1);
    ctx.clip();
    for (k = 0; k < strips.length; k++) {
      s = strips[k];
      if (t < s.start) continue;
      x = offset(s, t);
      if (jolt) {
        x += jolt[k] * size;
        ctx.globalAlpha = 0.9;
        drawStrip(tint, s, x + (step ? -1 : 1) * Math.max(2, size * 0.035));
        ctx.globalAlpha = 1;
      }
      drawStrip(ink, s, x);
    }
    ctx.restore();
  }

  return { formed: T.formed, frame: frame, realText: true };
};
