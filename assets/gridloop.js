/* gridloop.js — see a 2D-array loop walk through cache lines.
 *
 * Grid.explore(el)  Step through a loop you configure. The grid shows line boundaries,
 *                   access order, and a running H/M count with a one-line reason per step.
 * Grid.drill(el)    A random loop. Click every access that MISSES, then check.
 * Grid.run(cfg)     -> { E, acc: [{r,c,line,miss}], misses, hits } (for testing)
 *
 * cfg: { elem: 4|8, line: bytes, W: row width of the array (16), N: loop bound,
 *        order: 'row' (a[i][j], j inner) | 'col' (a[j][i]... i.e. walk down columns),
 *        shape: 'full' | 'from' (inner starts at outer) | 'upto' (inner stops at outer),
 *        step: 1 | 2 }
 * The array is assumed to fit in the cache, so every miss is a cold miss (first touch of a line).
 * Needs quiz.js (Quiz.verdict).
 */
(function (root) {
  'use strict';
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  var css = '' +
    '.gl-wrap{overflow-x:auto;margin:.6rem 0}' +
    '.gl{border-collapse:collapse;font-family:var(--mono);font-size:.8rem}' +
    '.gl th{color:var(--muted);font-weight:normal;padding:0 .35rem}' +
    '.gl td{width:2.6rem;height:2.3rem;text-align:center;border:1px solid var(--rule);position:relative;cursor:default}' +
    '.gl td.na{color:var(--muted);opacity:.45}' +
    '.gl td.acc{cursor:pointer}' +
    '.gl td.l0{background:var(--st-F)}.gl td.l1{background:var(--st-E)}' +
    '.gl td.ls{border-left:3px solid var(--ink)}' +
    '.gl td .o{position:absolute;top:1px;left:3px;font-size:.62rem;color:var(--muted)}' +
    '.gl td .hm{font-weight:bold}' +
    '.gl td.cur{outline:3px solid var(--accent);outline-offset:-3px}' +
    '.gl td.mk{background:var(--accent-soft)}' +
    '.gl td.ok{box-shadow:inset 0 0 0 3px var(--good)}.gl td.bad{box-shadow:inset 0 0 0 3px var(--bad)}' +
    '.gl-log{font-family:var(--mono);font-size:.85rem;min-height:1.4em}' +
    '.gl-ctl{display:flex;flex-wrap:wrap;gap:.4rem .8rem;align-items:center;margin:.4rem 0}' +
    '.gl-ctl select{font:inherit;font-size:.9rem;padding:.15rem .3rem;background:var(--panel);color:var(--ink);border:1px solid var(--rule);border-radius:4px}';
  if (typeof document !== 'undefined' && !document.getElementById('gl-css')) {
    var s = document.createElement('style'); s.id = 'gl-css'; s.textContent = css; document.head.appendChild(s);
  }

  function run(cfg) {
    var E = cfg.line / cfg.elem, acc = [], seen = {}, N = cfg.N, W = cfg.W || 16;
    function visit(r, c) {
      var line = Math.floor((W * r + c) / E), miss = !seen[line];
      seen[line] = 1; acc.push({ r: r, c: c, line: line, miss: miss });
    }
    for (var o = 0; o < N; o++) {
      var lo = cfg.shape === 'from' ? o : 0, hi = cfg.shape === 'upto' ? o : N - 1;
      for (var k = lo; k <= hi; k += cfg.step) {
        if (cfg.order === 'row') visit(o, k); else visit(k, o);
      }
    }
    var m = acc.filter(function (a) { return a.miss; }).length;
    return { E: E, acc: acc, misses: m, hits: acc.length - m };
  }

  function code(cfg) {
    var t = cfg.elem === 8 ? 'double' : 'int';
    var lo = cfg.shape === 'from' ? 'i' : '0', cond = cfg.shape === 'upto' ? 'j &lt;= i' : 'j &lt; ' + cfg.N;
    var inc = cfg.step === 1 ? 'j++' : 'j += 2';
    var body = cfg.order === 'row' ? 'sum += a[i][j];' : 'sum += a[j][i];';
    return t + ' a[16][16];   // line-aligned, ' + cfg.line + '-byte lines\n' +
      'for (i = 0; i &lt; ' + cfg.N + '; i++)\n    for (j = ' + lo + '; ' + cond + '; ' + inc + ')\n        ' + body;
  }

  // Draws the N×N corner of the array the loop touches.
  function grid(cfg, res, opts) {
    var N = cfg.N, idx = {}, h = '<div class="gl-wrap"><table class="gl"><tr><th></th>';
    res.acc.forEach(function (a, n) { idx[a.r + ',' + a.c] = n; });
    for (var c = 0; c < N; c++) h += '<th>[' + c + ']</th>';
    h += '</tr>';
    for (var r = 0; r < N; r++) {
      h += '<tr><th>[' + r + ']</th>';
      for (c = 0; c < N; c++) {
        var key = r + ',' + c, n = idx[key], line = Math.floor((16 * r + c) / res.E);
        var cls = [];
        if (opts.lines) { cls.push('l' + (line % 2)); if ((16 * r + c) % res.E === 0 && c > 0) cls.push('ls'); }
        if (n === undefined) cls.push('na'); else cls.push('acc');
        h += '<td class="' + cls.join(' ') + '" data-k="' + key + '">' +
          (n === undefined ? '—' : '<span class="o">' + (n + 1) + '</span><span class="hm"></span>') + '</td>';
      }
      h += '</tr>';
    }
    return h + '</table></div>';
  }

  /* ---------- explorer ---------- */
  function explore(el) {
    el.innerHTML = '<div class="quiz drill">' +
      '<div class="gl-ctl">' +
      '<label>type <select data-f="elem"><option value="8">double (8)</option><option value="4">int (4)</option></select></label>' +
      '<label>line <select data-f="line"><option>8</option><option selected>16</option><option>32</option><option>64</option></select> bytes</label>' +
      '<label>walk <select data-f="order"><option value="row">row by row a[i][j]</option><option value="col">column by column a[j][i]</option></select></label>' +
      '<label>shape <select data-f="shape"><option value="full">square</option><option value="from" selected>triangle: j starts at i</option><option value="upto">triangle: j stops at i</option></select></label>' +
      '<label>step <select data-f="step"><option value="1">j++</option><option value="2">j += 2</option></select></label>' +
      '<label>N <select data-f="N"><option>4</option><option>8</option></select></label>' +
      '</div><pre><code class="gl-code"></code></pre><div class="gl-grid"></div>' +
      '<p class="gl-log"></p><p class="gl-count muted"></p>' +
      '<div class="row"><button class="btn st" type="button">Step →</button> <button class="btn ghost all" type="button">Run all</button> <button class="btn ghost rs" type="button">Reset</button></div></div>';
    var box = el.firstChild, cfg, res, pos;
    function read() {
      cfg = { W: 16 };
      box.querySelectorAll('select').forEach(function (s) { cfg[s.dataset.f] = s.dataset.f === 'order' || s.dataset.f === 'shape' ? s.value : Number(s.value); });
      res = run(cfg); pos = 0;
      box.querySelector('.gl-code').innerHTML = code(cfg);
      box.querySelector('.gl-grid').innerHTML = grid(cfg, res, { lines: true });
      box.querySelector('.gl-log').innerHTML = 'E = ' + cfg.line + ' ÷ ' + cfg.elem + ' = <strong>' + res.E + '</strong> elements per line. Shaded blocks are lines; a thick bar starts a new line. Numbers show the access order.';
      count();
    }
    function cell(a) { return box.querySelector('td[data-k="' + a.r + ',' + a.c + '"]'); }
    function count() {
      var m = 0; for (var i = 0; i < pos; i++) if (res.acc[i].miss) m++;
      box.querySelector('.gl-count').textContent = 'Accesses ' + pos + ' / ' + res.acc.length + ' · misses ' + m + ' · hits ' + (pos - m) +
        (pos === res.acc.length ? '  —  done. Misses = number of different lines touched.' : '');
    }
    function step() {
      if (pos >= res.acc.length) return;
      box.querySelectorAll('td.cur').forEach(function (t) { t.classList.remove('cur'); });
      var a = res.acc[pos], td = cell(a);
      td.classList.add('cur'); td.querySelector('.hm').textContent = a.miss ? 'M' : 'H';
      var el16 = 16 * a.r + a.c;
      box.querySelector('.gl-log').innerHTML = 'a[' + a.r + '][' + a.c + '] = element 16·' + a.r + ' + ' + a.c + ' = ' + el16 +
        ' → line ⌊' + el16 + '/' + res.E + '⌋ = ' + a.line + ' → ' + (a.miss ? '<strong>first touch of that line: MISS</strong>' : 'line already loaded: hit');
      pos++; count();
    }
    box.querySelectorAll('select').forEach(function (s) { s.addEventListener('change', read); });
    box.querySelector('.st').addEventListener('click', step);
    box.querySelector('.all').addEventListener('click', function () { while (pos < res.acc.length) step(); });
    box.querySelector('.rs').addEventListener('click', read);
    read();
  }

  /* ---------- drill: click the misses ---------- */
  function drill(el, opts) {
    opts = opts || {};
    var score = { right: 0, total: 0 };
    el.innerHTML = '<div class="quiz drill"></div>';
    var box = el.firstChild;
    function go() {
      var cfg = { W: 16, elem: pick([4, 8]), line: pick([8, 16, 16, 32]), N: pick([4, 4, 8]),
        order: opts.order || pick(['row', 'row', 'col']), shape: pick(['full', 'from', 'from', 'upto']), step: pick([1, 1, 1, 2]) };
      if (cfg.line / cfg.elem < 1) cfg.line = 16;
      var res = run(cfg);
      box.classList.remove('done');
      box.innerHTML = '<p class="q">Cold cache, and the array fits, so every miss is a first touch. <code>sum</code> is in a register. ' +
        '<strong>Click every access that misses</strong> (numbers show the access order), then fill in the totals.</p>' +
        '<pre><code>' + code(cfg) + '</code></pre>' + grid(cfg, res, { lines: false }) +
        '<p>Elements per line <input type="number" class="n e"> &nbsp; Misses <input type="number" class="n m"> &nbsp; Hits <input type="number" class="n h"></p>' +
        '<div class="row"><button class="btn chk" type="button">Check</button></div><div class="why"></div>';
      box.querySelectorAll('td.acc').forEach(function (td) {
        td.addEventListener('click', function () {
          if (box.classList.contains('done')) return;
          td.classList.toggle('mk'); td.querySelector('.hm').textContent = td.classList.contains('mk') ? 'M' : '';
        });
      });
      box.querySelector('.chk').addEventListener('click', function () {
        if (box.classList.contains('done')) return;
        var e = box.querySelector('.e').value, m = box.querySelector('.m').value, hh = box.querySelector('.h').value;
        if (e === '' || m === '' || hh === '') return;
        var cellsOk = true;
        // redraw with line shading, keep the student's marks
        var marked = {};
        box.querySelectorAll('td.mk').forEach(function (td) { marked[td.dataset.k] = 1; });
        var g = box.querySelector('.gl-wrap'); g.outerHTML = grid(cfg, res, { lines: true });
        res.acc.forEach(function (a) {
          var k = a.r + ',' + a.c, td = box.querySelector('td[data-k="' + k + '"]'), said = !!marked[k];
          td.querySelector('.hm').textContent = a.miss ? 'M' : 'H';
          if (said !== a.miss) { cellsOk = false; td.classList.add('bad'); } else if (said) td.classList.add('ok');
        });
        var all = cellsOk && Number(e) === res.E && Number(m) === res.misses && Number(hh) === res.hits;
        score.total++; if (all) score.right++;
        var why = box.querySelector('.why');
        why.innerHTML = '<ol>' +
          '<li><strong>E = ' + res.E + '</strong>' + (Number(e) === res.E ? ' ✓' : ' (you said ' + e + ')') + ': ' + cfg.line + ' ÷ ' + cfg.elem + '. The shading now shows each line; a thick bar starts a new one.</li>' +
          '<li><strong>' + res.misses + ' misses</strong>' + (Number(m) === res.misses ? ' ✓' : ' (you said ' + m + ')') + ': count the shaded blocks that contain at least one numbered cell.</li>' +
          '<li><strong>' + res.hits + ' hits</strong>' + (Number(hh) === res.hits ? ' ✓' : ' (you said ' + hh + ')') + ': ' + res.acc.length + ' accesses − ' + res.misses + ' misses.</li>' +
          '<li>Cells: ' + (cellsOk ? 'all marked right ✓' : 'red outlines are cells you marked wrong. In each line, the miss is the cell with the <em>smallest</em> access number.') + '</li>' +
          '</ol><p class="muted">Score: ' + score.right + ' / ' + score.total + '</p><button class="btn nx" type="button">Next loop →</button>';
        root.Quiz.verdict(box, all);
        why.querySelector('.nx').addEventListener('click', go);
      });
    }
    go();
  }

  root.Grid = { run: run, explore: explore, drill: drill, code: code };
})(typeof window !== 'undefined' ? window : globalThis);
