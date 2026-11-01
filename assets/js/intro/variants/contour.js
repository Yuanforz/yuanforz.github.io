// Contour: the word as a mountain range on a topographic map. Its outline draws
// first, contour lines spread inward and outward through a faint random terrain,
// the glyphs fill from their spines out to the edge, and a ripple runs out through
// the rings as they fade.
(window.__introVariants = window.__introVariants || {}).contour = function (api) {
  "use strict";

  var ctx = api.ctx, ease = api.ease, clamp01 = api.clamp01;
  var W = api.W, H = api.H, size = api.size, u = size / 40;
  var INF = 1e20;

  // Distance levels in px: negative outside the glyphs, positive inside.
  var HALO = [11, 7.9, 5.3, 3.2, 1.5].map(function (m) { return -m * u; });
  var INNER = [0.026, 0.052].map(function (m) { return m * size; });
  var TERRAIN = [0.58, 0.66, 0.74, 0.82, 0.9];
  var T = {
    start: 40, level: 65, draw: 560, sweep: 200,
    terrain: 260, terrainSpread: 380,
    fill: 1000, fillStep: 90, fillDur: 160,
    engrave: 1330, engraveDur: 200,
    ripple: 1100, rippleDur: 600, rippleRings: 150,
    formed: 1650
  };

  // Smooth value noise in [0, 1], fresh every visit.
  function noise(cell, w, h) {
    var nx = Math.ceil(w / cell) + 2, ny = Math.ceil(h / cell) + 2, g = new Float32Array(nx * ny);
    for (var i = 0; i < g.length; i++) g[i] = Math.random();
    return function (x, y) {
      var fx = Math.max(0, x / cell), fy = Math.max(0, y / cell);
      var ix = Math.min(nx - 2, Math.floor(fx)), iy = Math.min(ny - 2, Math.floor(fy));
      var tx = fx - ix, ty = fy - iy;
      tx = tx * tx * (3 - 2 * tx);
      ty = ty * ty * (3 - 2 * ty);
      var p = iy * nx + ix;
      var a = g[p] + (g[p + 1] - g[p]) * tx, b = g[p + nx] + (g[p + nx + 1] - g[p + nx]) * tx;
      return a + (b - a) * ty;
    };
  }
  var n1 = noise(size * 1.9, W + size * 4, H + size * 4);
  var n2 = noise(size * 0.8, W + size * 4, H + size * 4);
  var n3 = noise(size * 0.35, W + size * 4, H + size * 4);
  var w1 = noise(size * 0.7, W + size * 4, H + size * 4), w2 = noise(size * 0.3, W + size * 4, H + size * 4);
  function fbm(x, y) {
    x += size * 2;
    y += size * 2;
    return 0.58 * n1(x, y) + 0.3 * n2(x, y) + 0.12 * n3(x, y);
  }
  // A second, busier field that roughens the edge of the flat ground around the word.
  function warp(x, y) {
    x += size * 2;
    y += size * 2;
    return 0.65 * w1(x, y) + 0.35 * w2(x, y) - 0.5;
  }

  // 1. Signed distance field of the word (from its antialiased coverage), on a
  //    grid of s x s pixel cells. Outside the glyphs it is bent by the terrain
  //    noise, more the further out, so the outer rings wander like real contours.
  var r = api.raster(Math.ceil(size * 0.42));
  var s = r.w * r.h > 120000 ? 2 : 1;
  var gw = Math.ceil(r.w / s), gh = Math.ceil(r.h / s), n = gw * gh;
  var outer = new Float64Array(n), inner = new Float64Array(n);
  var x, y, i, j, c;
  for (y = 0; y < gh; y++) {
    for (x = 0; x < gw; x++) {
      var sum = 0, cnt = 0;
      for (j = y * s; j < Math.min(r.h, y * s + s); j++) {
        for (i = x * s; i < Math.min(r.w, x * s + s); i++) {
          sum += r.data[(j * r.w + i) * 4 + 3];
          cnt++;
        }
      }
      var a = sum / cnt / 255, d = 0.5 - a;
      c = y * gw + x;
      if (a >= 1) { outer[c] = 0; inner[c] = INF; }
      else if (a <= 0) { outer[c] = INF; inner[c] = 0; }
      else { outer[c] = d > 0 ? d * d : 0; inner[c] = d < 0 ? d * d : 0; }
    }
  }
  edt(outer, gw, gh);
  edt(inner, gw, gh);
  var sd = new Float32Array(n), wx0 = api.x0 - r.ox + s / 2, wy0 = api.y0 - r.oy + s / 2;
  for (y = 0; y < gh; y++) {
    for (x = 0; x < gw; x++) {
      c = y * gw + x;
      var v = (Math.sqrt(inner[c]) - Math.sqrt(outer[c])) * s;
      if (v < 0) v -= clamp01(-v / (10 * u)) * 12 * u * (fbm(wx0 + x * s, wy0 + y * s) - 0.5);
      sd[c] = v;
    }
  }
  outer = inner = null;

  // Exact squared Euclidean distance transform (Felzenszwalb & Huttenlocher), in place.
  function edt(g, w, h) {
    var m = Math.max(w, h);
    var f = new Float64Array(m), v = new Int32Array(m), z = new Float64Array(m + 1);
    for (var x = 0; x < w; x++) edt1d(g, x, w, h, f, v, z);
    for (var y = 0; y < h; y++) edt1d(g, y * w, 1, w, f, v, z);
  }
  function edt1d(g, off, stride, len, f, v, z) {
    var q, k, p, sv;
    for (q = 0; q < len; q++) f[q] = g[off + q * stride];
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (q = 1, k = 0; q < len; q++) {
      do {
        p = v[k];
        sv = (f[q] - f[p] + q * q - p * p) / (q - p) / 2;
      } while (sv <= z[k] && --k > -1);
      k++;
      v[k] = q;
      z[k] = sv;
      z[k + 1] = INF;
    }
    for (q = 0, k = 0; q < len; q++) {
      while (z[k + 1] < q) k++;
      p = v[k];
      g[off + q * stride] = f[p] + (q - p) * (q - p);
    }
  }

  // 2. Marching squares: closed loops where field == level, with grid point
  //    (x, y) mapped to (ox + x * step, oy + y * step). Loop points live on cell
  //    edges: horizontal edge ids 0..n-1, vertical n..2n-1. The field's border
  //    must be below every level, so all loops close.
  // Segments per case (corner bits tl 8, tr 4, br 2, bl 1); edges 0 top, 1 right, 2 bottom, 3 left.
  var CASES = [[], [3, 2], [2, 1], [3, 1], [0, 1], null, [0, 2], [0, 3],
               [0, 3], [0, 2], null, [0, 1], [3, 1], [2, 1], [3, 2], []];

  function tracer(field, w, h, ox, oy, step, passes) {
    var nn = w * h;
    var nb1 = new Int32Array(2 * nn).fill(-1), nb2 = new Int32Array(2 * nn).fill(-1);
    var ex = new Float32Array(2 * nn), ey = new Float32Array(2 * nn), seen = new Uint8Array(2 * nn);
    var e = [0, 0, 0, 0];
    return function (level) {
      var touched = [], loops = [];
      function link(p, q) {
        if (nb1[p] < 0) { nb1[p] = q; touched.push(p); } else nb2[p] = q;
        if (nb1[q] < 0) { nb1[q] = p; touched.push(q); } else nb2[q] = p;
      }
      for (var y = 0; y < h - 1; y++) {
        for (var x = 0; x < w - 1; x++) {
          var c = y * w + x;
          var tl = field[c], tr = field[c + 1], bl = field[c + w], br = field[c + w + 1];
          var k = (tl >= level ? 8 : 0) | (tr >= level ? 4 : 0) | (br >= level ? 2 : 0) | (bl >= level ? 1 : 0);
          if (k === 0 || k === 15) continue;
          e[0] = c; e[1] = nn + c + 1; e[2] = c + w; e[3] = nn + c;
          ex[e[0]] = x + (level - tl) / (tr - tl); ey[e[0]] = y;
          ex[e[1]] = x + 1; ey[e[1]] = y + (level - tr) / (br - tr);
          ex[e[2]] = x + (level - bl) / (br - bl); ey[e[2]] = y + 1;
          ex[e[3]] = x; ey[e[3]] = y + (level - tl) / (bl - tl);
          var seg = CASES[k];
          if (!seg) {
            var centre = (tl + tr + bl + br) / 4 >= level;
            seg = (k === 5) === centre ? [0, 3, 2, 1] : [0, 1, 3, 2];
          }
          for (var m = 0; m < seg.length; m += 2) link(e[seg[m]], e[seg[m + 1]]);
        }
      }
      for (var t = 0; t < touched.length; t++) {
        var start = touched[t];
        if (seen[start]) continue;
        var pts = [], prev = -1, cur = start;
        for (;;) {
          seen[cur] = 1;
          pts.push(ox + ex[cur] * step, oy + ey[cur] * step);
          var nx = nb1[cur] !== prev ? nb1[cur] : nb2[cur];
          if (nx < 0 || seen[nx]) break;
          prev = cur;
          cur = nx;
        }
        var loop = finishLoop(pts, step, passes);
        if (loop) loops.push(loop);
      }
      for (t = 0; t < touched.length; t++) {
        var id = touched[t];
        nb1[id] = nb2[id] = -1;
        seen[id] = 0;
      }
      return loops;
    };
  }

  // Smooth, simplify, orient clockwise (on screen) and measure a loop.
  function finishLoop(pts, step, passes) {
    var np = pts.length / 2, i;
    if (np < 3) return null;
    for (var pass = 0; pass < passes; pass++) {
      var sm = new Float64Array(pts.length);
      for (i = 0; i < np; i++) {
        var p = (i + np - 1) % np, q = (i + 1) % np;
        sm[2 * i] = (pts[2 * p] + 2 * pts[2 * i] + pts[2 * q]) / 4;
        sm[2 * i + 1] = (pts[2 * p + 1] + 2 * pts[2 * i + 1] + pts[2 * q + 1]) / 4;
      }
      pts = sm;
    }
    pts = simplify(pts, 0.12 * step + 0.1);
    np = pts.length / 2;
    if (np < 3) return null;
    var len = 0, area = 0, cx = 0, cy = 0, top = 0;
    for (i = 0; i < np; i++) {
      var j = (i + 1) % np;
      var x0 = pts[2 * i], y0 = pts[2 * i + 1], x1 = pts[2 * j], y1 = pts[2 * j + 1];
      len += Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
      area += x0 * y1 - x1 * y0;
      cx += x0;
      cy += y0;
      if (y0 < pts[2 * top + 1]) top = i;
    }
    if (len < 4) return null;
    // Start at the top of the loop, so it draws on from there in both directions.
    var path = new Path2D(), k0;
    for (i = 0; i < np; i++) {
      k0 = ((area < 0 ? np - i : i) + top) % np;
      if (i) path.lineTo(pts[2 * k0], pts[2 * k0 + 1]);
      else path.moveTo(pts[2 * k0], pts[2 * k0 + 1]);
    }
    path.closePath();
    return { path: path, len: len, cx: cx / np, cy: cy / np, pts: pts };
  }

  // Ramer-Douglas-Peucker on a flat [x, y, ...] polyline.
  function simplify(pts, tol) {
    var np = pts.length / 2;
    if (np < 4) return pts;
    var keep = new Uint8Array(np), stack = [0, np - 1], t2 = tol * tol;
    keep[0] = keep[np - 1] = 1;
    while (stack.length) {
      var b = stack.pop(), a = stack.pop();
      var ax = pts[2 * a], ay = pts[2 * a + 1], dx = pts[2 * b] - ax, dy = pts[2 * b + 1] - ay;
      var l2 = dx * dx + dy * dy, best = -1, bi = -1;
      for (var i = a + 1; i < b; i++) {
        var px = pts[2 * i] - ax, py = pts[2 * i + 1] - ay, d2;
        if (l2 === 0) d2 = px * px + py * py;
        else {
          var cr = px * dy - py * dx;
          d2 = cr * cr / l2;
        }
        if (d2 > best) { best = d2; bi = i; }
      }
      if (best > t2) {
        keep[bi] = 1;
        stack.push(a, bi, bi, b);
      }
    }
    var out = [];
    for (i = 0; i < np; i++) if (keep[i]) out.push(pts[2 * i], pts[2 * i + 1]);
    return out;
  }

  // 3. The word's levels (word space), outermost first. Lines spread out from
  //    the outline one level at a time, each level sweeping left to right.
  var traceWord = tracer(sd, gw, gh, s / 2 - r.ox, s / 2 - r.oy, s, 1);
  var levels = [], all = HALO.concat([0], INNER), oi = HALO.length;
  for (i = 0; i < all.length; i++) {
    var loops = traceWord(all[i]);
    if (!loops.length) continue;
    var fillPath = new Path2D();
    for (j = 0; j < loops.length; j++) fillPath.addPath(loops[j].path);
    levels.push({ d: all[i], loops: loops, fill: fillPath, halo: all[i] < 0, outline: all[i] === 0,
                  start: T.start + Math.abs(i - oi) * T.level });
  }
  sd = null;
  var outline = levels.filter(function (lv) { return lv.outline; })[0];
  if (!outline) return null;
  levels.forEach(function (lv) {
    lv.loops.forEach(function (lp) { lp.delay = clamp01(lp.cx / api.width) * T.sweep; });
  });

  // Fill order: innermost terrace first, the outline last.
  var terraces = levels.filter(function (lv) { return lv.d > 0; }).reverse();
  terraces.push(outline);
  terraces.forEach(function (lv, ti) { lv.fillAt = T.fill + ti * T.fillStep; });

  // 4. Faint terrain across the screen (screen space), flattened near the word so
  //    its hills never cross the word's own rings.
  var tstep = Math.max(5, Math.round(Math.min(W, H) / 110));
  var tw = Math.ceil(W / tstep) + 3, th = Math.ceil(H / tstep) + 3;
  var tf = new Float32Array(tw * th), ox0 = -tstep, oy0 = -tstep;
  // Distance to the capsule around the word, in screen px.
  var cy0 = api.y0 + (api.desc - api.asc) / 2, hh = (api.asc + api.desc) / 2;
  var ca = api.x0 + hh, cb = api.x0 + api.width - hh;
  function capsule(px, py) {
    var qx = Math.max(ca, Math.min(cb, px));
    return Math.sqrt((px - qx) * (px - qx) + (py - cy0) * (py - cy0)) - hh;
  }
  for (y = 1; y < th - 1; y++) {
    for (x = 1; x < tw - 1; x++) {
      var px = ox0 + x * tstep, py = oy0 + y * tstep;
      var dist = capsule(px, py) + warp(px, py) * 22 * u;
      var flat = ease.smooth((dist - 9 * u) / (10 * u));
      tf[y * tw + x] = flat > 0 ? ((fbm(px, py) - 0.5) * 1.7 + 0.5) * flat : 0;
    }
  }
  var traceTerrain = tracer(tf, tw, th, ox0, oy0, tstep, 2);
  var terrain = [], maxDist = Math.sqrt(W * W + H * H) / 2;
  TERRAIN.forEach(function (lvl, li) {
    traceTerrain(lvl).forEach(function (lp) {
      var near = INF;
      for (var p = 0; p < lp.pts.length; p += 2) near = Math.min(near, capsule(lp.pts[p], lp.pts[p + 1]));
      lp.dist = Math.max(0, near);
      lp.delay = T.terrain + lp.dist / maxDist * T.terrainSpread + li * 30;
      lp.index = li % 2 === 1;
      terrain.push(lp);
    });
  });
  // The ripple crosses the rings in rippleRings ms, then speeds up to the far corner.
  var ringReach = -HALO[0] * 1.4, v0 = ringReach / T.rippleRings;
  var reach = Math.max(capsule(0, 0), capsule(W, 0), capsule(0, H), capsule(W, H), ringReach * 2) + 8 * u;
  var acc = Math.max(0, (reach - v0 * T.rippleDur) / (T.rippleDur * T.rippleDur));
  // The capsule around the word grown by d, as a path (for clipping the ripple).
  function capsulePath(path, d) {
    var R = hh + Math.max(0, d);
    path.moveTo(ca, cy0 + R);
    path.arc(ca, cy0, R, Math.PI / 2, Math.PI * 1.5);
    path.lineTo(cb, cy0 - R);
    path.arc(cb, cy0, R, -Math.PI / 2, Math.PI / 2);
    path.closePath();
    return path;
  }
  function crestAt(t) {
    var tau = Math.max(0, t - T.ripple);
    return v0 * tau + acc * tau * tau;
  }
  tf = null;

  // 5. Cartographic elevation labels on three rings, under the right of the word.
  var labels = [];
  [1, 2, 3].forEach(function (hi, li) {
    var lv = levels.filter(function (l) { return l.d === HALO[HALO.length - 1 - hi]; })[0];
    if (!lv) return;
    var tx = api.width * (0.62 + li * 0.1), best = null, bd = INF;
    lv.loops.forEach(function (lp) {
      for (var p = 0; p < lp.pts.length; p += 2) {
        var qx = lp.pts[p], qy = lp.pts[p + 1];
        if (qy < api.desc) continue;
        var dd = Math.abs(qx - tx) * 2 - qy;
        if (dd < bd) { bd = dd; best = [qx, qy]; }
      }
    });
    if (best) labels.push({ x: best[0], y: best[1], text: String((5 - hi) * 20), lv: lv });
  });

  // Stroke a loop, revealed from its start point in both directions.
  function strokeLoop(lp, p) {
    if (p <= 0) return;
    if (p >= 1) {
      ctx.setLineDash([]);
    } else {
      var half = lp.len * p / 2;
      ctx.setLineDash([half, lp.len - 2 * half, half]);
    }
    ctx.stroke(lp.path);
  }
  function reveal(lv, lp, t) { return ease.outCubic((t - lv.start - lp.delay) / T.draw); }

  function drawTerrain(t, colour, keep) {
    for (var k = 0; k < terrain.length; k++) {
      var lp = terrain[k];
      var tp = ease.outCubic((t - lp.delay) / (T.draw * 1.2));
      if (tp <= 0) continue;
      ctx.lineWidth = lp.index ? 0.9 : 0.6;
      ctx.strokeStyle = api.rgba(colour, (colour === "dim" ? (lp.index ? 0.42 : 0.3) : 0.75) * keep);
      strokeLoop(lp, tp);
    }
  }

  function frame(t) {
    var keep = 1 - api.out, wa = api.wordAlpha, k, li, lv;
    var engraved = 1 - ease.smooth((t - T.engrave) / T.engraveDur);
    var solid = t >= T.engrave + T.engraveDur;
    // The ripple: a crest running outward through the rings, which fade behind it.
    var rippling = t >= T.ripple, crest = crestAt(t);

    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Terrain, in screen space. Behind the ripple's crest it is gone; on the crest
    // it is lit in the accent.
    if (keep > 0 && crest < reach) {
      api.screenSpace();
      var band = 7 * u;
      ctx.save();
      if (rippling) {
        var beyond = capsulePath(new Path2D(), crest);
        beyond.rect(-10, -10, W + 20, H + 20);
        ctx.clip(beyond, "evenodd");
      }
      drawTerrain(t, "dim", keep);
      ctx.restore();
      if (rippling) {
        ctx.save();
        var ring = capsulePath(new Path2D(), crest);
        capsulePath(ring, crest - band);
        ctx.clip(ring, "evenodd");
        drawTerrain(t, "accent", keep);
        ctx.restore();
      }
    }

    api.wordSpace();

    // Halo rings.
    for (li = 0; li < levels.length; li++) {
      lv = levels[li];
      if (!lv.halo) continue;
      var depth = -lv.d / -HALO[0];                      // 0 near the word, 1 outermost
      var passed = rippling ? clamp01((crest + lv.d) / (2.5 * u)) : 0;
      var glow = rippling ? Math.exp(-Math.pow((crest + lv.d) / (1.8 * u), 2)) : 0;
      var alpha = (0.7 - 0.38 * depth) * (1 - passed) * keep;
      if (alpha > 0.003) {
        ctx.lineWidth = 0.9;
        ctx.strokeStyle = api.rgba("dim", alpha);
        for (k = 0; k < lv.loops.length; k++) strokeLoop(lv.loops[k], reveal(lv, lv.loops[k], t));
      }
      if (glow > 0.02 && keep > 0) {
        ctx.setLineDash([]);
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = api.rgba("accent", 0.7 * glow * keep);
        ctx.stroke(lv.fill);
      }
    }

    // Elevation labels sit on the rings, with the line knocked out behind them.
    if (labels.length) {
      ctx.setLineDash([]);
      var fpx = Math.max(8, Math.round(size * 0.072));
      ctx.font = api.mono(fpx);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (var q = 0; q < labels.length; q++) {
        var lb = labels[q];
        var appear = ease.outCubic((t - lb.lv.start - T.draw * 0.6) / 220);
        var gone = rippling ? clamp01((crest + lb.lv.d) / (2.5 * u)) : 0;
        var la = appear * (1 - gone) * keep;
        if (la <= 0.01) continue;
        var bw = ctx.measureText(lb.text).width + fpx * 0.7;
        ctx.globalAlpha = la;
        ctx.fillStyle = api.colors.bg;
        ctx.fillRect(lb.x - bw / 2, lb.y - fpx * 0.6, bw, fpx * 1.2);
        ctx.fillStyle = api.colors.dim;
        ctx.fillText(lb.text, lb.x, lb.y + 0.5);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
    }

    // Terraces fill from the spine of each stroke out to the edge; the real
    // text (same shape) fades in over them, under the engraving.
    if (!solid) {
      ctx.fillStyle = api.colors.fg;
      for (var ti = 0; ti < terraces.length; ti++) {
        var f = ease.outCubic((t - terraces[ti].fillAt) / T.fillDur);
        if (f <= 0) continue;
        ctx.globalAlpha = f * wa;
        ctx.fill(terraces[ti].fill, "evenodd");
      }
      ctx.globalAlpha = 1;
      if (t > T.engrave) {
        api.drawText((1 - engraved) * wa);
        api.wordSpace();
      }
    }

    // Outline and inner lines: ink on paper, then engraved into the fill.
    for (li = 0; li < levels.length; li++) {
      lv = levels[li];
      if (lv.halo) continue;
      if (lv.outline) {
        if (solid) continue;
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = api.rgba("fg", engraved * wa);
      } else {
        var under = terraces[terraces.indexOf(lv) + 1];
        var cover = ease.outCubic((t - under.fillAt) / T.fillDur);
        var ink = (1 - cover) * engraved, cut = cover * engraved;
        ctx.lineWidth = 1;
        if (ink > 0.01) {
          ctx.strokeStyle = api.rgba("fg", ink * wa);
          for (k = 0; k < lv.loops.length; k++) strokeLoop(lv.loops[k], reveal(lv, lv.loops[k], t));
        }
        if (cut <= 0.01) continue;
        ctx.strokeStyle = api.rgba("bg", cut * wa);
      }
      for (k = 0; k < lv.loops.length; k++) strokeLoop(lv.loops[k], reveal(lv, lv.loops[k], t));
    }
    ctx.setLineDash([]);

    if (solid) api.drawText(wa);
  }

  return { formed: T.formed, frame: frame, realText: true };
};
