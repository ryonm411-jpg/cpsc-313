/* retake.js — random drills for the Quiz 3 retake question types.
 *
 * Retake.worst(el)   Q6: maximum misses with random eviction (and Belady's minimum)
 * Retake.dirty(el)   Q7: write-back/allocate, find the dirty-eviction fraction from the average time
 * Retake.amdahl(el)  Q8: two-part Amdahl (one part may slow down) plus new time
 * Retake.loop(el)    Q9: hits and misses for a 2D-array loop (j = 0 or j = i, step 1 or 2)
 * Retake.mask(el)    Q10: index mask in hex, index of an address in binary
 *
 * Parts may be numeric ({answer}) or text ({text, kind: 'hex'|'bin'}).
 * Needs quiz.js loaded first (uses Quiz.verdict).
 */
(function (root) {
  'use strict';
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function rint(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
  function r4(x) { return Math.round(x * 10000) / 10000; }
  function log2(x) { return Math.round(Math.log(x) / Math.LN2); }

  function norm(v, kind) {
    v = String(v).trim().toLowerCase().replace(/_/g, '').replace(/\s/g, '');
    if (kind === 'hex') { v = v.replace(/^0x/, '').replace(/^0+(?=.)/, ''); }
    if (kind === 'bin') { v = v.replace(/^0b/, '').replace(/^0+(?=.)/, ''); }
    if (kind === 'txt') { v = v.toUpperCase(); }
    return v;
  }

  function card(el, build) {
    var score = { right: 0, total: 0 };
    el.innerHTML = '<div class="quiz drill"></div>';
    var box = el.firstChild;
    function go() {
      var p = build();
      box.classList.remove('done');
      box.innerHTML = '<p class="q">' + p.q + '</p>' + p.parts.map(function (x) {
        var t = x.kind ? 'text' : 'number';
        return '<p>' + x.label + ' <input type="' + t + '" step="any" class="n" autocomplete="off" spellcheck="false"' +
          (x.kind ? ' placeholder="' + ({ hex: '0x…', bin: '0b…', txt: 'letter' })[x.kind] + '"' : '') + '> ' + (x.unit || '') + '</p>';
      }).join('') + '<div class="row"><button class="btn chk" type="button">Check</button></div><div class="why"></div>';
      var inputs = box.querySelectorAll('.n');
      function ok(i) {
        var x = p.parts[i], v = inputs[i].value;
        if (x.kind) return norm(v, x.kind) === norm(x.text, x.kind);
        return Math.abs(Number(v) - x.answer) <= (x.tol || 0) + 1e-9;
      }
      function check() {
        if (box.classList.contains('done')) return;
        var all = true;
        for (var i = 0; i < inputs.length; i++) { if (inputs[i].value === '') return; if (!ok(i)) all = false; }
        score.total++; if (all) score.right++;
        var why = box.querySelector('.why');
        why.innerHTML = '<ol>' + p.parts.map(function (x, j) {
          var shown = x.kind ? x.text : r4(x.answer);
          return '<li><strong>' + shown + '</strong>' + (ok(j) ? ' ✓' : ' (you said ' + inputs[j].value + ')') + ': ' + x.how + '</li>';
        }).join('') + '</ol>' + (p.extra || '') + '<p class="muted">Score: ' + score.right + ' / ' + score.total + '</p><button class="btn nx" type="button">Next problem →</button>';
        root.Quiz.verdict(box, all);
        why.querySelector('.nx').addEventListener('click', go);
      }
      box.querySelector('.chk').addEventListener('click', check);
      inputs.forEach(function (inp) { inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') check(); }); });
    }
    go();
  }

  /* ---------- Q6: worst case under random eviction (fully associative) ---------- */
  function worstMisses(seq, k) {
    var best = 0;
    (function go(i, c, m) {
      if (m + (seq.length - i) <= best) return;
      if (i === seq.length) { best = Math.max(best, m); return; }
      var x = seq[i];
      if (c.indexOf(x) >= 0) return go(i + 1, c, m);
      if (c.length < k) return go(i + 1, c.concat([x]), m + 1);
      for (var v = 0; v < c.length; v++) { var n = c.slice(); n[v] = x; go(i + 1, n, m + 1); }
    })(0, [], 0);
    return best;
  }
  function beladyMisses(seq, k) {
    var c = [], m = 0;
    seq.forEach(function (x, i) {
      if (c.indexOf(x) >= 0) return;
      m++;
      if (c.length < k) { c.push(x); return; }
      function nxt(y) { var j = seq.indexOf(y, i + 1); return j < 0 ? 1e9 : j; }
      c.sort(function (p, q) { return nxt(q) - nxt(p); });
      c[0] = x;
    });
    return m;
  }
  function worst(el) {
    card(el, function () {
      var k = pick([3, 4]), letters = 'ABCDEFGH'.slice(0, k + pick([1, 2])).split(''), n = rint(10, 13), seq = [];
      while (seq.length < n) { var x = pick(letters); if (seq[seq.length - 1] !== x) seq.push(x); }
      var distinct = letters.filter(function (l) { return seq.indexOf(l) >= 0; }).length;
      var w = worstMisses(seq, k), b = beladyMisses(seq, k);
      return { q: 'Fully associative, <strong>' + k + ' slots</strong>, starts empty. Sequence: <code>' + seq.join(' ') + '</code> (' + n + ' accesses).',
        parts: [
          { label: 'Compulsory (cold) misses', answer: distinct, how: 'one per distinct line.' },
          { label: 'Maximum misses with random eviction', answer: w, how: 'evict the line needed soonest on every miss. A repeat is a guaranteed hit if the cache was not yet full, or no miss happened since that line was last used.' },
          { label: 'Minimum misses (Belady)', answer: b, how: 'evict the line needed furthest in the future.' }] };
    });
  }

  /* ---------- Q7: dirty-eviction fraction from the average ---------- */
  function dirty(el) {
    card(el, function () {
      var c = pick([1, 2, 3, 4, 5]), d = pick([20, 40, 50, 80, 100]), m = pick([0.02, 0.04, 0.05, 0.1, 0.2]), p = pick([0.1, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.75]);
      var T = r4(c + m * d * (1 + p));
      var fwd = Math.random() < 0.3;
      if (fwd) return { q: 'Write-back, write-allocate. Cache access <strong>' + c + ' ns</strong>, memory access <strong>' + d + ' ns</strong>, miss rate <strong>' + m + '</strong>. ' + (p * 100) + '% of evictions are dirty. Average access time?',
        parts: [{ label: 'Average', unit: 'ns', answer: T, tol: 0.005, how: 'c + m·d·(1 + p) = ' + c + ' + ' + m + '·' + d + '·' + (1 + p) + '. Hit = c; clean miss = c + d; dirty miss = c + 2d.' }] };
      return { q: 'Write-back, write-allocate. Cache access <strong>' + c + ' ns</strong>, memory access <strong>' + d + ' ns</strong>, miss rate <strong>' + m + '</strong>, average access time <strong>' + T + ' ns</strong>. What fraction of evictions are dirty? (decimal)',
        parts: [{ label: 'Dirty fraction p', answer: p, tol: 0.005, how: 'T = c + m·d·(1 + p), so p = (T − c)/(m·d) − 1 = (' + T + ' − ' + c + ')/(' + r4(m * d) + ') − 1.' }] };
    });
  }

  /* ---------- Q8: two-part Amdahl ---------- */
  function amdahl(el) {
    card(el, function () {
      var f = pick([0.3, 0.4, 0.45, 0.52, 0.6, 0.65, 0.7]), s1 = pick([1.5, 2, 2.5, 3, 3.6, 4, 5]), s2 = pick([0.8, 0.9, 1, 1.2, 1.4, 1.5, 2]), t = pick([60, 100, 132, 200, 300, 450]);
      var frac = f / s1 + (1 - f) / s2;
      var s2txt = s2 < 1 ? 'the change makes the rest <strong>slower</strong>: it runs at ' + s2 + '× its old speed' : s2 === 1 ? 'the rest is unchanged' : 'the rest gets <strong>' + s2 + '×</strong> faster';
      return { q: (f * 100) + '% of the time is memory, and memory gets <strong>' + s1 + '×</strong> faster; ' + s2txt + '. The old time was <strong>' + t + ' s</strong>.',
        parts: [
          { label: 'Overall speedup (4 decimals)', answer: r4(1 / frac), tol: 0.0006, how: '1 / (' + f + '/' + s1 + ' + ' + r4(1 - f) + '/' + s2 + ') = 1 / ' + r4(frac) + '.' },
          { label: 'New time (2 decimals)', unit: 's', answer: Math.round(t * frac * 100) / 100, tol: 0.006, how: t + ' × ' + r4(frac) + '.' }] };
    });
  }

  /* ---------- Q9: 2D loop hits and misses ---------- */
  function loopRun(E, rowsN, colsN, step, tri) {
    var seen = {}, h = 0, m = 0, cells = [];
    for (var i = 0; i < rowsN; i++) for (var j = tri ? i : 0; j < colsN; j += step) {
      var ln = Math.floor((16 * i + j) / E);
      if (seen[ln]) { h++; cells.push('[' + i + '][' + j + '] H'); } else { seen[ln] = 1; m++; cells.push('[' + i + '][' + j + '] <strong>M</strong>'); }
    }
    return { h: h, m: m, cells: cells };
  }
  function loop(el) {
    card(el, function () {
      var elem = pick([4, 8]), line = pick([8, 16, 32]), E = line / elem;
      if (E < 1) { line = 16; E = line / elem; }
      var rowsN = pick([2, 4]), colsN = pick([4, 8, 16]), step = pick([1, 1, 2]), tri = Math.random() < 0.6;
      var r = loopRun(E, rowsN, colsN, step, tri);
      var code = 'for (i = 0; i &lt; ' + rowsN + '; i++)\n  for (j = ' + (tri ? 'i' : '0') + '; j &lt; ' + colsN + '; j ' + (step === 1 ? '++' : '+= 2') + ')\n    sum += a[i][j];';
      return { q: '<code>' + (elem === 4 ? 'int' : 'double') + ' a[16][16]</code>, line-aligned. Cache 2048 bytes, direct-mapped, <strong>' + line + '-byte</strong> lines, cold. <code>sum</code> lives in a register.<pre><code>' + code + '</code></pre>',
        parts: [
          { label: 'Elements per line', answer: E, how: line + ' ÷ ' + elem + '.' },
          { label: 'Misses', answer: r.m, how: 'one per distinct line touched. a[i][j] is element 16·i + j, in line ⌊(16·i + j)/' + E + '⌋.' },
          { label: 'Hits', answer: r.h, how: 'every other access.' }],
        extra: '<p class="muted" style="font-size:.9em">' + r.cells.join(' · ') + '</p>' };
    });
  }

  /* ---------- Q10: index mask and index bits ---------- */
  function mask(el) {
    card(el, function () {
      var line = pick([16, 32, 32, 64]), kb = pick([2, 4, 8, 16]), ways = pick([1, 1, 2, 4]);
      var sets = kb * 1024 / line / ways, b = log2(line), s = log2(sets);
      var m = (sets - 1) * line;
      var addr = rint(0x10000, 0xFFFFFF);
      var idx = Math.floor(addr / line) % sets, off = addr % line;
      var idxBin = idx.toString(2); while (idxBin.length < s) idxBin = '0' + idxBin;
      var offBin = off.toString(2); while (offBin.length < b) offBin = '0' + offBin;
      return { q: (ways === 1 ? 'Direct-mapped' : ways + '-way') + ', <strong>' + kb + ' KB</strong>, <strong>' + line + '-byte</strong> lines, 32-bit addresses. Address <code>0x' + addr.toString(16).toUpperCase() + '</code>.',
        parts: [
          { label: 'Index mask (hex)', kind: 'hex', text: '0x' + m.toString(16).toUpperCase(), how: sets + ' sets → ' + s + ' index bits, sitting above ' + b + ' offset bits. Mask = (sets − 1) << ' + b + ' = ' + s + ' ones followed by ' + b + ' zeros.' },
          { label: 'Index of the address (binary, ' + s + ' bits)', kind: 'bin', text: idxBin, how: '(address & mask) >> ' + b + ' = ' + idx + ' = 0x' + idx.toString(16).toUpperCase() + '.' },
          { label: 'Offset (binary, ' + b + ' bits)', kind: 'bin', text: offBin, how: 'the low ' + b + ' bits of the address.' }] };
    });
  }

  /* ---------- Q1/Q2: which line does each policy evict? ----------
   * The cache starts holding init (loaded in that order, each used once). Run hist, then Q misses.
   * LFU: counts reset on eviction, ties go to LRU. Belady: furthest next use (never = furthest).
   * Returns { victim, cache, tie } where tie = some decision needed a tie-break. */
  var POL = { LRU: 'LRU', MRU: 'MRU', FIFO: 'FIFO', LFU: 'LFU', BEL: 'Belady' };
  function evictRun(policy, init, hist, q, future) {
    var full = init.concat(hist, [q], future), t = 0, c = [], tie = false, evicted = [];
    function meta(x) { for (var i = 0; i < c.length; i++) if (c[i].k === x) return c[i]; return null; }
    function victim(pos) {
      var key;
      if (policy === 'LRU') key = function (e) { return e.last; };
      else if (policy === 'MRU') key = function (e) { return -e.last; };
      else if (policy === 'FIFO') key = function (e) { return e.load; };
      else if (policy === 'LFU') key = function (e) { return e.count; };
      else key = function (e) { var j = full.indexOf(e.k, pos + 1); return -(j < 0 ? 1e9 : j); };
      var best = Math.min.apply(null, c.map(key));
      var cands = c.filter(function (e) { return key(e) === best; });
      if (cands.length > 1) { tie = true; cands.sort(function (a, b) { return a.last - b.last; }); }
      return cands[0];
    }
    full.forEach(function (x, pos) {
      if (pos === init.length + hist.length) return;          // Q: stop and decide
      if (pos > init.length + hist.length) return;
      var e = meta(x);
      if (e) { e.last = t; e.count++; }
      else {
        if (c.length === 3) { var v = victim(pos); evicted.push(v.k); c.splice(c.indexOf(v), 1); }
        c.push({ k: x, load: t, last: t, count: 1 });
      }
      t++;
    });
    var v = victim(init.length + hist.length);
    return { victim: v.k, cache: c.map(function (e) { return e.k + ' (loaded ' + e.load + ', last ' + e.last + ', count ' + e.count + ')'; }), tie: tie, evicted: evicted };
  }
  function evict(el) {
    card(el, function () {
      for (;;) {
        var hard = Math.random() < 0.5, init = ['H', 'E', 'G'], pool = hard ? ['H', 'E', 'G', 'W'] : init;
        var n = rint(4, 7), hist = [];
        while (hist.length < n) { var x = pick(pool); if (hist[hist.length - 1] !== x) hist.push(x); }
        if (hard && hist.indexOf('W') < 0) continue;
        var future = []; while (future.length < 4) future.push(pick(['H', 'E', 'G', 'W']));
        var res = {}, bad = false;
        Object.keys(POL).forEach(function (p) { res[p] = evictRun(p, init, hist, 'Q', future); if (res[p].tie) bad = true; });
        if (bad) continue;
        return { q: 'Fully associative, <strong>3 slots</strong>, already holding <strong>H, E, G</strong> (loaded in that order at times 0, 1, 2; each used once). Then: <code>' +
            hist.join(' ') + '</code>, then <strong>Q</strong> misses. Afterwards come <code>' + future.join(' ') + '</code>. Which line does each policy evict for Q?' +
            (hard ? ' <em>W is new, so the cache contents differ between policies by the time Q arrives.</em>' : '') +
            ' <span class="muted">(LFU: counts reset on eviction, ties to LRU.)</span>',
          parts: Object.keys(POL).map(function (p) {
            return { label: POL[p], kind: 'txt', text: res[p].victim,
              how: (res[p].evicted.length ? 'earlier it evicted ' + res[p].evicted.join(', ') + '; ' : '') + 'at Q it holds ' + res[p].cache.join('; ') + '.' };
          }) };
      }
    });
  }

  root.Retake = { worst: worst, dirty: dirty, amdahl: amdahl, loop: loop, mask: mask, evict: evict, worstMisses: worstMisses, beladyMisses: beladyMisses, loopRun: loopRun, evictRun: evictRun };
})(typeof window !== 'undefined' ? window : globalThis);
