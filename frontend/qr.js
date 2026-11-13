/*!
 * AxQR - tiny QR code generator (byte mode, versions 1-10, EC level L or M).
 * Usage: var qr = AxQR.make('https://astrona.ir', 'M'); qr.size; qr.isDark(row, col)
 */
(function (root) {
  'use strict';

  // [ecCodewordsPerBlock, [[blockCount, dataCodewordsPerBlock], ...]] for versions 1..10
  var EC = {
    L: [
      null,
      [7, [[1, 19]]], [10, [[1, 34]]], [15, [[1, 55]]], [20, [[1, 80]]], [26, [[1, 108]]],
      [18, [[2, 68]]], [20, [[2, 78]]], [24, [[2, 97]]], [30, [[2, 116]]], [18, [[2, 68], [2, 69]]]
    ],
    M: [
      null,
      [10, [[1, 16]]], [16, [[1, 28]]], [26, [[1, 44]]], [18, [[2, 32]]], [24, [[2, 43]]],
      [16, [[4, 27]]], [18, [[4, 31]]], [22, [[2, 38], [2, 39]]], [22, [[3, 36], [2, 37]]], [26, [[4, 43], [1, 44]]]
    ]
  };
  var ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
  var FORMAT_BITS = { L: 1, M: 0 };

  var EXP = new Array(512), LOG = new Array(256);
  (function () {
    var x = 1, i;
    for (i = 0; i < 255; i++) {
      EXP[i] = x; LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();

  function gmul(a, b) { return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]; }

  function rsGenerator(degree) {
    var poly = [1], i, j;
    for (i = 0; i < degree; i++) {
      var next = new Array(poly.length + 1);
      for (j = 0; j < next.length; j++) next[j] = 0;
      for (j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gmul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly; // highest degree first, leading coefficient 1
  }

  function rsRemainder(data, degree) {
    var gen = rsGenerator(degree);
    var res = new Array(degree), i, j;
    for (i = 0; i < degree; i++) res[i] = 0;
    for (i = 0; i < data.length; i++) {
      var factor = data[i] ^ res[0];
      res.shift();
      res.push(0);
      for (j = 0; j < degree; j++) res[j] ^= gmul(gen[j + 1], factor);
    }
    return res;
  }

  function utf8(str) {
    if (typeof TextEncoder !== 'undefined') return Array.prototype.slice.call(new TextEncoder().encode(str));
    var s = unescape(encodeURIComponent(str)), out = [], i;
    for (i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
  }

  function dataCapacity(ver, ecl) {
    var info = EC[ecl][ver], total = 0, i;
    for (i = 0; i < info[1].length; i++) total += info[1][i][0] * info[1][i][1];
    return total;
  }

  function buildCodewords(bytes, ecl) {
    var ver, cap = 0;
    for (ver = 1; ver <= 10; ver++) {
      cap = dataCapacity(ver, ecl);
      var ccBits = ver < 10 ? 8 : 16;
      if (4 + ccBits + 8 * bytes.length <= cap * 8) break;
    }
    if (ver > 10) throw new Error('AxQR: text too long');

    var bits = [];
    function put(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    put(4, 4);
    put(bytes.length, ver < 10 ? 8 : 16);
    for (var i = 0; i < bytes.length; i++) put(bytes[i], 8);
    var maxBits = cap * 8;
    put(0, Math.min(4, maxBits - bits.length));
    while (bits.length % 8) bits.push(0);
    var data = [];
    for (i = 0; i < bits.length; i += 8) {
      var b = 0;
      for (var k = 0; k < 8; k++) b = (b << 1) | bits[i + k];
      data.push(b);
    }
    for (var pad = 0xec; data.length < cap; pad ^= 0xec ^ 0x11) data.push(pad);

    // split into blocks, add EC, interleave
    var info = EC[ecl][ver], ecLen = info[0], blocks = [], pos = 0, g, n;
    for (g = 0; g < info[1].length; g++) {
      for (n = 0; n < info[1][g][0]; n++) {
        var d = data.slice(pos, pos + info[1][g][1]);
        pos += info[1][g][1];
        blocks.push({ data: d, ec: rsRemainder(d, ecLen) });
      }
    }
    var out = [], maxData = 0;
    for (i = 0; i < blocks.length; i++) maxData = Math.max(maxData, blocks[i].data.length);
    for (i = 0; i < maxData; i++) for (n = 0; n < blocks.length; n++) if (i < blocks[n].data.length) out.push(blocks[n].data[i]);
    for (i = 0; i < ecLen; i++) for (n = 0; n < blocks.length; n++) out.push(blocks[n].ec[i]);
    return { version: ver, codewords: out };
  }

  function make(text, ecl) {
    ecl = ecl === 'L' ? 'L' : 'M';
    var built = buildCodewords(utf8(String(text)), ecl);
    var ver = built.version, size = 17 + 4 * ver, x, y, i, j;

    var mod = [], fn = [];
    for (y = 0; y < size; y++) {
      mod.push([]); fn.push([]);
      for (x = 0; x < size; x++) { mod[y].push(false); fn[y].push(false); }
    }
    function setFn(px, py, dark) {
      if (px < 0 || py < 0 || px >= size || py >= size) return;
      mod[py][px] = !!dark; fn[py][px] = true;
    }

    // timing
    for (i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
    // finders
    function finder(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var dist = Math.max(Math.abs(dx), Math.abs(dy));
        setFn(cx + dx, cy + dy, dist !== 2 && dist !== 4);
      }
    }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    // alignment
    var pos = ALIGN[ver], n = pos.length;
    for (i = 0; i < n; i++) for (j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) {
        setFn(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
    // reserve format areas (real values written later)
    function drawFormat(mask) {
      var data = (FORMAT_BITS[ecl] << 3) | mask, rem = data, k;
      for (k = 0; k < 10; k++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var bits = ((data << 10) | rem) ^ 0x5412;
      function bit(b) { return ((bits >>> b) & 1) !== 0; }
      for (k = 0; k <= 5; k++) setFn(8, k, bit(k));
      setFn(8, 7, bit(6)); setFn(8, 8, bit(7)); setFn(7, 8, bit(8));
      for (k = 9; k < 15; k++) setFn(14 - k, 8, bit(k));
      for (k = 0; k < 8; k++) setFn(size - 1 - k, 8, bit(k));
      for (k = 8; k < 15; k++) setFn(8, size - 15 + k, bit(k));
      setFn(8, size - 8, true);
    }
    drawFormat(0);
    if (ver >= 7) {
      var rem = ver, k;
      for (k = 0; k < 12; k++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      var vbits = (ver << 12) | rem;
      for (k = 0; k < 18; k++) {
        var b = ((vbits >>> k) & 1) !== 0, a = size - 11 + (k % 3), c = Math.floor(k / 3);
        setFn(a, c, b); setFn(c, a, b);
      }
    }

    // place data bits
    var bits = [];
    for (i = 0; i < built.codewords.length; i++) for (j = 7; j >= 0; j--) bits.push((built.codewords[i] >>> j) & 1);
    var bi = 0, up = true;
    for (var col = size - 1; col >= 1; col -= 2) {
      if (col === 6) col = 5;
      for (var v = 0; v < size; v++) {
        var row = up ? size - 1 - v : v;
        for (var cc = 0; cc < 2; cc++) {
          var px = col - cc;
          if (!fn[row][px]) { mod[row][px] = bi < bits.length ? bits[bi] === 1 : false; bi++; }
        }
      }
      up = !up;
    }

    function maskBit(m, r, c) {
      switch (m) {
        case 0: return (r + c) % 2 === 0;
        case 1: return r % 2 === 0;
        case 2: return c % 3 === 0;
        case 3: return (r + c) % 3 === 0;
        case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
        case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
        case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
        default: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
      }
    }
    function applyMask(m) {
      for (var r = 0; r < size; r++) for (var c = 0; c < size; c++) {
        if (!fn[r][c] && maskBit(m, r, c)) mod[r][c] = !mod[r][c];
      }
    }
    function penalty() {
      var p = 0, r, c, run, k, dark = 0;
      for (r = 0; r < size; r++) {
        run = 1;
        for (c = 1; c <= size; c++) {
          if (c < size && mod[r][c] === mod[r][c - 1]) run++;
          else { if (run >= 5) p += 3 + (run - 5); run = 1; }
        }
      }
      for (c = 0; c < size; c++) {
        run = 1;
        for (r = 1; r <= size; r++) {
          if (r < size && mod[r][c] === mod[r - 1][c]) run++;
          else { if (run >= 5) p += 3 + (run - 5); run = 1; }
        }
      }
      for (r = 0; r < size - 1; r++) for (c = 0; c < size - 1; c++) {
        var v0 = mod[r][c];
        if (v0 === mod[r][c + 1] && v0 === mod[r + 1][c] && v0 === mod[r + 1][c + 1]) p += 3;
      }
      var pa = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], pb = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
      for (r = 0; r < size; r++) for (c = 0; c <= size - 11; c++) {
        var ma = true, mb = true, ma2 = true, mb2 = true;
        for (k = 0; k < 11; k++) {
          var h = mod[r][c + k] ? 1 : 0, vv = mod[c + k][r] ? 1 : 0;
          if (h !== pa[k]) ma = false;
          if (h !== pb[k]) mb = false;
          if (vv !== pa[k]) ma2 = false;
          if (vv !== pb[k]) mb2 = false;
        }
        if (ma || mb) p += 40;
        if (ma2 || mb2) p += 40;
      }
      for (r = 0; r < size; r++) for (c = 0; c < size; c++) if (mod[r][c]) dark++;
      p += Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;
      return p;
    }

    var best = 0, bestScore = Infinity, m;
    for (m = 0; m < 8; m++) {
      applyMask(m);
      drawFormat(m);
      var s = penalty();
      if (s < bestScore) { bestScore = s; best = m; }
      applyMask(m); // undo
    }
    applyMask(best);
    drawFormat(best);

    return {
      size: size,
      version: ver,
      isDark: function (r, c) { return r >= 0 && c >= 0 && r < size && c < size && mod[r][c]; }
    };
  }

  root.AxQR = { make: make };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.AxQR;
})(typeof window !== 'undefined' ? window : globalThis);
