/* Astrona deep-space background (ax-space.js)
   Draws behind the page: a soft color wash that follows the music, plus meteors, a pulsar and
   a black hole drifting past. Quiet when idle, livelier while a track is analyzed or playing.
   It reads AstronaFX (set by ax.js / app.js) and never touches the page content. */
(function () {
  'use strict';
  var FX = window.AstronaFX;
  if (!FX) return;

  var star = document.getElementById('starfield');
  var cv = document.createElement('canvas');
  cv.id = 'ax-space';
  cv.setAttribute('aria-hidden', 'true');
  var cs = star ? getComputedStyle(star) : null;
  var z = cs && cs.zIndex !== 'auto' ? cs.zIndex : '0';
  cv.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:' + z;
  if (star && star.parentNode) star.parentNode.insertBefore(cv, star.nextSibling);
  else document.body.insertBefore(cv, document.body.firstChild);

  var ctx = cv.getContext('2d'), W = 0, H = 0, dpr = 1;
  var lastW = 0, lastH = 0;
  function resize() {
    if (lastW && window.innerWidth === lastW && Math.abs(window.innerHeight - lastH) < 160) return; // address bar sliding on phones
    lastW = window.innerWidth; lastH = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var objs = [], hue = 250, kick = 0, kickSign = 1, beatAvg = 0, lastBeat = 0, washAmt = 0, last = performance.now();
  FX.smooth = 0; FX.flash = 0;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function has(type) { for (var i = 0; i < objs.length; i++) if (objs[i].t === type) return true; return false; }
  function count(type) { var n = 0; for (var i = 0; i < objs.length; i++) if (objs[i].t === type) n++; return n; }
  function targetHue() { return 200 + clamp((FX.bpm - 70) / 90, 0, 1) * 140; } // slow = blue, mid = violet, fast = pink

  function addMeteor() {
    var fromLeft = Math.random() < 0.5, th = rnd(2.15, 2.6), sp = rnd(520, 900) * (1 + FX.smooth), fromTop = Math.random() < 0.7;
    if (fromLeft) th = Math.PI - th;
    var x = fromTop ? (fromLeft ? rnd(-W * 0.1, W * 0.75) : rnd(W * 0.25, W * 1.1)) : (fromLeft ? -30 : W + 30);
    objs.push({ t: 'm', x: x, y: fromTop ? -30 : rnd(0, H * 0.5), vx: Math.cos(th) * sp, vy: Math.sin(th) * sp,
      len: rnd(90, 220), w: rnd(1.2, 2.4), hoff: rnd(-50, 70) });
  }
  function addPulsar() {
    var left = Math.random() < 0.5, low = Math.random() < 0.5;
    objs.push({ t: 'p', x: left ? rnd(W * 0.03, W * 0.07) : rnd(W * 0.93, W * 0.97), y: low ? rnd(H * 0.88, H * 0.94) : rnd(H * 0.14, H * 0.2), vx: 0, age: 0, life: rnd(10, 14), r: clamp(Math.min(W, H) / 40, 9, 16) });
  }
  function addHole() {
    var s = clamp(Math.min(W, H) / 800, 0.7, 1), R = rnd(44, 58) * s, dir = Math.random() < 0.5 ? 1 : -1;
    objs.push({ t: 'h', R: R, x: dir > 0 ? -R * 4 : W + R * 4, y: rnd(H * 0.18, H * 0.55), vx: dir * rnd(30, 48), age: 0, tilt: rnd(-0.3, -0.08), dir: dir, vis: 0, bits: (function(){var a=[],i;for(i=0;i<70;i++)a.push({r:rnd(1.25,3.4),ph:rnd(0,6.283),sz:rnd(0.6,1.8),c:Math.random()});return a;})() });
  }
  function addComet() {
    var dir = Math.random() < 0.5 ? 1 : -1;
    objs.push({ t: 'c', x: dir > 0 ? -80 : W + 80, y: rnd(H * 0.06, H * 0.45), vx: dir * rnd(70, 110), vy: rnd(14, 34), len: rnd(200, 280) });
  }
  FX.spawn = function (t) { if (t === 'meteor') addMeteor();  else if (t === 'hole') { addHole(); if (arguments[1] != null) { var h = objs[objs.length - 1]; h.x = arguments[1]; h.y = arguments[2]; h.age = 2; } } else if (t === 'comet') addComet(); };

  function onBeat() {
    kick = kickSign; kickSign = -kickSign;
    FX.flash = 1;
    if (count('m') < 16 && Math.random() < 0.6) addMeteor();
  }
  // Called by ax.js on every beat of the tempo grid: the colors jump right on the beat.
  // Every beat only sways the colors very gently (no flash).
  FX.soft = function () {
    if (reduced) return;
    hue = (hue + kickSign * 5 + 360) % 360; kickSign = -kickSign;
    FX.level = Math.max(FX.level, 0.15);
  };
  FX.hit = function () {
    FX.flash = 1;
    if (!reduced) {
      hue = (hue + kickSign * 30 + 360) % 360; kickSign = -kickSign;
      addMeteor();
    }
  };

  function drawFlash() {
    if (reduced || FX.flash < 0.02) return;
    var a = FX.flash * 0.07 * Math.min(1, washAmt * 2 + 0.3);
    ctx.fillStyle = 'hsla(' + hue.toFixed(0) + ',90%,58%,' + a.toFixed(3) + ')'; ctx.fillRect(0, 0, W, H);
  }
  function drawWash() {
    var a = washAmt * 0.07 + FX.smooth * 0.38 * (0.4 + washAmt * 0.6) + FX.flash * 0.04 * washAmt;
    a = Math.min(a, 0.42);
    if (a < 0.004) return;
    var R = Math.max(W, H) * 0.75;
    var g1 = ctx.createRadialGradient(W * 0.12, H * 0.08, 0, W * 0.12, H * 0.08, R);
    g1.addColorStop(0, 'hsla(' + hue.toFixed(0) + ',85%,55%,' + a.toFixed(3) + ')'); g1.addColorStop(1, 'hsla(' + hue.toFixed(0) + ',85%,55%,0)');
    ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
    var h2 = ((hue + 60) % 360).toFixed(0);
    var g2 = ctx.createRadialGradient(W * 0.92, H * 0.96, 0, W * 0.92, H * 0.96, R);
    g2.addColorStop(0, 'hsla(' + h2 + ',85%,55%,' + (a * 0.8).toFixed(3) + ')'); g2.addColorStop(1, 'hsla(' + h2 + ',85%,55%,0)');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
  }

  function drawMeteor(o) {
    var sp = Math.sqrt(o.vx * o.vx + o.vy * o.vy), ux = o.vx / sp, uy = o.vy / sp, tx = o.x - ux * o.len, ty = o.y - uy * o.len;
    var g = ctx.createLinearGradient(o.x, o.y, tx, ty);
    g.addColorStop(0, 'hsla(' + ((hue + 20 + o.hoff + 360) % 360).toFixed(0) + ',100%,92%,0.95)');
    g.addColorStop(0.25, 'hsla(' + ((hue + o.hoff + 360) % 360).toFixed(0) + ',95%,68%,0.55)');
    g.addColorStop(1, 'hsla(' + ((hue + o.hoff + 360) % 360).toFixed(0) + ',90%,60%,0)');
    ctx.strokeStyle = g; ctx.lineWidth = o.w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(o.x, o.y, o.w * 1.1, 0, 7); ctx.fill();
  }

  function envelope(age, life, fin, fout) { return Math.min(1, age / fin, (life - age) / fout) > 0 ? Math.min(1, age / fin, (life - age) / fout) : 0; }

  function drawPulsar(o) {
    var a = envelope(o.age, o.life, 1.5, 2);
    if (a <= 0) return;
    var ang = o.age * (FX.bpm / 60) * Math.PI, L = Math.min(W, H) * 0.28, r = o.r * (1 + FX.flash * 0.5);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(o.x, o.y);
    for (var k = 0; k < 2; k++) {
      ctx.save(); ctx.rotate(ang + k * Math.PI);
      var g = ctx.createLinearGradient(0, 0, L, 0);
      g.addColorStop(0, 'hsla(' + ((hue + 150) % 360).toFixed(0) + ',100%,85%,' + (0.38 * a).toFixed(3) + ')'); g.addColorStop(1, 'hsla(' + hue.toFixed(0) + ',100%,70%,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -2.2); ctx.lineTo(L, -0.4); ctx.lineTo(L, 0.4); ctx.lineTo(0, 2.2); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    var c = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 3);
    c.addColorStop(0, 'rgba(255,255,255,' + (0.95 * a).toFixed(3) + ')');
    c.addColorStop(0.25, 'hsla(' + ((hue + 150) % 360).toFixed(0) + ',100%,80%,' + (0.5 * a).toFixed(3) + ')');
    c.addColorStop(1, 'hsla(' + hue.toFixed(0) + ',100%,60%,0)');
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, r * 3, 0, 7); ctx.fill();
    ctx.restore();
  }

  function diskGrad(R, a) {
    var g = ctx.createLinearGradient(-R * 3.5, 0, R * 3.5, 0);
    g.addColorStop(0, 'hsla(18,95%,45%,' + (0.12 * a).toFixed(3) + ')');
    g.addColorStop(0.35, 'hsla(32,100%,62%,' + (0.55 * a).toFixed(3) + ')');
    g.addColorStop(0.5, 'hsla(40,100%,72%,' + (0.7 * a).toFixed(3) + ')');
    g.addColorStop(0.8, 'hsla(45,100%,92%,' + (0.98 * a).toFixed(3) + ')');
    g.addColorStop(1, 'hsla(40,100%,75%,' + (0.5 * a).toFixed(3) + ')');
    return g;
  }
  function drawBits(o, a, back) {
    var R = o.R, i, b, ang, x, y, front;
    for (i = 0; i < o.bits.length; i++) {
      b = o.bits[i]; ang = b.ph + o.age * 2.2 / Math.pow(b.r, 1.5);
      front = Math.sin(ang) > 0; if (front === back) continue;
      x = Math.cos(ang) * b.r * R * 1.05; y = Math.sin(ang) * b.r * R * 0.24;
      ctx.fillStyle = 'hsla(' + (36 + b.c * 14).toFixed(0) + ',100%,' + (70 + b.c * 25).toFixed(0) + '%,' + ((0.9 - (b.r - 1.2) * 0.2) * a).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(x, y, b.sz * (1 + (3.4 - b.r) * 0.25), 0, 7); ctx.fill();
    }
  }
  function drawHole(o) {
    var a = clamp(Math.min(o.x + o.R * 5, W + o.R * 5 - o.x) / (o.R * 6), 0, 1) * clamp(o.age / 1.5, 0, 1);
    if (a <= 0) return;
    var R = o.R * (1 + FX.flash * 0.05), x = o.x, y = o.y, hs = hue.toFixed(0), g;
    ctx.save(); ctx.translate(x, y); ctx.globalCompositeOperation = 'lighter';
    g = ctx.createRadialGradient(0, 0, R, 0, 0, R * 6);
    g.addColorStop(0, 'hsla(34,100%,55%,' + (0.2 * a).toFixed(3) + ')'); g.addColorStop(0.4, 'hsla(' + hs + ',90%,55%,' + (0.06 * a).toFixed(3) + ')'); g.addColorStop(1, 'hsla(' + hs + ',90%,55%,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 6, 0, 7); ctx.fill();
    ctx.rotate(o.tilt); ctx.lineCap = 'butt';
    ctx.strokeStyle = diskGrad(R, a); // far half of the disk (behind the hole)
    ctx.lineWidth = R * 0.3; ctx.beginPath(); ctx.ellipse(0, 0, R * 3.0, R * 0.26, 0, Math.PI, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = R * 0.2; ctx.beginPath(); ctx.ellipse(0, 0, R * 2.1, R * 0.18, 0, Math.PI, Math.PI * 2); ctx.stroke();
    drawBits(o, a, true);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill(); // event horizon
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = diskGrad(R, a); // light bent over the top and under the bottom
    ctx.lineWidth = R * 0.2; ctx.beginPath(); ctx.arc(0, 0, R * 1.2, Math.PI * 1.04, Math.PI * 1.96); ctx.stroke();
    ctx.lineWidth = R * 0.07; ctx.beginPath(); ctx.arc(0, 0, R * 1.12, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,245,225,' + (0.8 * a).toFixed(3) + ')'; ctx.lineWidth = 1.4; // photon ring
    ctx.beginPath(); ctx.arc(0, 0, R * 1.03, 0, 7); ctx.stroke();
    drawBits(o, a, false);
    ctx.strokeStyle = diskGrad(R, a); // near half of the disk, in front
    ctx.lineWidth = R * 0.3; ctx.beginPath(); ctx.ellipse(0, 0, R * 3.0, R * 0.26, 0, 0, Math.PI); ctx.stroke();
    ctx.lineWidth = R * 0.2; ctx.beginPath(); ctx.ellipse(0, 0, R * 2.1, R * 0.18, 0, 0, Math.PI); ctx.stroke();
    ctx.restore();
  }

  /* The black hole bends the hero text: words near it are pulled in, twisted and swallowed. */
  var TEXT_WARP = false; // set to true to let the black hole bend the hero text
  var words = [], wordsDirty = true, warped = false, origHTML = null, wrapped = false;
  var wrapSel = '.hero-inner .eyebrow, .hero-inner h1, .hero-inner .hero-sub';
  function wrapWords() {
    if (wrapped) return;
    var els = document.querySelectorAll(wrapSel); origHTML = []; words = [];
    for (var e = 0; e < els.length; e++) {
      origHTML.push(els[e].innerHTML);
      var walker = document.createTreeWalker(els[e], NodeFilter.SHOW_TEXT, null), nodes = [], n;
      while ((n = walker.nextNode())) if (n.nodeValue.trim()) nodes.push(n);
      nodes.forEach(function (t) {
        var parts = t.nodeValue.split(/(\s+)/), frag = document.createDocumentFragment();
        parts.forEach(function (p) {
          if (!p) return;
          if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
          var sp = document.createElement('span'); sp.textContent = p; sp.style.display = 'inline-block';
          frag.appendChild(sp); words.push({ el: sp, cx: 0, cy: 0 });
        });
        t.parentNode.replaceChild(frag, t);
      });
    }
    wrapped = true; wordsDirty = true;
  }
  function unwrapWords() {
    if (!wrapped) return;
    var els = document.querySelectorAll(wrapSel);
    for (var e = 0; e < els.length; e++) if (origHTML[e] != null) els[e].innerHTML = origHTML[e];
    words = []; wrapped = false; warped = false;
  }
  function measureWords() {
    var sy = window.pageYOffset || 0, sx = window.pageXOffset || 0;
    words.forEach(function (w) { w.el.style.transform = ''; });
    words.forEach(function (w) { var r = w.el.getBoundingClientRect(); w.cx = r.left + r.width / 2 + sx; w.cy = r.top + r.height / 2 + sy; });
    wordsDirty = false;
  }
  window.addEventListener('resize', function () { wordsDirty = true; });
  function warpText(hole) {
    if (!TEXT_WARP || !hole || hole.vis < 0.05) { unwrapWords(); return; }
    if (!wrapped) wrapWords();
    if (wordsDirty || !warped) measureWords();
    warped = true;
    var sx = window.pageXOffset || 0, sy = window.pageYOffset || 0, R = hole.R, reach = R * 6.5, hx = hole.x, hy = hole.y, k = clamp(hole.vis, 0, 1);
    words.forEach(function (w) {
      var px = w.cx - sx, py = w.cy - sy, dx = px - hx, dy = py - hy, d = Math.sqrt(dx * dx + dy * dy);
      if (d > reach || d < 0.001) { w.el.style.transform = ''; w.el.style.opacity = ''; return; }
      var s = Math.pow(1 - d / reach, 1.6) * k;
      var th = s * 1.9 * hole.dir, c = Math.cos(th), sn = Math.sin(th), nd = d * (1 - 0.6 * s);
      var ux = dx / d, uy = dy / d, nx = hx + (ux * c - uy * sn) * nd, ny = hy + (ux * sn + uy * c) * nd;
      var sc = Math.max(0.12, 1 - 0.85 * s), op = d < R * 1.15 ? 0 : clamp(1.25 - s * 1.5, 0, 1);
      w.el.style.transform = 'translate(' + (nx - px).toFixed(1) + 'px,' + (ny - py).toFixed(1) + 'px) rotate(' + (th * 57.3 + s * 40).toFixed(1) + 'deg) scale(' + sc.toFixed(3) + ',' + (sc * (1 + s * 0.8)).toFixed(3) + ')';
      w.el.style.opacity = op.toFixed(2);
    });
  }

  function drawComet(o) {
    var sp = Math.sqrt(o.vx * o.vx + o.vy * o.vy), ux = o.vx / sp, uy = o.vy / sp, nx = -uy, ny = ux, tx = o.x - ux * o.len, ty = o.y - uy * o.len;
    var hc = ((hue + 170) % 360).toFixed(0), hs = hue.toFixed(0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createLinearGradient(o.x, o.y, tx, ty);
    g.addColorStop(0, 'hsla(' + hc + ',100%,85%,0.5)'); g.addColorStop(1, 'hsla(' + hs + ',90%,60%,0)');
    ctx.fillStyle = g; ctx.beginPath();
    ctx.moveTo(o.x + nx * 4, o.y + ny * 4); ctx.lineTo(tx + nx * 24, ty + ny * 24); ctx.lineTo(tx - nx * 24, ty - ny * 24); ctx.lineTo(o.x - nx * 4, o.y - ny * 4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = g; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(tx + nx * 44, ty + ny * 44); ctx.stroke();
    var c = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, 15);
    c.addColorStop(0, 'rgba(255,255,255,0.95)'); c.addColorStop(0.3, 'hsla(' + hc + ',100%,80%,0.5)'); c.addColorStop(1, 'hsla(' + hs + ',100%,60%,0)');
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(o.x, o.y, 15, 0, 7); ctx.fill();
    ctx.restore();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    var active = !!(FX.playing || FX.analyzing), i, o;

    FX.level *= Math.pow(0.9, dt * 60);
    FX.flash *= Math.pow(0.95, dt * 60);
    FX.smooth += (FX.level - FX.smooth) * Math.min(1, dt * 5);
    washAmt += ((active ? 1 : 0) - washAmt) * Math.min(1, dt * 2);
    beatAvg += (FX.level - beatAvg) * Math.min(1, dt * 1.5);
    if (!reduced && active && !FX.gridActive && FX.level > beatAvg * 1.15 + 0.05 && now - lastBeat > 240) { lastBeat = now; onBeat(); }
    kick *= Math.pow(0.93, dt * 60);
    var swing = reduced ? 0 : kick * 70 * clamp(FX.smooth * 2, 0.3, 1);
    var tg = (targetHue() + swing + 360) % 360, d = ((tg - hue + 540) % 360) - 180;
    hue = (hue + d * Math.min(1, dt * 2.4) + 360) % 360;

    var rate = (active ? 0.35 + FX.smooth * 2.6 : 0.07) * (reduced ? 0.2 : 1);
    if (Math.random() < rate * dt && count('m') < 16) addMeteor();
    

    ctx.clearRect(0, 0, W, H);
    drawWash();
    drawFlash();
    for (i = objs.length - 1; i >= 0; i--) {
      o = objs[i];
      if (o.t === 'm') { o.x += o.vx * dt; o.y += o.vy * dt; if (o.x < -300 || o.x > W + 400 || o.y > H + 300) objs.splice(i, 1); }
      else if (o.t === 'p') { o.age += dt; o.x += o.vx * dt; if (o.age > o.life) objs.splice(i, 1); }
      else if (o.t === 'c') { o.x += o.vx * dt; o.y += o.vy * dt; if (o.x < -420 || o.x > W + 420 || o.y > H + 220) objs.splice(i, 1); }
      else { o.age += dt; o.x += o.vx * dt; if ((o.dir > 0 && o.x > W + o.R * 5) || (o.dir < 0 && o.x < -o.R * 5)) objs.splice(i, 1); }
    }
    var hh = null;
    for (i = 0; i < objs.length; i++) if (objs[i].t === 'h') { hh = objs[i]; hh.vis = clamp(Math.min(hh.x + hh.R * 5, W + hh.R * 5 - hh.x) / (hh.R * 6), 0, 1) * clamp(hh.age / 1.5, 0, 1); drawHole(hh); }
    warpText(reduced ? null : hh);
    for (i = 0; i < objs.length; i++) if (objs[i].t === 'p') drawPulsar(objs[i]);
    for (i = 0; i < objs.length; i++) if (objs[i].t === 'm') drawMeteor(objs[i]);
  }
  requestAnimationFrame(frame);
})();
