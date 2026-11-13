/*!
 * StaffLoader - animated music-staff "analyzing" panel for Astrona
 *
 * While your Python backend is busy, this shows a staff where the notes of the
 * uploaded song scroll past a playhead, together with a label and a percentage.
 * The notes come from the user's own file: a light pitch detector (YIN) runs in
 * the browser for about half a second. It is a visual preview only. The real
 * analysis still comes from the backend.
 *
 * Usage:
 *   var loader = new StaffLoader('#staff-loader');
 *   loader.start(file);        // show panel + animation (does not block your fetch)
 *   loader.setProgress(40);    // optional: real progress 0-100
 *   loader.finish();           // go to 100% and fade out
 *   loader.fail('Message');    // error state
 */
(function (root) {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var VB_W = 900;
  var VB_H = 150;
  var STAFF_X0 = 14;
  var STAFF_X1 = 886;
  var LINE_GAP = 14;
  var BOTTOM_LINE_Y = 106;
  var BOTTOM_DIA = 30; // E4 sits on the bottom line of the treble staff
  var PLAYHEAD_X = 190;
  var CLIP_X = 100;
  var START_TX = 560;
  var NOTE_SLOT = 62;
  var MAX_DECODE_BYTES = 80 * 1024 * 1024;
  var uid = 0;

  var DEFAULT_LABELS = {
    title: 'Analyzing',
    fail: 'Analysis failed',
    phases: [
      { upTo: 15, text: 'Reading the audio' },
      { upTo: 40, text: 'Detecting pitches' },
      { upTo: 65, text: 'Extracting rhythm' },
      { upTo: 85, text: 'Finding key and tempo' },
      { upTo: 100, text: 'Preparing your results' }
    ]
  };

  function mergeOptions(o) {
    o = o || {};
    var l = o.labels || {};
    return {
      labels: {
        title: l.title || DEFAULT_LABELS.title,
        fail: l.fail || DEFAULT_LABELS.fail,
        phases: l.phases || DEFAULT_LABELS.phases
      },
      noteCount: o.noteCount || 72,
      speed: o.speed || 130,
      autoProgress: o.autoProgress !== false,
      autoCap: o.autoCap || 92,
      autoDuration: o.autoDuration || 90000,
      onNote: o.onNote || null,
      onDone: o.onDone || null
    };
  }

  /* ------------------------------------------------------------------ */
  /* Pitch detection                                                     */
  /* ------------------------------------------------------------------ */

  // YIN pitch detector. Returns frequency in Hz or -1.
  function yin(buf, sampleRate) {
    var N = buf.length;
    var half = N >> 1;
    var tauMin = Math.max(2, Math.floor(sampleRate / 1100));
    var tauMax = Math.min(half - 1, Math.floor(sampleRate / 80));
    var d = new Float32Array(tauMax + 1);
    var tau, j, sum, diff;
    for (tau = 1; tau <= tauMax; tau++) {
      sum = 0;
      for (j = 0; j < half; j++) {
        diff = buf[j] - buf[j + tau];
        sum += diff * diff;
      }
      d[tau] = sum;
    }
    var cm = new Float32Array(tauMax + 1);
    var run = 0;
    cm[0] = 1;
    for (tau = 1; tau <= tauMax; tau++) {
      run += d[tau];
      cm[tau] = run === 0 ? 1 : (d[tau] * tau) / run;
    }
    var est = -1;
    for (tau = tauMin; tau <= tauMax; tau++) {
      if (cm[tau] < 0.15) {
        while (tau + 1 <= tauMax && cm[tau + 1] < cm[tau]) tau++;
        est = tau;
        break;
      }
    }
    if (est === -1) {
      var best = tauMin;
      for (tau = tauMin + 1; tau <= tauMax; tau++) if (cm[tau] < cm[best]) best = tau;
      if (cm[best] > 0.4) return -1;
      est = best;
    }
    var t = est;
    if (est > 1 && est < tauMax) {
      var s0 = cm[est - 1], s1 = cm[est], s2 = cm[est + 1];
      var den = 2 * (s0 - 2 * s1 + s2);
      if (den !== 0) t = est + (s0 - s2) / den;
    }
    return sampleRate / t;
  }

  function readFrame(ch0, ch1, pos, k, size, out) {
    var i, j, s, base;
    var div = ch1 ? 2 * k : k;
    for (i = 0; i < size; i++) {
      s = 0;
      base = pos + i * k;
      for (j = 0; j < k; j++) {
        s += ch0[base + j];
        if (ch1) s += ch1[base + j];
      }
      out[i] = s / div;
    }
  }

  function rmsOf(buf) {
    var s = 0, i;
    for (i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    return Math.sqrt(s / buf.length);
  }

  // Samples `count` evenly spaced windows across the song and detects a pitch in each.
  function sampleNotes(ch0, ch1, sr, count) {
    var k = Math.max(1, Math.round(sr / 22050));
    var dsr = sr / k;
    var FRAME = 2048;
    var span = FRAME * k;
    var total = ch0.length;
    if (total < span * 2) return Promise.resolve([]);
    var buf = new Float32Array(FRAME);
    var start = Math.floor(total * 0.04);
    var end = Math.floor(total * 0.96) - span;
    if (end <= start) { start = 0; end = total - span; }
    var jitters = [0, 0.12, 0.25, -0.12];
    var out = [];
    var i = 0;
    return new Promise(function (resolve) {
      function step() {
        var stop = Math.min(count, i + 6);
        for (; i < stop; i++) {
          var base = start + Math.floor(((end - start) * i) / Math.max(1, count - 1));
          for (var q = 0; q < jitters.length; q++) {
            var pos = Math.min(Math.max(0, base + Math.floor(jitters[q] * sr)), total - span);
            readFrame(ch0, ch1, pos, k, FRAME, buf);
            var rms = rmsOf(buf);
            if (rms < 0.004) continue;
            var f = yin(buf, dsr);
            if (f > 0) {
              out.push({ midi: 69 + 12 * Math.log2(f / 440), energy: rms });
              break;
            }
          }
        }
        if (i < count) setTimeout(step, 0);
        else resolve(out);
      }
      step();
    });
  }

  function finalize(raw) {
    var e = raw.map(function (n) { return n.energy; }).sort(function (a, b) { return a - b; });
    var median = e[Math.floor(e.length / 2)] || 0;
    return raw.map(function (n) {
      return { midi: n.midi, filled: n.energy >= median * 0.8 };
    });
  }

  function hashStr(s) {
    var h = 2166136261, i;
    for (i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Used when the file can't be decoded or is too big: a pleasant melody seeded by the file.
  function fallbackNotes(file, count) {
    var seed = hashStr(((file && file.name) || 'astrona') + ':' + ((file && file.size) || 0));
    var rnd = mulberry32(seed);
    var scale = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81];
    var idx = Math.floor(rnd() * scale.length);
    var out = [];
    for (var i = 0; i < count; i++) {
      idx += Math.floor(rnd() * 5) - 2;
      idx = Math.max(0, Math.min(scale.length - 1, idx));
      out.push({ midi: scale[idx], filled: rnd() > 0.28 });
    }
    return out;
  }

  function extractNotes(file, count) {
    var OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    if (!OAC || !file || !file.arrayBuffer || file.size > MAX_DECODE_BYTES) {
      return Promise.resolve(fallbackNotes(file, count));
    }
    return file.arrayBuffer()
      .then(function (arr) {
        var ctx = new OAC(1, 1, 44100);
        return new Promise(function (res, rej) {
          var p = ctx.decodeAudioData(arr, res, rej);
          if (p && p.then) p.then(res, rej);
        });
      })
      .then(function (audio) {
        var ch0 = audio.getChannelData(0);
        var ch1 = audio.numberOfChannels > 1 ? audio.getChannelData(1) : null;
        return sampleNotes(ch0, ch1, audio.sampleRate, count);
      })
      .then(function (raw) {
        return raw.length < 8 ? fallbackNotes(file, count) : finalize(raw);
      })
      .catch(function () { return fallbackNotes(file, count); });
  }

  /* ------------------------------------------------------------------ */
  /* Staff geometry                                                      */
  /* ------------------------------------------------------------------ */

  var PC_STEP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
  var PC_SHARP = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];

  function foldMidi(m) {
    while (m > 81) m -= 12; // A5 is the highest note we draw
    while (m < 60) m += 12; // C4 is the lowest
    return m;
  }

  function diaToY(dia) {
    return BOTTOM_LINE_Y - (dia - BOTTOM_DIA) * (LINE_GAP / 2);
  }

  function midiToStaff(midi) {
    var m = foldMidi(Math.round(midi));
    var pc = m % 12;
    var oct = Math.floor(m / 12) - 1;
    var dia = oct * 7 + PC_STEP[pc];
    return { midi: m, dia: dia, sharp: !!PC_SHARP[pc], y: diaToY(dia) };
  }

  function svgEl(name, attrs, parent) {
    var e = document.createElementNS(SVG_NS, name);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
    }
    if (parent) parent.appendChild(e);
    return e;
  }

  function drawSharp(parent, x, y) {
    var g = svgEl('g', { 'class': 'acc' }, parent);
    svgEl('line', { x1: x - 3, y1: y - 9, x2: x - 3, y2: y + 10, 'stroke-width': 1.3 }, g);
    svgEl('line', { x1: x + 3, y1: y - 10, x2: x + 3, y2: y + 9, 'stroke-width': 1.3 }, g);
    svgEl('line', { x1: x - 7, y1: y - 2.5, x2: x + 7, y2: y - 5, 'stroke-width': 2.6 }, g);
    svgEl('line', { x1: x - 7, y1: y + 5.5, x2: x + 7, y2: y + 3, 'stroke-width': 2.6 }, g);
  }

  function drawNote(parent, note, cx) {
    var s = midiToStaff(note.midi);
    var hue = Math.round(268 - ((s.midi - 60) / 21) * 95);
    var g = svgEl('g', { 'class': 'sl-note', style: '--h:' + hue }, parent);
    var d;
    for (d = 28; d >= s.dia; d -= 2) {
      svgEl('line', { x1: cx - 13, y1: diaToY(d), x2: cx + 13, y2: diaToY(d), 'class': 'ledger' }, g);
    }
    for (d = 40; d <= s.dia; d += 2) {
      svgEl('line', { x1: cx - 13, y1: diaToY(d), x2: cx + 13, y2: diaToY(d), 'class': 'ledger' }, g);
    }
    if (s.sharp) drawSharp(g, cx - 20, s.y);
    var stemUp = s.dia < 34; // B4 (middle line) and above: stem down
    if (stemUp) {
      svgEl('line', { x1: cx + 6.6, y1: s.y - 1, x2: cx + 6.6, y2: s.y - 46, 'class': 'stem' }, g);
    } else {
      svgEl('line', { x1: cx - 6.6, y1: s.y + 1, x2: cx - 6.6, y2: s.y + 46, 'class': 'stem' }, g);
    }
    svgEl('ellipse', {
      cx: cx, cy: s.y, rx: 7.4, ry: 5.4,
      transform: 'rotate(-20 ' + cx + ' ' + s.y + ')',
      'class': 'head ' + (note.filled ? 'fill' : 'hollow')
    }, g);
    return g;
  }

  /* ------------------------------------------------------------------ */
  /* The component                                                       */
  /* ------------------------------------------------------------------ */

  function StaffLoader(target, options) {
    this.container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!this.container) throw new Error('StaffLoader: container not found');
    this.opts = mergeOptions(options);
    this.speed = this.opts.speed;
    if (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.speed *= 0.3;
    }
    this.raf = 0;
    this.leaveTimer = 0;
    this.hideTimer = 0;
    this.token = 0;
    this.running = false;
    this.items = [];
    this.seqW = 0;
    this.tx = START_TX;
    this._tick = this._tick.bind(this);
    this._build();
    this.container.classList.add('sl-root', 'sl-hidden');
  }

  StaffLoader.prototype._build = function () {
    var c = this.container;
    c.innerHTML = '';
    var panel = document.createElement('div');
    panel.className = 'sl-panel';
    panel.setAttribute('role', 'status');
    panel.setAttribute('aria-live', 'polite');
    panel.innerHTML =
      '<div class="sl-head">' +
        '<div class="sl-title"><span class="sl-pulse"></span>' +
        '<span class="sl-title-text"></span>' +
        '<span class="sl-ellipsis" aria-hidden="true"><i></i><i></i><i></i></span></div>' +
        '<div class="sl-percent">0%</div>' +
      '</div>' +
      '<div class="sl-stage" dir="ltr"></div>' +
      '<div class="sl-bar"><div class="sl-bar-fill"></div></div>' +
      '<div class="sl-foot"><span class="sl-phase"></span><span class="sl-file"></span></div>';
    c.appendChild(panel);
    this.panel = panel;
    this.titleEl = panel.querySelector('.sl-title-text');
    this.percentEl = panel.querySelector('.sl-percent');
    this.fillEl = panel.querySelector('.sl-bar-fill');
    this.phaseEl = panel.querySelector('.sl-phase');
    this.fileEl = panel.querySelector('.sl-file');
    this._buildSvg(panel.querySelector('.sl-stage'));
  };

  StaffLoader.prototype._buildSvg = function (stage) {
    var id = 'sl' + (++uid);
    var svg = svgEl('svg', {
      viewBox: '0 0 ' + VB_W + ' ' + VB_H,
      preserveAspectRatio: 'xMidYMid meet',
      'class': 'sl-svg',
      'aria-hidden': 'true'
    });
    var defs = svgEl('defs', {}, svg);

    var fade = svgEl('linearGradient', {
      id: id + '-fade', gradientUnits: 'userSpaceOnUse', x1: CLIP_X, y1: 0, x2: VB_W, y2: 0
    }, defs);
    svgEl('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0 }, fade);
    svgEl('stop', { offset: 0.07, 'stop-color': '#fff', 'stop-opacity': 1 }, fade);
    svgEl('stop', { offset: 0.93, 'stop-color': '#fff', 'stop-opacity': 1 }, fade);
    svgEl('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 }, fade);
    var mask = svgEl('mask', {
      id: id + '-mask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: VB_W, height: VB_H
    }, defs);
    svgEl('rect', { x: CLIP_X, y: 0, width: VB_W - CLIP_X, height: VB_H, fill: 'url(#' + id + '-fade)' }, mask);

    var ph = svgEl('linearGradient', {
      id: id + '-ph', gradientUnits: 'userSpaceOnUse', x1: PLAYHEAD_X - 26, y1: 0, x2: PLAYHEAD_X + 26, y2: 0
    }, defs);
    svgEl('stop', { offset: 0, 'stop-color': 'currentColor', 'stop-opacity': 0 }, ph);
    svgEl('stop', { offset: 0.5, 'stop-color': 'currentColor', 'stop-opacity': 0.16 }, ph);
    svgEl('stop', { offset: 1, 'stop-color': 'currentColor', 'stop-opacity': 0 }, ph);

    var i, y;
    for (i = 0; i < 5; i++) {
      y = BOTTOM_LINE_Y - i * LINE_GAP;
      svgEl('line', { x1: STAFF_X0, y1: y, x2: STAFF_X1, y2: y, 'class': 'sl-line' }, svg);
    }
    svgEl('line', {
      x1: STAFF_X0, y1: BOTTOM_LINE_Y - 4 * LINE_GAP, x2: STAFF_X0, y2: BOTTOM_LINE_Y, 'class': 'sl-edge'
    }, svg);

    // Treble clef, drawn as one stroked path plus the dot at the tail.
    var clef = svgEl('g', { transform: 'translate(22 0)' }, svg);
    svgEl('path', {
      'class': 'sl-clef',
      d: 'M 36 91 C 33 87, 36 82, 41 82 C 47 82, 50 88, 47 94 C 43 102, 28 102, 25 90 ' +
         'C 22 76, 36 66, 43 52 C 49 40, 48 26, 41 22 C 36 20, 32 26, 34 36 L 37 118 ' +
         'C 38 128, 27 130, 26 122'
    }, clef);
    svgEl('circle', { 'class': 'sl-clef-dot', cx: 26.5, cy: 121, r: 2.6 }, clef);

    var masked = svgEl('g', { mask: 'url(#' + id + '-mask)' }, svg);
    this.world = svgEl('g', { 'class': 'sl-notes' }, masked);

    svgEl('rect', {
      x: PLAYHEAD_X - 26, y: 14, width: 52, height: 122, fill: 'url(#' + id + '-ph)', 'class': 'sl-playhead-glow'
    }, svg);
    svgEl('line', { x1: PLAYHEAD_X, y1: 20, x2: PLAYHEAD_X, y2: 132, 'class': 'sl-playhead' }, svg);
    svgEl('path', {
      d: 'M ' + (PLAYHEAD_X - 6) + ' 14 L ' + (PLAYHEAD_X + 6) + ' 14 L ' + PLAYHEAD_X + ' 22 Z',
      'class': 'sl-playhead-cap'
    }, svg);

    stage.appendChild(svg);
    this.svg = svg;
  };

  StaffLoader.prototype._setNotes = function (notes) {
    var world = this.world;
    while (world.firstChild) world.removeChild(world.firstChild);
    this.items = [];
    var layout = [];
    var x = 0, i;
    for (i = 0; i < notes.length; i++) {
      if (i > 0 && i % 4 === 0) {
        layout.push({ bar: x + 4 });
        x += 22;
      }
      layout.push({ note: notes[i], x: x + NOTE_SLOT / 2 });
      x += NOTE_SLOT;
    }
    layout.push({ bar: x + 4 });
    x += 22;
    var seqW = x;
    var copies = Math.ceil(VB_W / seqW) + 2;
    var barTop = BOTTOM_LINE_Y - 4 * LINE_GAP;
    for (var c = 0; c < copies; c++) {
      var g = svgEl('g', { transform: 'translate(' + c * seqW + ' 0)' }, world);
      for (i = 0; i < layout.length; i++) {
        var e = layout[i];
        if (e.bar !== undefined) {
          svgEl('line', { x1: e.bar, y1: barTop, x2: e.bar, y2: BOTTOM_LINE_Y, 'class': 'sl-bar-line' }, g);
        } else {
          this.items.push({ el: drawNote(g, e.note, e.x), x: c * seqW + e.x, state: 0, midi: e.note.midi });
        }
      }
    }
    this.seqW = seqW;
    this.tx = this.melody ? 230 : START_TX;
  };

  StaffLoader.prototype._clearTimers = function () {
    clearTimeout(this.leaveTimer);
    clearTimeout(this.hideTimer);
    this.leaveTimer = 0;
    this.hideTimer = 0;
  };

  StaffLoader.prototype.start = function (file, startOpts) {
    var self = this;
    this._clearTimers();
    var token = ++this.token;
    this.running = true;
    this.melody = !!(startOpts && startOpts.melody);
    this.failed = false;
    this.finishing = false;
    this.manual = false;
    this.manualTarget = 0;
    this.progress = 0;
    this.shown = -1;
    this.phaseIdx = -1;
    this.t0 = performance.now();

    this.container.classList.remove('sl-hidden');
    this.panel.classList.remove('is-leaving', 'is-error', 'is-ready');
    this.panel.classList.toggle('is-melody', this.melody);
    this.panel.style.animation = 'none';
    void this.panel.offsetWidth; // restart the entrance animation
    this.panel.style.animation = '';

    this.titleEl.textContent = this.opts.labels.title;
    this.fileEl.textContent = file && file.name ? file.name : '';
    this._setNotes([]);
    this._updateProgress(0);

    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this._tick);
    }

    return extractNotes(file, this.opts.noteCount).then(function (notes) {
      if (token !== self.token) return;
      self._setNotes(notes);
      self.panel.classList.add('is-ready');
    });
  };

  StaffLoader.prototype.setProgress = function (value) {
    if (!this.running || this.failed) return;
    var v = Math.max(0, Math.min(100, Number(value) || 0));
    this.manual = true;
    this.manualTarget = Math.max(this.manualTarget, v);
  };

  StaffLoader.prototype.finish = function () {
    if (!this.running || this.failed) return;
    this.finishing = true;
  };

  StaffLoader.prototype.fail = function (message) {
    if (!this.running) return;
    var self = this;
    this.failed = true;
    this.finishing = false;
    this.panel.classList.add('is-error');
    this.titleEl.textContent = message || this.opts.labels.fail;
    this.phaseEl.textContent = '';
    setTimeout(function () {
      if (self.failed && self.raf) {
        cancelAnimationFrame(self.raf);
        self.raf = 0;
      }
    }, 400);
  };

  StaffLoader.prototype.hide = function () {
    this.token++;
    this._clearTimers();
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    this.running = false;
    this.container.classList.add('sl-hidden');
  };

  StaffLoader.prototype._updateProgress = function (p) {
    var shown = Math.floor(p + 0.0001);
    if (shown !== this.shown) {
      this.shown = shown;
      this.percentEl.textContent = shown + '%';
    }
    this.fillEl.style.transform = 'scaleX(' + (p / 100).toFixed(4) + ')';
    var ph = this.opts.labels.phases;
    var i;
    for (i = 0; i < ph.length; i++) if (p <= ph[i].upTo) break;
    if (i >= ph.length) i = ph.length - 1;
    if (ph.length && i !== this.phaseIdx && !this.failed) {
      this.phaseIdx = i;
      this.phaseEl.textContent = ph[i].text;
    }
  };

  StaffLoader.prototype._tick = function (now) {
    var self = this;
    this.raf = requestAnimationFrame(this._tick);
    var dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;

    // Scroll the notes and light up the ones crossing the playhead.
    if (this.seqW && this.items.length) {
      this.tx -= this.speed * dt * (this.melody ? (this.playing ? 1 : 0.12) : 1);
      if (this.tx <= -this.seqW) this.tx += this.seqW;
      this.world.setAttribute('transform', 'translate(' + this.tx.toFixed(2) + ' 0)');
      for (var i = 0; i < this.items.length; i++) {
        var it = this.items[i];
        var sx = it.x + this.tx;
        var st = sx < PLAYHEAD_X - 16 ? 2 : (sx < PLAYHEAD_X + 16 ? 1 : 0);
        if (st !== it.state) {
          it.state = st;
          if (st === 1 && this.opts.onNote && !this.melody) this.opts.onNote({ midi: it.midi });
          it.el.setAttribute('class', 'sl-note' + (st === 1 ? ' is-active' : '') + (st === 2 ? ' is-done' : ''));
        }
      }
    }

    // Progress: real value if provided, otherwise a simulated one that slows down near the cap.
    if (!this.failed && !this.melody) {
      var target = 0;
      if (this.finishing) target = 100;
      else if (this.manual) target = this.manualTarget;
      else if (this.opts.autoProgress) {
        target = this.opts.autoCap * (1 - Math.exp(-(now - this.t0) / (this.opts.autoDuration / 3)));
      }
      if (target > this.progress) {
        this.progress += (target - this.progress) * Math.min(1, dt * (this.finishing ? 7 : 4));
      }
      if (this.finishing && this.progress > 99.4) this.progress = 100;
      this._updateProgress(this.progress);

      if (this.finishing && this.progress >= 100 && !this.leaveTimer) {
        this.leaveTimer = setTimeout(function () {
          self.panel.classList.add('is-leaving');
          self.hideTimer = setTimeout(function () {
            self.hide();
            if (typeof self.opts.onDone === 'function') self.opts.onDone();
          }, 450);
        }, 600);
      }
    }
  };

  StaffLoader.prototype.setPlaying = function (on) { this.playing = !!on; };

  StaffLoader.version = '1.1.0';
  StaffLoader._internals = {
    yin: yin,
    midiToStaff: midiToStaff,
    sampleNotes: sampleNotes,
    fallbackNotes: fallbackNotes
  };

  root.StaffLoader = StaffLoader;
  if (typeof module !== 'undefined' && module.exports) module.exports = StaffLoader;
})(typeof window !== 'undefined' ? window : globalThis);
