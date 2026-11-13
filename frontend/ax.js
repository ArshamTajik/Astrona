/* Astrona extras (ax.js): guest profile + history, badges, compare, player with chart cursors,
   share card (PNG), PDF report, QR, and a music-reactive background (AstronaFX). */
(function () {
  'use strict';

  /* ---------- helpers ---------- */
  var LS = {
    mem: {}, ok: true,
    get: function (k, d) { try { var v = localStorage.getItem(k); if (v) return JSON.parse(v); } catch (e) {} return Object.prototype.hasOwnProperty.call(LS.mem, k) ? LS.mem[k] : d; },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); delete LS.mem[k]; return true; } catch (e) { LS.ok = false; LS.mem[k] = v; return true; } },
    del: function (k) { delete LS.mem[k]; try { localStorage.removeItem(k); } catch (e) {} }
  };
  function $(s, r) { return (r || document).querySelector(s); }
  function h(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtTime(s) { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function hashStr(s) { var x = 2166136261, i; for (i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }
  function rng(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function siteUrl() { return location.origin && location.origin !== 'null' ? location.origin : 'https://astrona.ir'; }

  /* ---------- reactive background (read by app.js starfield / hero wave) ---------- */
  var FX = window.AstronaFX = {
    level: 0, smooth: 0, flash: 0, bpm: 110, playing: false, analyzing: false, rgb: [243, 241, 255],
    pulse: function (v) { FX.level = clamp(FX.level + v, 0, 1); },
    tint: function (bpm) {
      FX.bpm = bpm || 110;
      var t = clamp((bpm - 70) / 90, 0, 1), cool = [150, 225, 255], mid = [205, 190, 255], warm = [255, 190, 150], a, b, k;
      if (t < 0.5) { a = cool; b = mid; k = t / 0.5; } else { a = mid; b = warm; k = (t - 0.5) / 0.5; }
      FX.rgb = [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * k); });
    }
  };

  /* ---------- profile + history ---------- */
  var ADJ = ['Cosmic', 'Lunar', 'Stellar', 'Nebula', 'Orbital', 'Solar', 'Quantum', 'Astral', 'Velvet', 'Neon', 'Silent', 'Golden'];
  var NOUN = ['Falcon', 'Comet', 'Voyager', 'Pulsar', 'Echo', 'Nomad', 'Drifter', 'Sparrow', 'Lynx', 'Otter', 'Wave', 'Signal'];
  var user = LS.get('ax.user', null);
  if (!user || !user.name) {
    user = { name: ADJ[Math.floor(Math.random() * ADJ.length)] + ' ' + NOUN[Math.floor(Math.random() * NOUN.length)], hue: Math.floor(Math.random() * 360) };
    LS.set('ax.user', user);
  }
  var hist = LS.get('ax.hist', []);
  var flags = LS.get('ax.flags', {});
  var unlocked = LS.get('ax.badges', {});
  var FULL_KEEP = 8, HIST_MAX = 30;

  function saveHist() {
    if (!LS.set('ax.hist', hist) && !saveHist.warned) { saveHist.warned = true; setTimeout(function () { toast('History cannot be saved in this browser mode.'); }, 1500); }
  }
  function storeFull(id, data) {
    var tries = 0;
    while (!LS.set('ax.full.' + id, data) && tries++ < 8) {
      var old = hist.filter(function (x) { return x.full && x.id !== id; }).pop();
      if (!old) return false;
      LS.del('ax.full.' + old.id); old.full = false;
    }
    return tries < 8;
  }
  function addHistory(data, file) {
    var m = data.metrics || {}, d = data.distortion || {};
    var item = {
      id: Date.now().toString(36), name: data.filename || (file && file.name) || 'Untitled', ts: Date.now(),
      bpm: data.bpm && data.bpm.bpm, key: data.key && data.key.label,
      dur: m.duration_sec, avg: m.average_loudness_db, peak: m.peak_db, clip: d.clipped_percent || 0, full: false
    };
    hist.unshift(item);
    item.full = storeFull(item.id, data);
    hist.slice(FULL_KEEP).forEach(function (x) { if (x.full) { LS.del('ax.full.' + x.id); x.full = false; } });
    while (hist.length > HIST_MAX) { var r = hist.pop(); LS.del('ax.full.' + r.id); }
    saveHist();
    return item;
  }
  function xpInfo() {
    var xp = hist.length * 10 + Object.keys(unlocked).length * 20;
    return { xp: xp, level: 1 + Math.floor(xp / 60), pct: (xp % 60) / 60 * 100 };
  }

  /* ---------- badges ---------- */
  var BADGES = [
    { id: 'first', g: '♪', n: 'First Signal', d: 'Analyze your first track', t: function () { return hist.length >= 1; } },
    { id: 'five', g: '✦', n: 'Regular', d: 'Analyze 5 tracks', t: function () { return hist.length >= 5; } },
    { id: 'ten', g: '◆', n: 'Deep Listener', d: 'Analyze 10 tracks', t: function () { return hist.length >= 10; } },
    { id: 'tw', g: '★', n: 'Observatory', d: 'Analyze 25 tracks', t: function () { return hist.length >= 25; } },
    { id: 'minor', g: '☾', n: 'Minor Mood', d: 'Find a track in a minor key', t: function () { return hist.some(function (x) { return /minor|^[A-G][#b♯♭]?m$/i.test(String(x.key || '').trim()); }); } },
    { id: 'major', g: '☀', n: 'Major Mood', d: 'Find a track in a major key', t: function () { return hist.some(function (x) { return /major|^[A-G][#b♯♭]?$/i.test(String(x.key || '').trim()); }); } },
    { id: 'fast', g: '⚡', n: 'Speed Demon', d: 'A track at 140 BPM or faster', t: function () { return hist.some(function (x) { return x.bpm >= 140; }); } },
    { id: 'slow', g: '◑', n: 'Slow Burn', d: 'A track at 80 BPM or slower', t: function () { return hist.some(function (x) { return x.bpm && x.bpm <= 80; }); } },
    { id: 'clean', g: '◎', n: 'Clean Master', d: 'A track with no clipping', t: function () { return hist.some(function (x) { return x.clip === 0; }); } },
    { id: 'hot', g: '✶', n: 'Too Hot', d: 'Find a track that clips', t: function () { return hist.some(function (x) { return x.clip > 0; }); } },
    { id: 'long', g: '∞', n: 'Long Player', d: 'Analyze a track over 5 minutes', t: function () { return hist.some(function (x) { return x.dur >= 300; }); } },
    { id: 'owl', g: '☆', n: 'Night Owl', d: 'Analyze between midnight and 5am', t: function () { return hist.some(function (x) { var hr = new Date(x.ts).getHours(); return hr < 5; }); } },
    { id: 'cmp', g: '⇄', n: 'Side by Side', d: 'Compare two tracks', t: function () { return !!flags.compared; } },
    { id: 'share', g: '↗', n: 'Signal Sender', d: 'Share or export a result', t: function () { return !!flags.shared; } }
  ];
  function checkBadges(announce) {
    var fresh = [];
    BADGES.forEach(function (b) { if (!unlocked[b.id] && b.t()) { unlocked[b.id] = Date.now(); fresh.push(b); } });
    if (fresh.length) {
      LS.set('ax.badges', unlocked);
      if (announce) fresh.forEach(function (b, i) { setTimeout(function () { toast('Badge unlocked: ' + b.n); }, 900 + i * 2600); });
    }
    refreshBar();
  }
  function setFlag(k) { if (!flags[k]) { flags[k] = true; LS.set('ax.flags', flags); checkBadges(true); } }

  /* ---------- top bar ---------- */
  var bar, nameEl, avatarEl, lvlEl, histCount;
  function initials(n) { return n.split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join(''); }
  function buildBar() {
    bar = h('header', 'ax-bar');
    var u = h('div', 'ax-user');
    avatarEl = h('div', 'ax-avatar');
    var who = h('div', 'ax-who');
    nameEl = h('button', 'ax-name'); nameEl.type = 'button'; nameEl.title = 'Click to rename';
    lvlEl = h('div', 'ax-lvl');
    who.appendChild(nameEl); who.appendChild(lvlEl);
    u.appendChild(avatarEl); u.appendChild(who);
    var act = h('div', 'ax-actions');
    var bh = h('button', 'ax-btn', 'History<span class="ax-count">0</span>'); bh.type = 'button';
    var bb = h('button', 'ax-btn', 'Badges'); bb.type = 'button';
    histCount = $('.ax-count', bh);
    act.appendChild(bh); act.appendChild(bb);
    bar.appendChild(u); bar.appendChild(act);
    document.body.insertBefore(bar, document.body.firstChild);
    document.body.classList.add('ax-on');
    nameEl.addEventListener('click', rename);
    bh.addEventListener('click', openHistory);
    bb.addEventListener('click', openBadges);
    refreshBar();
  }
  function refreshBar() {
    if (!bar) return;
    nameEl.textContent = user.name;
    avatarEl.textContent = initials(user.name);
    avatarEl.style.background = 'linear-gradient(135deg, hsl(' + user.hue + ' 85% 70%), hsl(' + ((user.hue + 70) % 360) + ' 85% 60%))';
    var x = xpInfo();
    lvlEl.innerHTML = 'Lv ' + x.level + '<i><b style="width:' + x.pct.toFixed(0) + '%"></b></i>';
    histCount.textContent = hist.length;
  }
  function rename() {
    var inp = h('input', 'ax-name'); inp.value = user.name; inp.maxLength = 18; inp.setAttribute('aria-label', 'Your name');
    nameEl.replaceWith(inp); inp.focus(); inp.select();
    function done(save) {
      var v = inp.value.trim().slice(0, 18);
      if (save && v) { user.name = v; user.hue = hashStr(v) % 360; LS.set('ax.user', user); }
      inp.replaceWith(nameEl); refreshBar();
    }
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') done(true); else if (e.key === 'Escape') done(false); });
    inp.addEventListener('blur', function () { done(true); });
  }

  /* ---------- sheets / toast ---------- */
  var modal = null;
  function openSheet(title, body) {
    closeSheet();
    modal = h('div', 'ax-modal');
    var sheet = h('div', 'ax-sheet'); sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', title);
    var head = h('div', 'ax-sheet-head', '<h3>' + esc(title) + '</h3>');
    var x = h('button', 'ax-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close');
    head.appendChild(x); sheet.appendChild(head); sheet.appendChild(body); modal.appendChild(sheet);
    document.body.appendChild(modal);
    x.addEventListener('click', closeSheet);
    modal.addEventListener('mousedown', function (e) { if (e.target === modal) closeSheet(); });
    x.focus();
    return sheet;
  }
  function closeSheet() { if (modal) { modal.remove(); modal = null; } }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });
  function toast(msg) {
    var t = h('div', 'ax-toast'); t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2800);
  }

  /* ---------- history sheet ---------- */
  function openHistory() {
    var box = h('div');
    if (!hist.length) {
      box.appendChild(h('div', 'ax-empty', 'No tracks yet. Drop a song above and it will show up here.'));
    } else {
      var top = h('div', 'ax-row'); top.style.marginBottom = '12px';
      var cmp = h('button', 'ax-btn is-primary', 'Compare two tracks'); cmp.type = 'button';
      var clr = h('button', 'ax-btn', 'Clear history'); clr.type = 'button';
      top.appendChild(cmp); top.appendChild(clr); box.appendChild(top);
      var list = h('div', 'ax-list');
      hist.forEach(function (it) {
        var b = h('button', 'ax-item'); b.type = 'button'; b.disabled = !it.full;
        b.innerHTML = '<span class="ax-item-name">' + esc(it.name) + '</span>' +
          '<span class="ax-item-tag">' + (it.bpm ? Math.round(it.bpm) + ' BPM' : '') + '</span>' +
          '<span class="ax-item-meta">' + esc(it.key || '') + ' · ' + fmtTime(it.dur) + ' · ' + new Date(it.ts).toLocaleDateString() + (it.full ? '' : ' · summary only') + '</span>';
        b.addEventListener('click', function () { restore(it.id); });
        list.appendChild(b);
      });
      box.appendChild(list);
      cmp.addEventListener('click', openCompare);
      clr.addEventListener('click', function () {
        hist.forEach(function (x) { LS.del('ax.full.' + x.id); }); hist = []; saveHist(); refreshBar(); closeSheet(); toast('History cleared');
      });
    }
    box.appendChild(h('p', 'ax-hint', 'Astrona extras v1.2 \u00B7 history is saved ' + (LS.ok ? 'on this device' : 'for this visit only (your browser blocks storage)')));
    openSheet('Your history', box);
  }
  function restore(id) {
    var full = LS.get('ax.full.' + id, null), it = hist.filter(function (x) { return x.id === id; })[0];
    if (!full || !it) { toast('Details for this track are no longer stored.'); return; }
    closeSheet();
    var st = document.getElementById('status-line');
    if (st) { st.textContent = 'Showing saved result: ' + it.name; st.classList.remove('is-error'); }
    if (window.staffLoaderHide) window.staffLoaderHide();
    window.renderResults(full);
    FX.tint(it.bpm || 110);
    buildTools(full, null);
  }

  /* ---------- badges sheet ---------- */
  function openBadges() {
    var x = xpInfo(), box = h('div');
    box.appendChild(h('p', 'ax-hint', 'Level ' + x.level + ' · ' + Object.keys(unlocked).length + ' of ' + BADGES.length + ' badges. Analyze more tracks to level up.'));
    var grid = h('div', 'ax-badges'); grid.style.marginTop = '12px';
    BADGES.forEach(function (b) {
      var on = !!unlocked[b.id];
      grid.appendChild(h('div', 'ax-badge' + (on ? '' : ' locked'), '<div class="g">' + b.g + '</div><b>' + esc(b.n) + '</b><span>' + esc(b.d) + '</span>'));
    });
    box.appendChild(grid);
    openSheet('Badges', box);
  }

  /* ---------- compare ---------- */
  function openCompare() {
    var full = hist.filter(function (x) { return x.full; });
    if (full.length < 2) { toast('Analyze at least two tracks to compare them.'); return; }
    var box = h('div'), pick = h('div', 'ax-compare-pick'), selA = h('select', 'ax-select'), selB = h('select', 'ax-select');
    selA.setAttribute('aria-label', 'Track A'); selB.setAttribute('aria-label', 'Track B');
    full.forEach(function (x, i) {
      var label = x.name + ' — ' + (x.bpm ? Math.round(x.bpm) + ' BPM' : '') + ' ' + (x.key || '');
      selA.appendChild(new Option(label, x.id, false, i === 0));
      selB.appendChild(new Option(label, x.id, false, i === 1));
    });
    pick.appendChild(selA); pick.appendChild(selB);
    var out = h('div'); box.appendChild(pick); box.appendChild(out);
    function draw() { renderCompare(out, selA.value, selB.value); }
    selA.addEventListener('change', draw); selB.addEventListener('change', draw);
    openSheet('Compare tracks', box); draw(); setFlag('compared');
  }
  var CMP = [
    ['Tempo', function (d) { return d.bpm.bpm; }, function (v) { return v.toFixed(1) + ' BPM'; }, null],
    ['Key', function (d) { return d.key.label; }, function (v) { return v; }, null],
    ['Duration', function (d) { return d.metrics.duration_sec; }, function (v) { return fmtTime(v); }, null],
    ['Avg loudness', function (d) { return d.metrics.average_loudness_db; }, function (v) { return v.toFixed(1) + ' dB'; }, 1],
    ['Peak level', function (d) { return d.metrics.peak_db; }, function (v) { return v.toFixed(1) + ' dB'; }, 1],
    ['Brightness', function (d) { return d.metrics.brightness_mean_hz; }, function (v) { return Math.round(v).toLocaleString() + ' Hz'; }, 1],
    ['Beat strength', function (d) { return d.metrics.beat_strength_mean; }, function (v) { return v.toFixed(3); }, 1],
    ['Clipped', function (d) { return (d.distortion && d.distortion.clipped_percent) || 0; }, function (v) { return v + '%'; }, -1]
  ];
  function renderCompare(out, idA, idB) {
    var A = LS.get('ax.full.' + idA, null), B = LS.get('ax.full.' + idB, null);
    out.innerHTML = '';
    if (!A || !B) { out.appendChild(h('div', 'ax-empty', 'Saved details are missing for one of these tracks.')); return; }
    var t = '<table class="ax-table"><tr><th></th><th>A</th><th>B</th></tr>';
    CMP.forEach(function (r) {
      var a = r[1](A), b = r[1](B), wa = '', wb = '';
      if (r[3] && a !== b) { var better = (a > b ? 1 : -1) * r[3]; if (better > 0) wa = ' win'; else wb = ' win'; }
      t += '<tr><th>' + r[0] + '</th><td class="a' + wa + '">' + esc(r[2](a)) + '</td><td class="b' + wb + '">' + esc(r[2](b)) + '</td></tr>';
    });
    out.appendChild(h('div', 'ax-legend', '<span><i style="background:#b6a6ff"></i>A — ' + esc(A.filename || '') + '</span><span><i style="background:#35e7d7"></i>B — ' + esc(B.filename || '') + '</span>'));
    var cv = h('canvas', 'ax-canvas'); cv.width = 720; cv.height = 220; out.appendChild(cv);
    var tbl = h('div', null, t + '</table>'); tbl.style.marginTop = '14px'; out.appendChild(tbl);
    var sa = A.series.loudness_db.values, sb = B.series.loudness_db.values, ctx = cv.getContext('2d');
    var all = sa.concat(sb), mn = Math.min.apply(null, all), mx = Math.max.apply(null, all), rg = mx - mn || 1;
    ctx.fillStyle = '#12102f'; ctx.fillRect(0, 0, 720, 220);
    ctx.font = '11px "IBM Plex Mono", monospace'; ctx.fillStyle = '#8892b0'; ctx.fillText('Loudness over time (dB, normalized time)', 12, 16);
    [[sa, '#b6a6ff'], [sb, '#35e7d7']].forEach(function (p) {
      ctx.beginPath();
      p[0].forEach(function (v, i) { var x = 12 + (696 * i) / Math.max(1, p[0].length - 1), y = 28 + 180 - ((v - mn) / rg) * 180; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.strokeStyle = p[1]; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
    });
  }

  /* ---------- tools row: player, melody staff, share/pdf/compare ---------- */
  var audio = null, audioUrl = null, melody = null, raf = 0, actx = null, analyser = null, abuf = null, curData = null;
  var CURSORS = ['chart-rms', 'chart-db', 'chart-brightness', 'chart-beat', 'chroma-canvas'];

  function stopPlayer() {
    FX.playing = false;
    if (audio) { audio.pause(); audio = null; }
    if (audioUrl) { URL.revokeObjectURL(audioUrl); audioUrl = null; }
    if (melody) { melody.hide(); melody = null; }
    cancelAnimationFrame(raf); raf = 0;
    document.querySelectorAll('.ax-cursor').forEach(function (c) { c.remove(); });
  }
  window.staffLoaderHide = stopPlayer;

  function buildTools(data, file) {
    stopPlayer();
    curData = data;
    var old = $('.ax-tools'); if (old) old.remove();
    var anchor = $('#dashboard .filename-row'); if (!anchor) return;
    var tools = h('div', 'ax-tools'), row = h('div', 'ax-row');
    var bs = h('button', 'ax-btn is-primary', 'Share card'), bp = h('button', 'ax-btn', 'PDF report'), bc = h('button', 'ax-btn', 'Compare tracks');
    [bs, bp, bc].forEach(function (b) { b.type = 'button'; row.appendChild(b); });
    tools.appendChild(row);
    anchor.after(tools);
    bs.addEventListener('click', function () { openShare(data); });
    bp.addEventListener('click', function () { makeReportPdf(data); });
    bc.addEventListener('click', openCompare);

    if (file) {
      audioUrl = URL.createObjectURL(file);
      audio = new Audio(audioUrl); audio.preload = 'auto';
      var pl = h('div', 'ax-player'), play = h('button', 'ax-btn', 'Play'), seek = h('input', 'ax-seek'), tm = h('span', 'ax-time', '0:00');
      play.type = 'button'; seek.type = 'range'; seek.min = 0; seek.max = 1000; seek.value = 0; seek.setAttribute('aria-label', 'Seek');
      pl.appendChild(play); pl.appendChild(seek); pl.appendChild(tm); tools.appendChild(pl);
      var mel = h('div', 'ax-melody'); tools.appendChild(mel);
      if (window.StaffLoader) {
        melody = new StaffLoader(mel, { noteCount: 56, labels: { title: 'Your melody', phases: [] } });
        melody.start(file, { melody: true });
      }
      var dur = function () { return audio.duration && isFinite(audio.duration) ? audio.duration : (data.metrics.duration_sec || 1); };
      play.addEventListener('click', function () { if (audio.paused) { startAnalyser(); audio.play().catch(function () { toast('Could not play this file in the browser.'); }); } else audio.pause(); });
      audio.addEventListener('play', function () { FX.playing = true; play.textContent = 'Pause'; if (melody) melody.setPlaying(true); loop(); });
      audio.addEventListener('pause', function () { FX.playing = false; FX.gridActive = false; lastBi = null; lastT = null; play.textContent = 'Play'; if (melody) melody.setPlaying(false); update(); });
      audio.addEventListener('ended', function () { FX.playing = false; FX.gridActive = false; lastBi = null; lastT = null; play.textContent = 'Play'; if (melody) melody.setPlaying(false); update(); });
      seek.addEventListener('input', function () { audio.currentTime = (seek.value / 1000) * dur(); update(); });
      var update = function () {
        var t = audio.currentTime, d = dur();
        seek.value = Math.round((t / d) * 1000); tm.textContent = fmtTime(t) + ' / ' + fmtTime(d);
        moveCursors(t, data.metrics.duration_sec || d);
      };
      var lastBi = null, lastT = null;
      var loop = function () {
        update();
        if (!audio.paused) {
          var lv = 0;
          if (analyser) { analyser.getByteFrequencyData(abuf); var s = 0, n = 24, i; for (i = 0; i < n; i++) s += abuf[i]; lv = clamp((s / n / 255) * 1.15, 0, 0.85); }
          else lv = seriesLevel(data, audio.currentTime, dur());
          FX.level = Math.max(FX.level, lv);
          var g = data._grid === undefined ? (data._grid = beatGrid(data, data.metrics.duration_sec || dur())) : data._grid;
          if (g) { // exact beats from the tempo grid: the page flashes on every beat
            FX.gridActive = true;
            var bi = Math.floor((audio.currentTime - g.phase) / g.period);
            if (lastBi !== null && bi === lastBi + 1 && FX.soft) FX.soft();
            lastBi = bi;
          }
          // one strong flash only when the music really changes (kick/drums come in, a big section starts)
          var dr = data._drops === undefined ? (data._drops = dropPoints(data, data.metrics.duration_sec || dur())) : data._drops, ct = audio.currentTime;
          if (dr && lastT !== null && ct > lastT && ct - lastT < 1) dr.forEach(function (p) { if (lastT < p && p <= ct && FX.hit) FX.hit(); });
          lastT = ct;
        }
        if (!audio.paused) raf = requestAnimationFrame(loop);
      };
      update();
    }
  }
  // Energy from the analysis itself (beat + loudness at the current time). Used on phones, where routing audio through WebAudio can mute it.
  function seriesLevel(d, t, dur) {
    try {
      var out = 0;
      [[d.series.beat_strength, 1], [d.series.rms, 0.6]].forEach(function (p) {
        var v = p[0].values, n = v.length, k, i = clamp(Math.round((t / dur) * (n - 1)), 0, n - 1);
        if (!p[0]._mm) { var mn = Infinity, mx = -Infinity; for (k = 0; k < n; k++) { if (v[k] < mn) mn = v[k]; if (v[k] > mx) mx = v[k]; } p[0]._mm = [mn, mx]; }
        out = Math.max(out, ((v[i] - p[0]._mm[0]) / ((p[0]._mm[1] - p[0]._mm[0]) || 1)) * p[1]);
      });
      return clamp(out, 0, 0.85);
    } catch (e) { return 0; }
  }
  // Beat grid: the tempo plus the phase that lines up best with the track's beat strength.
  function beatGrid(d, duration) {
    try {
      var bpm = d.bpm && d.bpm.bpm; if (!bpm || bpm < 40 || bpm > 240 || !duration) return null;
      while (bpm > 170) bpm /= 2;
      var v = d.series.beat_strength.values, n = v.length; if (n < 8) return null;
      var period = 60 / bpm, steps = 32, best = -1, bestPh = 0, s, t, sum, cnt;
      for (s = 0; s < steps; s++) {
        var ph = period * s / steps; sum = 0; cnt = 0;
        for (t = ph; t < duration; t += period) { sum += v[Math.min(n - 1, Math.round(t / duration * (n - 1)))]; cnt++; }
        if (cnt && sum / cnt > best) { best = sum / cnt; bestPh = ph; }
      }
      return { period: period, phase: bestPh };
    } catch (e) { return null; }
  }
  // Moments where the energy jumps compared with the seconds before (an entrance, a drop). At least 8 s apart.
  function dropPoints(d, duration) {
    try {
      var v = d.series.rms.values, n = v.length; if (n < 10 || !duration) return [];
      var mn = Infinity, mx = -Infinity, i, k; for (i = 0; i < n; i++) { if (v[i] < mn) mn = v[i]; if (v[i] > mx) mx = v[i]; }
      var z = v.map(function (x) { return (x - mn) / ((mx - mn) || 1); });
      var w = Math.max(2, Math.round(n * 2 / duration)), out = [], last = -99;
      var mean = function (a, b) { var s = 0, c = 0; for (var j = Math.max(0, a); j < Math.min(n, b); j++) { s += z[j]; c++; } return c ? s / c : 0; };
      for (i = 0; i < n; i++) if (z[i] > 0.4) { out.push((i / (n - 1)) * duration); last = out[0]; break; }
      for (i = w; i < n - w; i++) {
        var t = (i / (n - 1)) * duration;
        if (mean(i, i + w) > mean(i - 2 * w, i) * 1.5 + 0.1 && t - last >= 8) { out.push(t); last = t; }
      }
      return out;
    } catch (e) { return []; }
  }
  function startAnalyser() {
    if (analyser || !audio) return;
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext; actx = new AC();
      var src = actx.createMediaElementSource(audio); analyser = actx.createAnalyser(); analyser.fftSize = 256;
      src.connect(analyser); analyser.connect(actx.destination); abuf = new Uint8Array(analyser.frequencyBinCount);
      if (actx.state === 'suspended') actx.resume();
    } catch (e) { analyser = null; }
  }
  function moveCursors(t, dur) {
    CURSORS.forEach(function (id) {
      var cv = document.getElementById(id); if (!cv || !cv.parentElement) return;
      var par = cv.parentElement;
      if (getComputedStyle(par).position === 'static') par.style.position = 'relative';
      var c = $('.ax-cursor[data-for="' + id + '"]', par);
      if (!c) { c = h('div', 'ax-cursor'); c.setAttribute('data-for', id); par.appendChild(c); }
      var line = id !== 'chroma-canvas', left = line ? 46 : 34, right = line ? 10 : 0;
      var w = cv.clientWidth - left - right, x = cv.offsetLeft + left + w * clamp(t / dur, 0, 1);
      c.style.left = x.toFixed(1) + 'px'; c.style.top = cv.offsetTop + 'px'; c.style.height = cv.clientHeight + 'px';
      c.style.display = t > 0 ? 'block' : 'none';
    });
  }

  /* ---------- canvas drawing: share card + report ---------- */
  var FONT_D = '"Space Grotesk", "Inter", sans-serif', FONT_M = '"IBM Plex Mono", monospace';
  function loadFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all(['700 40px "Space Grotesk"', '500 20px "IBM Plex Mono"', '400 20px "Inter"'].map(function (f) { return document.fonts.load(f).catch(function () {}); }));
  }
  function bg(ctx, W, H, seed) {
    var g = ctx.createLinearGradient(0, 0, W * 0.4, H); g.addColorStop(0, '#07051a'); g.addColorStop(0.55, '#150e46'); g.addColorStop(1, '#06141f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var r1 = ctx.createRadialGradient(W * 0.85, H * 0.12, 0, W * 0.85, H * 0.12, W * 0.7); r1.addColorStop(0, 'rgba(124,92,255,.38)'); r1.addColorStop(1, 'rgba(124,92,255,0)');
    ctx.fillStyle = r1; ctx.fillRect(0, 0, W, H);
    var r2 = ctx.createRadialGradient(W * 0.1, H * 0.9, 0, W * 0.1, H * 0.9, W * 0.7); r2.addColorStop(0, 'rgba(53,231,215,.22)'); r2.addColorStop(1, 'rgba(53,231,215,0)');
    ctx.fillStyle = r2; ctx.fillRect(0, 0, W, H);
    var rnd = rng(seed), i;
    for (i = 0; i < Math.floor(W * H / 5200); i++) {
      ctx.fillStyle = 'rgba(243,241,255,' + (0.1 + rnd() * 0.6).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, rnd() * 1.6 + 0.3, 0, 7); ctx.fill();
    }
  }
  function txt(ctx, s, x, y, font, color, align, maxW) {
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
    if (maxW) { while (ctx.measureText(s).width > maxW && s.length > 4) s = s.slice(0, -2); if (s !== arguments[1]) s = s.replace(/\s*$/, '') + '…'; }
    ctx.fillText(s, x, y);
  }
  function spaced(ctx, s, x, y, font, color, gap) {
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'left';
    for (var i = 0; i < s.length; i++) { ctx.fillText(s[i], x, y); x += ctx.measureText(s[i]).width + gap; }
  }
  function curve(ctx, ser, x, y, w, ht, color, fill) {
    var v = ser && ser.values; if (!v || !v.length) return;
    var mn = Math.min.apply(null, v), mx = Math.max.apply(null, v), rg = mx - mn || 1, step = Math.max(1, Math.floor(v.length / (w / 2)));
    ctx.beginPath();
    for (var i = 0; i < v.length; i += step) {
      var px = x + (w * i) / Math.max(1, v.length - 1), py = y + ht - ((v[i] - mn) / rg) * ht;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.lineJoin = 'round';
    if (fill) {
      ctx.lineTo(x + w, y + ht); ctx.lineTo(x, y + ht); ctx.closePath();
      var g = ctx.createLinearGradient(0, y, 0, y + ht); g.addColorStop(0, color + '66'); g.addColorStop(1, color + '00'); ctx.fillStyle = g; ctx.fill();
      ctx.beginPath();
      for (i = 0; i < v.length; i += step) { px = x + (w * i) / Math.max(1, v.length - 1); py = y + ht - ((v[i] - mn) / rg) * ht; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
    }
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.shadowColor = color; ctx.shadowBlur = 14; ctx.stroke(); ctx.shadowBlur = 0;
  }
  function chroma(ctx, ch, x, y, w, ht) {
    if (!ch || !ch.matrix || !ch.matrix.length) return;
    var rows = ch.matrix.length, cols = ch.matrix[0].length, cw = w / cols, rh = ht / rows, mx = 0, r, c;
    ch.matrix.forEach(function (row) { row.forEach(function (v) { if (v > mx) mx = v; }); });
    for (r = 0; r < rows; r++) for (c = 0; c < cols; c++) {
      var v = ch.matrix[r][c] / (mx || 1);
      ctx.fillStyle = 'hsla(' + (255 - v * 90) + ',85%,' + (35 + v * 30) + '%,' + (0.2 + v * 0.8) + ')';
      ctx.fillRect(x + c * cw, y + (rows - 1 - r) * rh, cw + 0.6, rh + 0.6);
    }
  }
  function drawQR(ctx, x, y, size, text) {
    var qr = AxQR.make(text, 'M'), q = 2, n = qr.size + q * 2, m = size / n, r, c;
    ctx.fillStyle = '#fff'; rr(ctx, x, y, size, size, size * 0.06); ctx.fill();
    ctx.fillStyle = '#0b0820';
    for (r = 0; r < qr.size; r++) for (c = 0; c < qr.size; c++) if (qr.isDark(r, c)) ctx.fillRect(x + (c + q) * m, y + (r + q) * m, m + 0.4, m + 0.4);
  }
  function rr(ctx, x, y, w, ht, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + ht, r); ctx.arcTo(x + w, y + ht, x, y + ht, r); ctx.arcTo(x, y + ht, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  var MET = [['Peak', 'peak_db', 'dB', 1], ['Avg loudness', 'average_loudness_db', 'dB', 1], ['Brightness', 'brightness_mean_hz', 'Hz', 0], ['Bandwidth', 'bandwidth_mean_hz', 'Hz', 0],
    ['Rolloff', 'rolloff_mean_hz', 'Hz', 0], ['Beat strength', 'beat_strength_mean', '', 3], ['Zero-crossing', 'zcr_mean', '', 4], ['RMS mean', 'rms_mean', '', 4], ['Duration', 'duration_sec', 's', 1]];
  function metricText(m, row) { var v = m[row[1]]; if (v === undefined || v === null) return '—'; return (row[3] === 0 ? Math.round(v).toLocaleString() : Number(v).toFixed(row[3])) + (row[2] ? ' ' + row[2] : ''); }

  function drawCard(canvas, d) {
    var W = 1080, H = 1350, ctx = canvas.getContext('2d'); canvas.width = W; canvas.height = H;
    var name = d.filename || 'Untitled', m = d.metrics || {}, P = 80;
    bg(ctx, W, H, hashStr(name));
    spaced(ctx, 'ASTRONA', P, 112, '700 30px ' + FONT_D, '#f3f1ff', 10);
    txt(ctx, 'AUDIO SIGNAL PROFILER', W - P, 112, '500 20px ' + FONT_M, '#8892b0', 'right');
    ctx.fillStyle = 'rgba(160,140,255,.25)'; ctx.fillRect(P, 140, W - P * 2, 2);
    txt(ctx, name.replace(/\.[a-z0-9]{2,5}$/i, ''), P, 230, '700 58px ' + FONT_D, '#f3f1ff', 'left', W - P * 2);
    txt(ctx, 'Duration ' + fmtTime(m.duration_sec) + '  ·  ' + (d.bpm.engine || 'librosa'), P, 280, '500 24px ' + FONT_M, '#8892b0');
    txt(ctx, 'TEMPO', P, 390, '500 24px ' + FONT_M, '#35e7d7');
    var bpmTxt = d.bpm.bpm.toFixed(0);
    txt(ctx, bpmTxt, P, 540, '700 190px ' + FONT_D, '#f3f1ff');
    ctx.font = '700 190px ' + FONT_D; var bw = ctx.measureText(bpmTxt).width;
    txt(ctx, 'BPM', P + bw + 18, 540, '600 40px ' + FONT_D, '#b6a6ff');
    txt(ctx, d.bpm.confidence + '% confidence', P, 590, '500 24px ' + FONT_M, '#8892b0');
    txt(ctx, 'KEY', 600, 390, '500 24px ' + FONT_M, '#35e7d7');
    var kf = 110; ctx.font = '700 110px ' + FONT_D;
    while (kf > 56 && ctx.measureText(d.key.label).width * (kf / 110) > W - 600 - P) kf -= 4;
    txt(ctx, d.key.label, 600, 540, '700 ' + kf + 'px ' + FONT_D, '#f3f1ff', 'left');
    txt(ctx, d.key.confidence + '% confidence', 600, 590, '500 24px ' + FONT_M, '#8892b0');
    txt(ctx, 'ENERGY OVER TIME', P, 690, '500 20px ' + FONT_M, '#8892b0');
    curve(ctx, d.series.rms, P, 710, W - P * 2, 210, '#7c5cff', true);
    txt(ctx, 'CHROMA', P, 976, '500 20px ' + FONT_M, '#8892b0');
    chroma(ctx, d.series.chroma, P, 996, W - P * 2, 130);
    var items = [['Peak', metricText(m, MET[0])], ['Loudness', metricText(m, MET[1])], ['Brightness', metricText(m, MET[2])], ['Clipped', ((d.distortion && d.distortion.clipped_percent) || 0) + '%']];
    items.forEach(function (it, i) {
      var x = P + i * ((W - P * 2 - 190) / 4);
      txt(ctx, it[0].toUpperCase(), x, 1176, '500 18px ' + FONT_M, '#8892b0');
      txt(ctx, it[1], x, 1210, '600 26px ' + FONT_D, '#f3f1ff');
    });
    txt(ctx, 'Analyzed by ' + user.name, P, 1270, '600 26px ' + FONT_D, '#f3f1ff');
    txt(ctx, siteUrl().replace(/^https?:\/\//, ''), P, 1308, '500 22px ' + FONT_M, '#35e7d7');
    drawQR(ctx, W - P - 150, H - 150 - 50, 150, siteUrl());
  }

  function drawReport(canvas, d) {
    var W = 1240, H = 1754, ctx = canvas.getContext('2d'); canvas.width = W; canvas.height = H;
    var name = d.filename || 'Untitled', m = d.metrics || {}, P = 80;
    bg(ctx, W, H, hashStr(name) + 7);
    spaced(ctx, 'ASTRONA', P, 110, '700 32px ' + FONT_D, '#f3f1ff', 10);
    txt(ctx, 'ANALYSIS REPORT', W - P, 110, '500 22px ' + FONT_M, '#8892b0', 'right');
    ctx.fillStyle = 'rgba(160,140,255,.25)'; ctx.fillRect(P, 138, W - P * 2, 2);
    txt(ctx, name, P, 214, '700 52px ' + FONT_D, '#f3f1ff', 'left', W - P * 2);
    txt(ctx, new Date().toLocaleString() + '  ·  ' + user.name, P, 258, '500 22px ' + FONT_M, '#8892b0');
    var cw = (W - P * 2 - 30) / 2;
    [['TEMPO', d.bpm.bpm.toFixed(1) + ' BPM', d.bpm.confidence + '% confidence'], ['KEY', d.key.label, d.key.confidence + '% confidence']].forEach(function (b, i) {
      var x = P + i * (cw + 30);
      ctx.fillStyle = 'rgba(255,255,255,.05)'; rr(ctx, x, 290, cw, 170, 22); ctx.fill();
      txt(ctx, b[0], x + 28, 336, '500 22px ' + FONT_M, '#35e7d7');
      txt(ctx, b[1], x + 28, 416, '700 62px ' + FONT_D, '#f3f1ff', 'left', cw - 56);
      txt(ctx, b[2], x + 28, 446, '500 20px ' + FONT_M, '#8892b0');
    });
    var boxes = [['Energy (RMS)', d.series.rms, '#7c5cff'], ['Loudness (dB)', d.series.loudness_db, '#ff8a8a'], ['Brightness', d.series.brightness, '#35e7d7'], ['Rhythmic activity', d.series.beat_strength, '#f3f1ff']];
    boxes.forEach(function (b, i) {
      var x = P + (i % 2) * (cw + 30), y = 500 + Math.floor(i / 2) * 290;
      ctx.fillStyle = 'rgba(255,255,255,.04)'; rr(ctx, x, y, cw, 260, 20); ctx.fill();
      txt(ctx, b[0].toUpperCase(), x + 24, y + 38, '500 20px ' + FONT_M, '#8892b0');
      curve(ctx, b[1], x + 24, y + 60, cw - 48, 170, b[2], false);
    });
    txt(ctx, 'CHROMA OVER TIME', P, 1112, '500 20px ' + FONT_M, '#8892b0');
    chroma(ctx, d.series.chroma, P, 1132, W - P * 2, 170);
    txt(ctx, 'METRICS', P, 1360, '500 20px ' + FONT_M, '#8892b0');
    MET.forEach(function (r, i) {
      var x = P + (i % 3) * ((W - P * 2) / 3), y = 1400 + Math.floor(i / 3) * 70;
      txt(ctx, r[0].toUpperCase(), x, y, '500 17px ' + FONT_M, '#8892b0');
      txt(ctx, metricText(m, r), x, y + 32, '600 26px ' + FONT_D, '#f3f1ff');
    });
    var dist = d.distortion || {};
    txt(ctx, dist.clipped_percent ? dist.clipped_percent + '% of samples clipped in ' + dist.region_count + ' region(s)' : 'No clipping detected', P, 1650, '500 22px ' + FONT_M, dist.clipped_percent ? '#ff8a8a' : '#35e7d7');
    txt(ctx, 'Analyze your own track:', P, 1700, '500 22px ' + FONT_M, '#8892b0');
    txt(ctx, siteUrl().replace(/^https?:\/\//, ''), P + 330, 1700, '600 24px ' + FONT_D, '#f3f1ff');
    drawQR(ctx, W - P - 140, H - 140 - 40, 140, siteUrl());
  }

  /* ---------- PDF (JPEG page, no libraries) ---------- */
  function pdfFromJpeg(jpg, w, hh) {
    var enc = new TextEncoder(), parts = [], off = [], len = 0;
    function push(x) { var b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; }
    function obj(n, body) { off[n] = len; push(n + ' 0 obj\n' + body + '\nendobj\n'); }
    var PW = 595.28, PH = 841.89;
    push('%PDF-1.4\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
    off[4] = len;
    push('4 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + w + ' /Height ' + hh + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>\nstream\n');
    push(jpg); push('\nendstream\nendobj\n');
    var c = 'q ' + PW + ' 0 0 ' + PH + ' 0 0 cm /Im0 Do Q';
    obj(5, '<< /Length ' + c.length + ' >>\nstream\n' + c + '\nendstream');
    var xref = len, x = 'xref\n0 6\n0000000000 65535 f \n';
    for (var i = 1; i <= 5; i++) x += ('0000000000' + off[i]).slice(-10) + ' 00000 n \n';
    push(x + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF');
    return new Blob(parts, { type: 'application/pdf' });
  }
  function dataUrlToBytes(u) { var b = atob(u.split(',')[1]), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function download(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  function safeName(d) { return (d.filename || 'track').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[^\w\-]+/g, '_').slice(0, 40) || 'track'; }
  function makeReportPdf(d) {
    toast('Building your PDF…');
    loadFonts().then(function () {
      var cv = document.createElement('canvas'); drawReport(cv, d);
      var bytes = dataUrlToBytes(cv.toDataURL('image/jpeg', 0.92));
      download(pdfFromJpeg(bytes, cv.width, cv.height), 'astrona-' + safeName(d) + '.pdf');
      setFlag('shared');
    }).catch(function () { toast('Could not build the PDF.'); });
  }

  /* ---------- share sheet ---------- */
  function openShare(d) {
    var box = h('div', 'ax-share'), cv = h('canvas', 'ax-canvas'), btns = h('div', 'ax-share-btns');
    var text = (d.filename || 'My track') + ': ' + d.bpm.bpm.toFixed(0) + ' BPM, ' + d.key.label + '. Analyzed with Astrona.';
    var url = siteUrl();
    var bSave = h('button', 'ax-btn is-primary', 'Save image'), bNative = h('button', 'ax-btn', 'Share…'),
      bTg = h('a', 'ax-btn', 'Telegram'), bWa = h('a', 'ax-btn', 'WhatsApp'), bPdf = h('button', 'ax-btn', 'PDF report');
    bSave.type = bNative.type = bPdf.type = 'button';
    bTg.href = 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text);
    bWa.href = 'https://wa.me/?text=' + encodeURIComponent(text + ' ' + url);
    [bTg, bWa].forEach(function (a) { a.target = '_blank'; a.rel = 'noopener'; a.style.textDecoration = 'none'; a.style.textAlign = 'center'; a.addEventListener('click', function () { setFlag('shared'); }); });
    var note = h('p', 'ax-hint', 'Instagram cannot receive a post from a website. Save the image (or use Share… on your phone) and post it from the app. The QR code opens this site.');
    [bSave, bNative, bTg, bWa, bPdf, note].forEach(function (e) { btns.appendChild(e); });
    box.appendChild(cv); box.appendChild(btns);
    openSheet('Share your result', box);
    var blob = null;
    loadFonts().then(function () {
      drawCard(cv, d);
      cv.toBlob(function (b) { blob = b; }, 'image/png');
    }).catch(function () { toast('Could not draw the card.'); });
    bSave.addEventListener('click', function () { if (!blob) return; download(blob, 'astrona-' + safeName(d) + '.png'); setFlag('shared'); });
    bPdf.addEventListener('click', function () { makeReportPdf(d); });
    bNative.addEventListener('click', function () {
      if (!blob) return;
      var f = new File([blob], 'astrona-result.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) {
        navigator.share({ files: [f], title: 'Astrona', text: text, url: url }).then(function () { setFlag('shared'); }).catch(function () {});
      } else if (navigator.share) {
        navigator.share({ title: 'Astrona', text: text, url: url }).then(function () { setFlag('shared'); }).catch(function () {});
      } else { toast('Sharing is not supported here. Use Save image.'); }
    });
  }

  /* ---------- public hooks ---------- */
  var reported = false;
  function step(name, fn) {
    try { fn(); } catch (e) {
      if (window.console) console.error('Astrona extras: ' + name, e);
      if (!reported) { reported = true; toast('Astrona extras: ' + name + ' failed (' + (e && e.message ? e.message : e) + ')'); }
    }
  }
  var AX = window.AX = {
    version: '1.2',
    onAnalyzed: function (data, file) {
      var item = null;
      step('history', function () { item = addHistory(data, file); });
      step('colors', function () { FX.tint(data.bpm && data.bpm.bpm || 110); });
      step('tools', function () { buildTools(data, file); });
      step('badges', function () { checkBadges(true); });
      step('bar', refreshBar);
      return item;
    }
  };

  function boot() { buildBar(); checkBadges(false); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
