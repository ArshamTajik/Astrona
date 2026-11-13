/* Astrona extras (ax-extra.js): song cover beside the analyzing staff + "About the artist" card.
   Reads the cover and tags (artist/title) straight from the audio file in the browser. */
(function () {
  'use strict';
  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  /* ---------- stage: the loader and the cover share a row ---------- */
  var loader = document.getElementById('staff-loader'), stage = null;
  if (loader && loader.parentNode) {
    stage = el('div', 'ax-stage');
    loader.parentNode.insertBefore(stage, loader);
    stage.appendChild(loader);
  }

  /* ---------- tag + cover reading ---------- */
  function u32(u, p) { return ((u[p] << 24) | (u[p + 1] << 16) | (u[p + 2] << 8) | u[p + 3]) >>> 0; }
  function u32le(u, p) { return (u[p] | (u[p + 1] << 8) | (u[p + 2] << 16) | (u[p + 3] << 24)) >>> 0; }
  function synch(u, p) { return (u[p] << 21) | (u[p + 1] << 14) | (u[p + 2] << 7) | u[p + 3]; }
  function ascii(u, p, n) { var s = ''; for (var i = 0; i < n; i++) s += String.fromCharCode(u[p + i]); return s; }
  function dec(bytes, label) { try { return new TextDecoder(label).decode(bytes); } catch (e) { return ''; } }
  function clean(s) { return (s || '').split('\u0000')[0].trim(); }
  function mimeOf(bytes, m) {
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
    if (bytes[0] === 0xFF && bytes[1] === 0xD8) return 'image/jpeg';
    return m && /^image\//.test(m) ? m : 'image/jpeg';
  }

  function readId3(u) {
    if (u.length < 10 || ascii(u, 0, 3) !== 'ID3' || u[3] < 3) return null;
    var ver = u[3], end = Math.min(10 + synch(u, 6), u.length), p = 10, out = {};
    if (u[5] & 0x40) p += ver === 4 ? synch(u, 10) : u32(u, 10) + 4;
    while (p + 10 <= end) {
      var id = ascii(u, p, 4);
      if (!/^[A-Z0-9]{4}$/.test(id)) break;
      var sz = ver === 4 ? synch(u, p + 4) : u32(u, p + 4), s = p + 10, e = s + sz;
      if (sz <= 0 || e > u.length) break;
      if (ver === 4 && (u[p + 9] & 1)) s += 4;
      if (id === 'TIT2' || id === 'TPE1') {
        var enc = u[s], b = u.subarray(s + 1, e), label = enc === 1 ? 'utf-16' : enc === 2 ? 'utf-16be' : enc === 3 ? 'utf-8' : 'iso-8859-1';
        if (enc === 1 && b[0] === 0xFE && b[1] === 0xFF) label = 'utf-16be';
        out[id === 'TIT2' ? 'title' : 'artist'] = clean(dec(b, label));
      } else if (id === 'APIC' && !out.cover) {
        var en = u[s], i = s + 1, ms = i;
        while (i < e && u[i] !== 0) i++;
        var mime = ascii(u, ms, i - ms); i += 2; // end of mime + picture type
        if (en === 0 || en === 3) { while (i < e && u[i] !== 0) i++; i++; }
        else { while (i + 1 < e && !(u[i] === 0 && u[i + 1] === 0)) i += 2; i += 2; }
        if (i < e) out.cover = { bytes: u.subarray(i, e), mime: mime };
      }
      p = e;
    }
    return out;
  }

  function readFlac(u) {
    if (ascii(u, 0, 4) !== 'fLaC') return null;
    var p = 4, out = {}, last = false;
    while (!last && p + 4 <= u.length) {
      last = !!(u[p] & 0x80); var type = u[p] & 0x7F, len = (u[p + 1] << 16) | (u[p + 2] << 8) | u[p + 3], s = p + 4, e = s + len;
      if (e > u.length) break;
      if (type === 4) {
        var q = s, vl = u32le(u, q); q += 4 + vl; var n = u32le(u, q); q += 4;
        for (var k = 0; k < n && q + 4 <= e; k++) {
          var cl = u32le(u, q); q += 4; var txt = dec(u.subarray(q, q + cl), 'utf-8'); q += cl;
          var m = txt.match(/^(ARTIST|TITLE)=(.*)$/i);
          if (m) out[m[1].toLowerCase()] = m[2].trim();
        }
      } else if (type === 6 && !out.cover) {
        var r = s + 4, ml = u32(u, r); r += 4; var mime = ascii(u, r, ml); r += ml;
        var dl = u32(u, r); r += 4 + dl + 16; var pl = u32(u, r); r += 4;
        if (r + pl <= u.length) out.cover = { bytes: u.subarray(r, r + pl), mime: mime };
      }
      p = e;
    }
    return out;
  }

  function atoms(u, s, e, cb) {
    var p = s;
    while (p + 8 <= e) {
      var sz = u32(u, p), t = ascii(u, p + 4, 4), hdr = 8;
      if (sz === 1) { sz = u32(u, p + 12); hdr = 16; } else if (sz === 0) sz = e - p;
      if (sz < hdr) break;
      if (p + sz > e) sz = e - p;
      cb(t, p + hdr, p + sz);
      p += sz;
    }
  }
  function readM4a(u) {
    if (ascii(u, 4, 4) !== 'ftyp') return null;
    var out = {};
    atoms(u, 0, u.length, function (t, s, e) {
      if (t !== 'moov') return;
      atoms(u, s, e, function (t2, s2, e2) {
        if (t2 !== 'udta') return;
        atoms(u, s2, e2, function (t3, s3, e3) {
          if (t3 !== 'meta') return;
          atoms(u, s3 + 4, e3, function (t4, s4, e4) {
            if (t4 !== 'ilst') return;
            atoms(u, s4, e4, function (t5, s5, e5) {
              atoms(u, s5, e5, function (t6, s6, e6) {
                if (t6 !== 'data') return;
                var d = u.subarray(s6 + 8, e6);
                if (t5 === '©ART') out.artist = dec(d, 'utf-8').trim();
                else if (t5 === '©nam') out.title = dec(d, 'utf-8').trim();
                else if (t5 === 'covr' && !out.cover) out.cover = { bytes: d, mime: '' };
              });
            });
          });
        });
      });
    });
    return out;
  }

  function readTags(file) {
    var big = /\.(m4a|mp4|aac)$/i.test(file.name) && file.size < 80 * 1024 * 1024;
    var blob = big ? file : file.slice(0, 6 * 1024 * 1024);
    return blob.arrayBuffer().then(function (buf) {
      var u = new Uint8Array(buf), out = null;
      try { out = readId3(u) || readFlac(u) || readM4a(u); } catch (e) { out = null; }
      return out || {};
    }).catch(function () { return {}; });
  }
  function guessFromName(name) {
    var base = String(name || '').replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/\s+/g, ' ').trim();
    var m = base.split(/\s[-–—]\s/);
    return m.length >= 2 ? { artist: m[0].trim(), title: m.slice(1).join(' - ').trim() } : { artist: '', title: base };
  }

  /* ---------- cover next to the analyzing staff ---------- */
  var coverUrl = '', token = 0, tagsCache = { file: null, tags: {} };
  function dropCover() {
    var old = stage && $('.ax-cover', stage); if (old) old.remove();
    if (stage) stage.classList.remove('has-cover');
    if (coverUrl) { URL.revokeObjectURL(coverUrl); coverUrl = ''; }
  }
  function showCover(file) {
    var my = ++token; dropCover();
    if (!stage || !file) return;
    readTags(file).then(function (tags) {
      tagsCache = { file: file, tags: tags };
      if (my !== token || !tags.cover) return;
      var c = tags.cover; coverUrl = URL.createObjectURL(new Blob([c.bytes], { type: mimeOf(c.bytes, c.mime) }));
      var box = el('div', 'ax-cover'), img = new Image();
      img.alt = 'Album cover'; img.onload = function () { box.classList.add('is-in'); }; img.onerror = function () { box.remove(); stage.classList.remove('has-cover'); };
      img.src = coverUrl; box.appendChild(img);
      stage.insertBefore(box, stage.firstChild); stage.classList.add('has-cover');
      sizeCover(); startRing(box);
    });
  }
  // The cover is as tall as the analyzing panel on wide screens; a fixed size on phones.
  function sizeCover() {
    var box = stage && $('.ax-cover', stage); if (!box) return;
    var wide = window.matchMedia && window.matchMedia('(min-width: 900px)').matches;
    var s = wide ? Math.max(120, Math.round(loader.offsetHeight)) : 136;
    box.style.width = box.style.height = s + 'px';
  }
  if (window.ResizeObserver && loader) new ResizeObserver(sizeCover).observe(loader);
  window.addEventListener('resize', sizeCover);
  // A progress ring around the cover that fills with the analysis percentage.
  var ringRaf = 0;
  function startRing(box) {
    cancelAnimationFrame(ringRaf);
    var shown = 0;
    (function tick() {
      if (!box.isConnected) return;
      var pe = loader.querySelector('.sl-percent'), p = pe ? parseFloat(pe.textContent) : 0;
      if (isNaN(p)) p = 0;
      shown += (p - shown) * 0.12;
      box.style.setProperty('--p', shown.toFixed(2)); box.style.setProperty('--h', (185 + shown * 1.5).toFixed(0));
      ringRaf = requestAnimationFrame(tick);
    })();
  }
  function hideCover() { cancelAnimationFrame(ringRaf); token++; dropCover(); }

  /* ---------- "About the artist" ---------- */
  function cacheGet(k) { try { return JSON.parse(localStorage.getItem('ax.bio.' + k) || 'null'); } catch (e) { return null; } }
  function cacheSet(k, v) { try { localStorage.setItem('ax.bio.' + k, JSON.stringify(v)); } catch (e) {} }
  function wiki(lang, q) {
    var u = 'https://' + lang + '.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrlimit=1&gsrsearch=' + encodeURIComponent(q) +
      '&prop=extracts%7Cpageimages%7Cinfo&exintro=1&explaintext=1&exchars=800&piprop=thumbnail&pithumbsize=240&inprop=url';
    return fetch(u).then(function (r) { return r.json(); }).then(function (j) {
      var pg = j && j.query && j.query.pages; if (!pg) return null;
      var p = pg[Object.keys(pg)[0]]; if (!p || !p.extract) return null;
      return { title: p.title, text: p.extract, url: p.fullurl, img: p.thumbnail && p.thumbnail.source, lang: lang };
    });
  }
  function lookup(name) {
    var key = name.toLowerCase(), hit = cacheGet(key);
    if (hit) return Promise.resolve(hit);
    return wiki('en', name).catch(function () { return null; }).then(function (r) {
      return r || wiki('fa', name).catch(function () { return null; });
    }).then(function (r) { if (r) cacheSet(key, r); return r; });
  }
  function buildBio(file) {
    var old = $('.ax-bio'); if (old) old.remove();
    var anchor = $('.ax-tools') || $('#dashboard .filename-row'); if (!anchor) return;
    var card = el('div', 'ax-bio'), head = el('div', 'ax-bio-head', 'About the artist');
    var q = el('div', 'ax-bio-q'), input = el('input', 'ax-bio-in'), go = el('button', 'ax-btn', 'Search'), out = el('div', 'ax-bio-out');
    input.type = 'text'; input.placeholder = 'Artist name'; input.setAttribute('aria-label', 'Artist name'); go.type = 'button';
    q.appendChild(input); q.appendChild(go); card.appendChild(head); card.appendChild(q); card.appendChild(out);
    anchor.insertAdjacentElement('afterend', card);

    function render(r, name) {
      out.textContent = '';
      var web = 'https://www.google.com/search?q=' + encodeURIComponent(name + ' biography');
      if (!r) {
        out.appendChild(el('p', 'ax-bio-note', 'No article found for "' + name + '". Check the spelling, or search the web.'));
      } else {
        var row = el('div', 'ax-bio-row');
        if (r.img) { var im = new Image(); im.src = r.img; im.alt = r.title; im.className = 'ax-bio-img'; row.appendChild(im); }
        var col = el('div', 'ax-bio-col'); col.appendChild(el('b', 'ax-bio-title', r.title)); col.appendChild(el('p', 'ax-bio-text', r.text));
        row.appendChild(col); out.appendChild(row);
      }
      var links = el('div', 'ax-row');
      if (r && r.url) { var a = el('a', 'ax-btn', 'Read on Wikipedia'); a.href = r.url; a.target = '_blank'; a.rel = 'noopener'; links.appendChild(a); }
      var w = el('a', 'ax-btn', 'Search the web'); w.href = web; w.target = '_blank'; w.rel = 'noopener'; links.appendChild(w);
      out.appendChild(links);
      if (r) out.appendChild(el('p', 'ax-bio-src', 'Source: Wikipedia. If this is the wrong person, edit the name and search again.'));
    }
    function run() {
      var name = input.value.trim();
      if (!name) { out.textContent = ''; out.appendChild(el('p', 'ax-bio-note', 'Type an artist name to read their story.')); return; }
      out.textContent = ''; out.appendChild(el('p', 'ax-bio-note', 'Searching…'));
      lookup(name).then(function (r) { if (input.value.trim() === name) render(r, name); });
    }
    go.addEventListener('click', run);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') run(); });

    var have = tagsCache.file === file ? Promise.resolve(tagsCache.tags) : readTags(file);
    have.then(function (tags) {
      var g = guessFromName(file && file.name);
      input.value = (tags.artist || g.artist || '').trim();
      run();
    });
  }

  window.AXX = { showCover: showCover, hideCover: hideCover, buildBio: buildBio, readTags: readTags };
})();
