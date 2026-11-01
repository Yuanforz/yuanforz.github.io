// Particles: scattered dots gather into the word, a thin accent line is drawn
// under it, then the dots shrink onto the header logo.
(window.__introVariants = window.__introVariants || {}).particles = function (api) {
  "use strict";

  var ctx = api.ctx, ease = api.ease, clamp01 = api.clamp01;
  var T = { orgStart: 150, orgDur: 700, stagger: 220, lineStart: 950, lineDur: 450, lineOut: 250, formed: 1500 };
  var BUCKETS = 8, MAX_PARTICLES = 1600;

  // Sample the word on a grid; coarser until it fits the particle budget.
  var r = api.raster(4);
  var gap = Math.max(3, Math.round(api.size / 21)), pts;
  do {
    pts = [];
    for (var y = 0; y < r.h; y += gap) {
      for (var x = 0; x < r.w; x += gap) {
        if (r.data[(y * r.w + x) * 4 + 3] > 128) pts.push([x - r.ox, y - r.oy]);
      }
    }
    gap += 1;
  } while (pts.length > MAX_PARTICLES);
  gap -= 1;

  var palette = [];
  for (var i = 0; i < BUCKETS; i++) {
    var k = i / (BUCKETS - 1), a = api.rgb.dim, b = api.rgb.fg;
    palette.push("rgba(" + Math.round(a[0] + (b[0] - a[0]) * k) + "," + Math.round(a[1] + (b[1] - a[1]) * k) + "," +
      Math.round(a[2] + (b[2] - a[2]) * k) + "," + (0.3 + 0.65 * k).toFixed(3) + ")");
  }

  var W = api.W, H = api.H;
  var particles = pts.map(function (p) {
    return {
      px: p[0], py: p[1],
      x0: Math.random() * W, y0: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.05, vy: (Math.random() - 0.5) * 0.05,
      s: Math.max(1.2, gap * 0.4) * (0.85 + Math.random() * 0.3),
      delay: (p[0] / api.width) * T.stagger + Math.random() * 60
    };
  });
  // Neighbouring particles share a colour bucket, so the fill colour rarely changes.
  particles.sort(function (a, b) { return a.delay - b.delay; });

  var lineW = Math.min(api.width * 0.5, 320);
  var lineY = Math.round((api.y0 + api.desc + Math.max(16, api.size * 0.28)) * api.dpr) / api.dpr;

  function frame(t) {
    ctx.globalAlpha = clamp01(t / 120) * api.wordAlpha;
    var last = -1;
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var k = ease.outExpo((t - T.orgStart - p.delay) / T.orgDur);
      // A little drift while scattered, frozen once the particle starts to gather.
      var tf = Math.min(t, T.orgStart + p.delay);
      var sx = p.x0 + p.vx * tf, sy = p.y0 + p.vy * tf;
      var x = sx + (api.x + p.px * api.k - sx) * k;
      var y = sy + (api.y + p.py * api.k - sy) * k;
      var size = p.s * (0.6 + 0.4 * k);
      size += (1.15 - size) * api.out;
      var b = Math.round(k * (BUCKETS - 1));
      if (b !== last) {
        ctx.fillStyle = palette[b];
        last = b;
      }
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
    }

    // The one accent: a thin line drawn under the word, gone early in the handoff.
    var lp = ease.outExpo((t - T.lineStart) / T.lineDur);
    var lf = 1 - clamp01((t - T.formed) / T.lineOut);
    if (lp > 0 && lf > 0) {
      ctx.globalAlpha = lf;
      ctx.fillStyle = api.colors.accent;
      var lw = lineW * lp;
      ctx.fillRect(W / 2 - lw / 2, lineY, lw, 1);
    }
  }

  return { formed: T.formed, frame: frame };
};
