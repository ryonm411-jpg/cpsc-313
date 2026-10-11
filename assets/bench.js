/* bench.js — a "lab notebook" for comparing versions of one y86 function, built on y86pipe.js.
 *
 *   Bench.mount(el, {
 *     driver: function (src) { return 'main: ...\n' + src + '\narray: .quad ...'; },  // wraps a version
 *     check:  function (res) { return res.regs.rax === 55n; },                      // correctness test
 *     checkLabel: 'returns 55',
 *     versions: [{ name: 'given', src: '...' }],    // starting versions
 *     storageKey: 'bench-sum'                        // remembers edits in this browser (optional)
 *   })
 *
 * Every version runs through the same driver with the chosen forwarding / prediction setting,
 * and the table reports instructions, bubbles, CPI, cycles and speed-up vs the first row.
 */
(function (root) {
  'use strict';
  var Y = root.Y86;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function load(key) {
    if (!key) return null;
    try { var v = JSON.parse(localStorage.getItem(key)); return Array.isArray(v) ? v : null; } catch (e) { return null; }
  }
  function save(key, versions) {
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify(versions)); } catch (e) { /* private window etc. */ }
  }

  function mount(el, cfg) {
    var versions = load(cfg.storageKey) || cfg.versions.map(function (v) { return { name: v.name, src: v.src }; });

    el.innerHTML =
      '<div class="row no-print" style="margin-bottom:.6rem">' +
      '<label><input type="checkbox" class="f" checked> forwarding</label>' +
      '<label>Prediction <select class="p"><option value="btfnt">BTFNT</option><option value="never">never taken</option>' +
      '<option value="always">always taken</option><option value="none">none</option></select></label>' +
      '<button class="btn ghost add" type="button">+ Add version</button>' +
      '<button class="btn ghost reset" type="button">Reset to starting versions</button></div>' +
      '<div class="cards"></div><div class="table-scroll"><table class="data results"></table></div><div class="detail"></div>';

    var cards = el.querySelector('.cards');

    function drawCards() {
      cards.innerHTML = '';
      versions.forEach(function (v, i) {
        var d = document.createElement('details');
        d.className = 'bench-card';
        d.open = i === versions.length - 1;
        d.innerHTML =
          '<summary><input type="text" class="nm" value="' + esc(v.name) + '" style="font:inherit;font-weight:600;border:0;background:transparent;color:var(--ink);width:70%"></summary>' +
          '<textarea class="src" spellcheck="false" style="width:100%;min-height:15rem;font-family:var(--mono);font-size:.82rem;background:var(--code-bg);color:var(--ink);border:1px solid var(--rule);border-radius:4px;padding:.6rem"></textarea>' +
          '<div class="row"><button class="btn ghost dup" type="button">Duplicate as new version</button>' +
          (versions.length > 1 ? '<button class="btn ghost del" type="button">Delete</button>' : '') + '</div>';
        d.querySelector('.src').value = v.src;
        d.querySelector('.src').addEventListener('input', function (e) { v.src = e.target.value; changed(); });
        d.querySelector('.nm').addEventListener('input', function (e) { v.name = e.target.value; changed(); });
        d.querySelector('.nm').addEventListener('click', function (e) { e.preventDefault(); });
        d.querySelector('.nm').addEventListener('keydown', function (e) { if (e.key === ' ') e.stopPropagation(); });
        d.querySelector('.dup').addEventListener('click', function () {
          versions.push({ name: v.name + ' (v' + (versions.length + 1) + ')', src: v.src }); drawCards(); changed();
        });
        var del = d.querySelector('.del');
        if (del) del.addEventListener('click', function () { versions.splice(i, 1); drawCards(); changed(); });
        cards.appendChild(d);
      });
    }

    var timer;
    function changed() { save(cfg.storageKey, versions); clearTimeout(timer); timer = setTimeout(table, 250); }

    function table() {
      var fwd = el.querySelector('.f').checked, pred = el.querySelector('.p').value;
      var rows = versions.map(function (v) {
        try {
          var res = Y.simulate(Y.parse(cfg.driver(v.src)), { forwarding: fwd, predict: pred });
          return { v: v, res: res, ok: cfg.check(res) };
        } catch (e) { return { v: v, err: e.message }; }
      });
      var base = rows[0] && rows[0].res ? rows[0].res.cycles : null;
      var t = el.querySelector('.results');
      t.innerHTML = '<tr><th>version</th><th>' + esc(cfg.checkLabel || 'correct') + '</th><th>instr.</th><th>bubbles</th><th>CPI</th><th>cycles</th><th>speed-up</th><th></th></tr>';
      rows.forEach(function (r, i) {
        var tr = document.createElement('tr');
        if (r.err) {
          tr.innerHTML = '<td>' + esc(r.v.name) + '</td><td colspan="7" class="verdict no">' + esc(r.err) + '</td>';
        } else {
          var s = r.res;
          tr.innerHTML = '<td>' + esc(r.v.name) + '</td>' +
            '<td>' + (r.ok ? '<span class="verdict ok">✓</span>' : '<span class="verdict no">✗ wrong</span>') + '</td>' +
            '<td>' + s.instructions + '</td>' +
            '<td>' + s.lost + ' <span class="muted">(' + s.dataStalls + 'd ' + s.controlStalls + 'c ' + s.squashed + 's)</span></td>' +
            '<td>' + s.cpi.toFixed(2) + '</td><td><strong>' + s.cycles + '</strong></td>' +
            '<td>' + (base ? (base / s.cycles).toFixed(2) + '×' : '') + '</td>' +
            '<td><button class="btn ghost why" type="button" style="font-size:.8rem;padding:.15rem .5rem">stalls</button></td>';
          tr.querySelector('.why').addEventListener('click', function () { detail(r); });
        }
        t.appendChild(tr);
      });
    }

    function detail(r) {
      var d = el.querySelector('.detail');
      var lines = Y.summary(r.res);
      d.innerHTML = '<h3>Where “' + esc(r.v.name) + '” loses cycles</h3>' +
        (lines.length ? '<ul>' + lines.map(function (l) { return '<li><code>' + esc(l.split(' — ')[0]) + '</code> — ' + esc(l.split(' — ').slice(1).join(' — ')) + '</li>'; }).join('') + '</ul>'
                      : '<p>No bubbles at all.</p>') +
        '<p class="muted">d = data stalls · c = control stalls (ret / unpredicted jXX) · s = squashed by a misprediction. ' +
        'Cycles include the 4 cycles to fill the pipeline.</p><div class="diagram"></div>';
      Y.render(d.querySelector('.diagram'), r.res, { maxRows: 60 });
    }

    el.querySelector('.add').addEventListener('click', function () {
      versions.push({ name: 'version ' + (versions.length + 1), src: versions[versions.length - 1].src }); drawCards(); changed();
    });
    el.querySelector('.reset').addEventListener('click', function () {
      if (!confirm('Discard your versions and go back to the starting ones?')) return;
      versions = cfg.versions.map(function (v) { return { name: v.name, src: v.src }; }); drawCards(); changed();
    });
    el.querySelectorAll('select, input[type=checkbox]').forEach(function (s) { s.addEventListener('change', table); });
    drawCards();
    table();
  }

  root.Bench = { mount: mount };
})(window);
