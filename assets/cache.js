/* cache.js — cache simulator, coherence model and endless drills for Quiz 3.
 *
 * Pure logic (also usable from node for checking answers):
 *   CacheSim.run(seq, {sets, ways, policy, setOf})  policy: lru | mru | lfu | belady
 *   CacheSim.next(protocol, state, action, othersHaveIt)  action: lr | lw | rr | rw
 *   CacheSim.coreTrace(protocol, ops)
 * Drills (each takes an element; needs quiz.js):
 *   Cache.params  Cache.split  Cache.trace  Cache.access  Cache.amdahl
 *   Cache.write   Cache.stride Cache.coherence  Cache.pairs
 */
(function (root) {
  'use strict';

  /* ---------- simulator ---------- */
  // LFU counts reset when a line is evicted (slides 3.3: C returns with count 1).
  // LFU ties go to the least recently used line.
  function run(seq, o) {
    var sets = o.sets || 1, ways = o.ways, policy = o.policy || 'lru';
    var setOf = o.setOf || function () { return 0; };
    var store = [];
    for (var i = 0; i < sets; i++) store.push([]);
    var rows = [], hits = 0, tick = 0;
    seq.forEach(function (key, pos) {
      tick++;
      var s = store[setOf(key, pos)];
      var found = s.filter(function (e) { return e.key === key; })[0];
      var evicted = null, hit = !!found;
      if (found) { found.count++; found.last = tick; hits++; }
      else {
        if (s.length === ways) {
          var victim = choose(s, policy, seq, pos);
          evicted = victim.key;
          s.splice(s.indexOf(victim), 1);
        }
        s.push({ key: key, count: 1, last: tick });
      }
      rows.push({ key: key, hit: hit, evicted: evicted,
        set: setOf(key, pos),
        contents: s.map(function (e) { return policy === 'lfu' ? e.key + '(' + e.count + ')' : e.key; }).join(' ') });
    });
    return { rows: rows, hits: hits, misses: seq.length - hits };
  }
  function choose(s, policy, seq, pos) {
    var best = s[0];
    s.forEach(function (e) {
      if (policy === 'lru' && e.last < best.last) best = e;
      if (policy === 'mru' && e.last > best.last) best = e;
      if (policy === 'lfu' && (e.count < best.count || (e.count === best.count && e.last < best.last))) best = e;
    });
    if (policy === 'belady') {
      var far = -1;
      s.forEach(function (e) {
        var d = seq.indexOf(e.key, pos + 1);
        if (d < 0) d = Infinity;
        if (d > far) { far = d; best = e; }
      });
    }
    return best;
  }

  /* ---------- coherence, from the course diagrams (slides 3.7, diagramMESI.pdf) ---------- */
  function next(protocol, state, action, othersHaveIt) {
    if (action === 'lw') return 'M';
    if (action === 'rw') return 'I';
    if (action === 'lr') {
      if (state !== 'I') return state;
      return protocol === 'MESI' && !othersHaveIt ? 'E' : 'S';
    }
    // remote read
    if (state === 'I' || state === 'S') return state;
    if (state === 'E') return 'S';
    return protocol === 'MSI' ? 'I' : 'S';   // M: MSI evicts, MESI downgrades
  }
  function coreTrace(protocol, ops) {
    var st = ['I', 'I'], steps = [];
    ops.forEach(function (op) {
      var me = op.core, other = 1 - me;
      var mine = next(protocol, st[me], op.kind === 'R' ? 'lr' : 'lw', st[other] !== 'I');
      var theirs = next(protocol, st[other], op.kind === 'R' ? 'rr' : 'rw', false);
      st[me] = mine; st[other] = theirs;
      steps.push({ op: op, c1: st[0], c2: st[1] });
    });
    return steps;
  }

  var api = { run: run, next: next, coreTrace: coreTrace };
  root.CacheSim = api;
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof document === 'undefined') return;

  /* ---------- drill helpers ---------- */
  function int(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function r2(x) { return Math.round(x * 100) / 100; }
  function log2(x) { return Math.round(Math.log(x) / Math.LN2); }
  function hex(n) { return '0x' + n.toString(16).toUpperCase(); }

  // Numeric multi-part card: build() returns {q, parts:[{label, answer, tol, unit, how}]}
  function card(el, build) {
    var score = { right: 0, total: 0 };
    el.innerHTML = '<div class="quiz drill"></div>';
    var box = el.firstChild;
    function go() {
      var p = build();
      box.classList.remove('done');
      box.innerHTML = '<p class="q">' + p.q + '</p>' + p.parts.map(function (x) {
        return '<p>' + x.label + ' <input type="number" step="any" class="n"> ' + (x.unit || '') + '</p>';
      }).join('') + '<div class="row"><button class="btn chk" type="button">Check</button></div><div class="why"></div>';
      var inputs = box.querySelectorAll('.n');
      function ok(i) { return Math.abs(Number(inputs[i].value) - p.parts[i].answer) <= (p.parts[i].tol || 0) + 1e-9; }
      function check() {
        if (box.classList.contains('done')) return;
        var all = true;
        for (var i = 0; i < inputs.length; i++) { if (inputs[i].value === '') return; if (!ok(i)) all = false; }
        score.total++; if (all) score.right++;
        var why = box.querySelector('.why');
        why.innerHTML = '<ol>' + p.parts.map(function (x, j) {
          return '<li><strong>' + r2(x.answer) + '</strong>' + (ok(j) ? ' ✓' : ' (you said ' + inputs[j].value + ')') + ': ' + x.how + '</li>';
        }).join('') + '</ol><p class="muted">Score: ' + score.right + ' / ' + score.total + '</p><button class="btn nx" type="button">Next problem →</button>';
        root.Quiz.verdict(box, all);
        why.querySelector('.nx').addEventListener('click', go);
      }
      box.querySelector('.chk').addEventListener('click', check);
      inputs.forEach(function (inp) { inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') check(); }); });
    }
    go();
  }

  /* ---------- parameters and address splitting ---------- */
  function params(el) {
    card(el, function () {
      var kb = pick([4, 8, 16, 32, 64, 128]), line = pick([8, 16, 32, 64, 128]), ways = pick([1, 2, 4, 8]), m = pick([32, 40, 48]);
      var slots = kb * 1024 / line, sets = slots / ways, b = log2(line), s = log2(sets);
      return { q: (ways === 1 ? 'Direct-mapped' : ways + '-way set associative') + ', <strong>' + kb + ' KB</strong>, <strong>' + line + '-byte</strong> lines, <strong>' + m + '-bit</strong> addresses.',
        parts: [
          { label: 'Offset bits', answer: b, how: 'log₂(' + line + ').' },
          { label: 'Slots', answer: slots, how: kb * 1024 + ' ÷ ' + line + '.' },
          { label: 'Index bits', answer: s, how: slots + ' slots ÷ ' + ways + ' ways = ' + sets + ' sets, log₂(' + sets + ').' },
          { label: 'Tag bits', answer: m - s - b, how: m + ' − ' + s + ' − ' + b + '.' }
        ] };
    });
  }
  function split(el) {
    card(el, function () {
      var b = int(2, 6), s = int(2, 5), t = int(2, 5), m = b + s + t, a = int(0, Math.pow(2, m) - 1);
      var bin = a.toString(2); while (bin.length < m) bin = '0' + bin;
      var parts = bin.slice(0, t) + ' ' + bin.slice(t, t + s) + ' ' + bin.slice(t + s);
      return { q: 'Address <code>0b' + bin + '</code>. The cache has <strong>' + Math.pow(2, s) + ' sets</strong> and <strong>' + Math.pow(2, b) + '-byte</strong> lines. Give each field in decimal.',
        parts: [
          { label: 'Set number', answer: parseInt(bin.slice(t, t + s), 2), how: 'tag, index, offset = <code>' + parts + '</code>; the index is the middle field (' + s + ' bits).' },
          { label: 'Offset', answer: parseInt(bin.slice(t + s), 2), how: 'the low ' + b + ' bits.' },
          { label: 'Tag', answer: parseInt(bin.slice(0, t), 2), how: 'everything left: the top ' + t + ' bits.' }
        ] };
    });
  }

  /* ---------- hit / miss tracing ---------- */
  var POLICY = { lru: 'LRU', mru: 'MRU', lfu: 'LFU', belady: 'Belady' };
  function traceCard(el, build) {
    var score = { right: 0, total: 0 };
    el.innerHTML = '<div class="quiz drill"></div>';
    var box = el.firstChild;
    function go() {
      var p = build(), res = run(p.seq, p.cfg);
      box.classList.remove('done');
      box.innerHTML = '<p class="q">' + p.q + '</p><p class="muted">Click an access to mark it as a hit. Unmarked accesses count as misses.</p><div class="row trace-seq">' +
        p.seq.map(function (k, i) { return '<button type="button" class="btn ghost hm" data-i="' + i + '">' + (p.show ? p.show(k, i) : k) + '<br><small>M</small></button>'; }).join('') +
        '</div><div class="row" style="margin-top:.6rem"><button class="btn chk" type="button">Check</button></div><div class="why"></div>';
      var btns = box.querySelectorAll('.hm');
      btns.forEach(function (b) {
        b.addEventListener('click', function () {
          if (box.classList.contains('done')) return;
          b.classList.toggle('is-hit');
          b.querySelector('small').textContent = b.classList.contains('is-hit') ? 'H' : 'M';
        });
      });
      box.querySelector('.chk').addEventListener('click', function () {
        if (box.classList.contains('done')) return;
        var wrong = 0;
        res.rows.forEach(function (r, i) { if (btns[i].classList.contains('is-hit') !== r.hit) wrong++; });
        score.total++; if (!wrong) score.right++;
        box.querySelector('.why').innerHTML = '<div class="scroll-x"><table class="trace"><tr><th>#</th><th>Access</th>' + (p.cfg.sets > 1 ? '<th>Set</th>' : '') + '<th>Result</th><th>Evicted</th><th>' + (p.cfg.sets > 1 ? 'That set after' : 'Cache after') + '</th></tr>' +
          res.rows.map(function (r, i) {
            return '<tr' + (btns[i].classList.contains('is-hit') !== r.hit ? ' style="background:var(--bad-soft)"' : '') + '><td>' + (i + 1) + '</td><td><code>' + (p.show ? p.show(r.key, i) : r.key) + '</code></td>' + (p.cfg.sets > 1 ? '<td>' + r.set + '</td>' : '') + '<td>' + (r.hit ? 'Hit' : 'Miss') + '</td><td>' + (r.evicted === null ? '' : (p.showLine ? p.showLine(r.evicted) : r.evicted)) + '</td><td><code>' + (p.showLine ? r.contents.split(' ').map(function (c) { return p.showLine(Number(c)); }).join(' ') : r.contents) + '</code></td></tr>';
          }).join('') + '</table></div><p>Hit rate: <strong>' + res.hits + '/' + p.seq.length + '</strong>. Red rows are the ones you got wrong.</p><p class="muted">Score: ' + score.right + ' / ' + score.total + '</p><button class="btn nx" type="button">Next problem →</button>';
        root.Quiz.verdict(box, !wrong);
        box.querySelector('.nx').addEventListener('click', go);
      });
    }
    go();
  }
  // Letters in a fully associative cache, under a policy from the list.
  function trace(el, policies) {
    traceCard(el, function () {
      var policy = pick(policies || ['lru', 'lfu', 'mru', 'belady']), ways = pick([2, 3]);
      var letters = 'ABCD'.slice(0, ways + int(1, 2)), seq = [];
      var n = 10 + int(0, 2);
      for (var i = 0; i < n; i++) seq.push(i && Math.random() < 0.25 ? seq[i - 1] : letters[int(0, letters.length - 1)]);
      return { seq: seq, cfg: { ways: ways, policy: policy },
        q: 'Fully associative, <strong>' + ways + ' slots</strong>, <strong>' + POLICY[policy] + '</strong>' + (policy === 'lfu' ? ' (counts reset on eviction; ties go to the least recently used)' : '') + '.' };
    });
  }
  // Byte addresses in a direct-mapped or set-associative LRU cache.
  function access(el) {
    traceCard(el, function () {
      var ways = pick([1, 2]), sets = pick([2, 4]), line = pick([8, 16]), lines = [], seq = [], addrs = [];
      for (var i = 0; i < 4; i++) lines.push(int(0, 15));
      for (var j = 0; j < 9; j++) { var l = pick(lines); seq.push(l); addrs.push(l * line + int(0, line - 1)); }
      return { seq: seq,
        cfg: { ways: ways, sets: sets, policy: 'lru', setOf: function (k) { return k % sets; } },
        show: function (k, i) { return hex(addrs[i]); },
        showLine: function (k) { return hex(k * line); },
        q: (ways === 1 ? 'Direct-mapped' : '2-way LRU') + ', <strong>' + sets + ' sets</strong>, <strong>' + line + '-byte</strong> lines. The cache starts empty. Lines are shown by their start address in the answer.' };
    });
  }

  /* ---------- speedup ---------- */
  function amdahl(el) {
    card(el, function () {
      var kind = pick(['amdahl', 'amdahl', 'max', 'avg', 'rate', 'levels']);
      if (kind === 'amdahl') {
        var a = int(2, 9) / 10, k = int(2, 10), T = pick([50, 100, 200]), sp = 1 / ((1 - a) + a / k);
        return { q: 'A program takes <strong>' + T + ' s</strong> and spends <strong>' + a * 100 + '%</strong> of its time in a part you make <strong>' + k + '×</strong> faster. (2 decimals)',
          parts: [{ label: 'Speedup', answer: r2(sp), tol: 0.011, how: '1 / (' + r2(1 - a) + ' + ' + a + '/' + k + ').' },
                  { label: 'New time', unit: 's', answer: r2(T / sp), tol: 0.011, how: T + ' × (' + r2(1 - a) + ' + ' + a + '/' + k + ').' }] };
      }
      if (kind === 'max') {
        var a2 = int(2, 9) / 10;
        return { q: '<strong>' + a2 * 100 + '%</strong> of the runtime can be improved, by any amount. What is the largest possible speedup? (2 decimals)',
          parts: [{ label: 'Speedup limit', answer: r2(1 / (1 - a2)), tol: 0.011, how: 'as k → ∞, a/k → 0, leaving 1 / (1 − a) = 1 / ' + r2(1 - a2) + '.' }] };
      }
      if (kind === 'avg') {
        var h = pick([80, 85, 90, 95, 98]) / 100, c = int(2, 6), d = int(50, 200);
        var av = h * c + (1 - h) * d;
        return { q: 'Hit <strong>' + c + ' ns</strong>, total miss <strong>' + d + ' ns</strong>, hit rate <strong>' + h * 100 + '%</strong>. (2 decimals)',
          parts: [{ label: 'Average access', unit: 'ns', answer: r2(av), tol: 0.011, how: h + ' × ' + c + ' + ' + r2(1 - h) + ' × ' + d + '.' },
                  { label: 'Speedup versus no cache (' + d + ' ns)', answer: r2(d / av), tol: 0.011, how: d + ' ÷ ' + r2(av) + '.' }] };
      }
      if (kind === 'rate') {
        var c3 = int(2, 6), d3 = int(100, 300), s3 = int(3, 9), target = d3 / s3;
        return { q: 'Without a cache a read takes <strong>' + d3 + ' ns</strong>. With one, a hit takes <strong>' + c3 + ' ns</strong> and a total miss takes <strong>' + d3 + ' ns</strong>. What hit rate gives a speedup of <strong>' + s3 + '</strong>? (2 decimals)',
          parts: [{ label: 'Hit rate', answer: r2((d3 - target) / (d3 - c3)), tol: 0.0051, how: 'target average = ' + r2(target) + '; solve ' + c3 + 'h + ' + d3 + '(1 − h) = ' + r2(target) + '.' }] };
      }
      var l1 = int(2, 5), x = int(15, 30), y = int(50, 90), h1 = pick([60, 70, 80, 90]) / 100, h2 = pick([70, 80, 90]) / 100;
      var a1 = x + l1, a4 = y + x + l1;
      return { q: 'L1 hit <strong>' + l1 + ' ns</strong>; L1↔L2 line transfer <strong>' + x + ' ns</strong>; L2↔memory line transfer <strong>' + y + ' ns</strong>. Both caches are write-back.',
        parts: [
          { label: 'Read: L1 miss (clean), L2 hit', unit: 'ns', answer: a1, how: x + ' + ' + l1 + '.' },
          { label: 'Read: L1 miss (dirty), L2 hit', unit: 'ns', answer: x + a1, how: 'write the dirty line down first: ' + x + ' + ' + x + ' + ' + l1 + '.' },
          { label: 'Read: L1 miss (clean), L2 miss (clean)', unit: 'ns', answer: a4, how: y + ' + ' + x + ' + ' + l1 + '.' },
          { label: 'Read: L1 miss (clean), L2 miss (dirty)', unit: 'ns', answer: y + a4, how: 'L2 writes its dirty line to memory first: ' + y + ' + ' + y + ' + ' + x + ' + ' + l1 + '.' },
          { label: 'Average: ' + h1 * 100 + '% L1 hits; of the misses ' + h2 * 100 + '% hit L2; all evictions clean', unit: 'ns', tol: 0.011, answer: r2(h1 * l1 + (1 - h1) * (h2 * a1 + (1 - h2) * a4)), how: h1 + '×' + l1 + ' + ' + r2(1 - h1) + '×(' + h2 + '×' + a1 + ' + ' + r2(1 - h2) + '×' + a4 + ').' }
        ] };
    });
  }

  /* ---------- write policies ---------- */
  function write(el) {
    card(el, function () {
      var c = int(1, 5), d = int(10, 40), combo = pick(['WT-NWA', 'WT-WA', 'WB-NWA', 'WB-WA', 'even']);
      var head = 'Cache <strong>' + c + ' ns</strong>, source <strong>' + d + ' ns</strong> (parallel writes do not add). ';
      if (combo === 'WT-NWA') return { q: head + '<strong>Write-through, no-write-allocate.</strong>', parts: [
        { label: 'Write hit', unit: 'ns', answer: d, how: 'the source write hides the cache write.' },
        { label: 'Write miss', unit: 'ns', answer: d, how: 'just write to the source; the cache is unchanged.' }] };
      if (combo === 'WT-WA') return { q: head + '<strong>Write-through, write-allocate.</strong>', parts: [
        { label: 'Write hit', unit: 'ns', answer: d, how: 'the source write hides the cache write.' },
        { label: 'Write miss', unit: 'ns', answer: 2 * d, how: 'one source write + one source read of the line: ' + d + ' + ' + d + '.' }] };
      if (combo === 'WB-NWA') return { q: head + '<strong>Write-back, no-write-allocate.</strong>', parts: [
        { label: 'Write hit', unit: 'ns', answer: c, how: 'cache only; set the dirty bit.' },
        { label: 'Write miss', unit: 'ns', answer: c + d, how: 'discover the miss, then write the source: ' + c + ' + ' + d + '.' }] };
      if (combo === 'WB-WA') return { q: head + '<strong>Write-back, write-allocate.</strong>', parts: [
        { label: 'Write hit', unit: 'ns', answer: c, how: 'cache only; set the dirty bit.' },
        { label: 'Write miss, clean line evicted', unit: 'ns', answer: c + d, how: 'read the line, write the cache: ' + d + ' + ' + c + '.' },
        { label: 'Write miss, dirty line evicted', unit: 'ns', answer: c + 2 * d, how: 'write back, read the line, write the cache: ' + d + ' + ' + d + ' + ' + c + '.' }] };
      var wbh = int(2, 6), wbm = int(14, 30), wt = int(wbh + 1, wbm - 1);
      return { q: 'Write-back, write-allocate: hit <strong>' + wbh + '</strong> cycles, miss with a clean eviction <strong>' + wbm + '</strong> cycles. Write-through, no-write-allocate: every write takes <strong>' + wt + '</strong> cycles. At what write hit rate are the averages equal? (2 decimals)',
        parts: [{ label: 'Hit rate', answer: r2((wbm - wt) / (wbm - wbh)), tol: 0.0051, how: 'solve ' + wbh + 'h + ' + wbm + '(1 − h) = ' + wt + ', so h = ' + (wbm - wt) + '/' + (wbm - wbh) + '.' }] };
    });
  }

  /* ---------- stride ---------- */
  function stride(el) {
    card(el, function () {
      if (Math.random() < 0.4) {
        var lineR = pick([32, 64]), elem = pick([4, 8]), rows = pick([64, 128]), cols = pick([64, 128]);
        return { q: 'C array <code>' + (elem === 4 ? 'int' : 'double') + ' a[' + rows + '][' + cols + ']</code>, ' + lineR + '-byte lines.',
          parts: [
            { label: 'Stride in bytes for a row-by-row loop (<code>a[r][c]</code>, inner loop on c)', answer: elem, how: 'C is row-major, so neighbours in a row are adjacent.' },
            { label: 'Stride in bytes for a column-by-column loop (inner loop on r)', answer: elem * cols, how: 'one whole row apart: ' + cols + ' × ' + elem + '.' }
          ] };
      }
      var line = pick([16, 32, 64, 128]), s = pick([1, 2, 4, 8, 16, 32, 64, 128, 256]), bytes = pick([1024, 4096, 8192]);
      var acc = Math.ceil(bytes / s), miss = 0, seen = {};
      for (var a = 0; a < bytes; a += s) { var ln = Math.floor(a / line); if (!seen[ln]) { seen[ln] = 1; miss++; } }
      return { q: 'A <strong>' + bytes + '-byte</strong> array, line-aligned, read once at a stride of <strong>' + s + ' bytes</strong> with <strong>' + line + '-byte</strong> lines. The cache starts empty and is big enough to hold the array.',
        parts: [
          { label: 'Accesses', answer: acc, how: bytes + ' ÷ ' + s + '.' },
          { label: 'Misses', answer: miss, how: s < line ? 'one per line touched: ' + bytes + ' ÷ ' + line + '.' : 'the stride is at least one line, so every access lands in a new line.' },
          { label: 'Hit rate (2 decimals)', answer: r2((acc - miss) / acc), tol: 0.0051, how: '(' + acc + ' − ' + miss + ') ÷ ' + acc + '.' }
        ] };
    });
  }

  /* ---------- coherence ---------- */
  var ACT = { lr: 'a local read', lw: 'a local write', rr: 'a remote read', rw: 'a remote write' };
  var WHY = {
    'MSI M rr': 'in the course MSI diagram, a remote read or write sends M to I, with a write-back.',
    'MESI M rr': 'write back, then downgrade to shared. This is the course MESI edge M → S.',
    'E rr': 'someone else now has a copy, so this is no longer exclusive. No write-back is needed because E is clean.',
    'M rw': 'write back, then invalidate.', 'E rw': 'invalidate. E is clean, so no write-back.', 'S rw': 'the remote writer sent an invalidate.',
    'E lw': 'this is the point of E: go to M silently, with no message.', 'S lw': 'must send an invalidate first.', 'I lw': 'write miss: fetch the line and send an invalidate.',
    'I lr': 'read miss.'
  };
  function coherence(el) {
    var score = { right: 0, total: 0 };
    el.innerHTML = '<div class="quiz drill"></div>';
    var box = el.firstChild;
    function go() {
      var proto = pick(['MSI', 'MESI', 'MESI']), states = proto === 'MSI' ? ['M', 'S', 'I'] : ['M', 'E', 'S', 'I'];
      var st = pick(states), act = pick(['lr', 'lw', 'rr', 'rw']), others = Math.random() < 0.5;
      var ans = next(proto, st, act, others);
      var extra = st === 'I' && act === 'lr' ? (others ? ' Another cache already holds this line.' : ' No other cache holds this line.') : '';
      box.classList.remove('done');
      box.innerHTML = '<p class="q">' + proto + ': this cache\'s line is in state <strong>' + st + '</strong>. It sees <strong>' + ACT[act] + '</strong>.' + extra + ' What is the new state?</p><ol class="opts">' +
        states.map(function (s) { return '<li><button type="button">' + s + '</button></li>'; }).join('') + '</ol><div class="why"></div>';
      box.querySelectorAll('.opts button').forEach(function (b) {
        b.addEventListener('click', function () {
          if (box.classList.contains('done')) return;
          var good = b.textContent === ans;
          score.total++; if (good) score.right++;
          box.querySelectorAll('.opts button').forEach(function (x) { if (x.textContent === ans) x.classList.add('right'); });
          if (!good) b.classList.add('wrong');
          var note = WHY[proto + ' ' + st + ' ' + act] || WHY[st + ' ' + act] || 'no change of state.';
          box.querySelector('.why').innerHTML = '<p><strong>' + st + ' → ' + ans + ':</strong> ' + note + '</p><p class="muted">Score: ' + score.right + ' / ' + score.total + '</p><button class="btn nx" type="button">Next problem →</button>';
          root.Quiz.verdict(box, good);
          box.querySelector('.nx').addEventListener('click', go);
        });
      });
    }
    go();
  }
  function pairs(el) {
    var score = { right: 0, total: 0 };
    el.innerHTML = '<div class="quiz drill"></div>';
    var box = el.firstChild;
    function go() {
      var proto = pick(['MSI', 'MESI', 'MESI']), ops = [], n = int(2, 4);
      for (var i = 0; i < n; i++) ops.push({ core: int(0, 1), kind: pick(['R', 'R', 'W']) });
      var steps = coreTrace(proto, ops), end = steps[n - 1];
      var states = proto === 'MSI' ? ['M', 'S', 'I'] : ['M', 'E', 'S', 'I'];
      var sel = function (id) { return '<select class="' + id + '">' + states.map(function (s) { return '<option>' + s + '</option>'; }).join('') + '</select>'; };
      var txt = function (o) { return 'Core ' + (o.core + 1) + (o.kind === 'R' ? ' reads' : ' writes'); };
      box.classList.remove('done');
      box.innerHTML = '<p class="q">' + proto + ', one line, both cores start in I:</p><ol>' + ops.map(function (o) { return '<li>' + txt(o) + '</li>'; }).join('') + '</ol><p>Final state: Core 1 ' + sel('a') + ' Core 2 ' + sel('b') + '</p><div class="row"><button class="btn chk" type="button">Check</button></div><div class="why"></div>';
      box.querySelector('.chk').addEventListener('click', function () {
        if (box.classList.contains('done')) return;
        var good = box.querySelector('.a').value === end.c1 && box.querySelector('.b').value === end.c2;
        score.total++; if (good) score.right++;
        box.querySelector('.why').innerHTML = '<table class="trace"><tr><th>Step</th><th>Core 1</th><th>Core 2</th></tr>' + steps.map(function (s) { return '<tr><td>' + txt(s.op) + '</td><td>' + s.c1 + '</td><td>' + s.c2 + '</td></tr>'; }).join('') + '</table><p class="muted">Score: ' + score.right + ' / ' + score.total + '</p><button class="btn nx" type="button">Next problem →</button>';
        root.Quiz.verdict(box, good);
        box.querySelector('.nx').addEventListener('click', go);
      });
    }
    go();
  }

  root.Cache = { params: params, split: split, trace: trace, access: access, amdahl: amdahl, write: write, stride: stride, coherence: coherence, pairs: pairs };
})(typeof window !== 'undefined' ? window : globalThis);
