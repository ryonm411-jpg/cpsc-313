/* reorder.js — "shuffle these lettered instructions" checker, built on y86pipe.js.
 *
 *   Reorder.mount(el, {
 *     instrs: { A: 'irmovq 0x123, %rax', ... },   // original order = key order
 *     regs: ['rax', 'rbx'],                        // registers that define "the same result"
 *     forwarding: false                            // initial setting (user can toggle)
 *   })
 *
 * The learner types an order like "BACDEFGH"; the widget reports bubbles, whether the
 * result still matches the original, and draws the pipeline. "Show the minimum" brute-forces
 * every ordering (fine for ≤ 8 instructions).
 */
(function (root) {
  'use strict';
  var Y = root.Y86;

  function esc(s) { return s.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }

  function mount(el, cfg) {
    var letters = Object.keys(cfg.instrs);
    var original = letters.join('');
    var best = {};   // forwarding flag -> fewest bubbles found by the learner

    el.innerHTML =
      '<div class="quiz drill">' +
      '<ol class="reorder-list" style="list-style:none;padding:0;font-family:var(--mono);font-size:.85rem;margin:0 0 .8rem">' +
      letters.map(function (k) { return '<li><strong>' + k + '.</strong> ' + esc(cfg.instrs[k]) + '</li>'; }).join('') +
      '</ol>' +
      '<div class="row">' +
      '<input type="text" class="ord" spellcheck="false" autocomplete="off" value="' + original + '" style="width:9rem;font-family:var(--mono);letter-spacing:.12em;text-transform:uppercase">' +
      '<label><input type="checkbox" class="f"' + (cfg.forwarding ? ' checked' : '') + '> forwarding</label>' +
      '<button class="btn run" type="button">Run</button>' +
      '<button class="btn ghost min" type="button">Show the minimum</button>' +
      '</div><div class="out" style="margin-top:.8rem"></div></div>';

    var input = el.querySelector('.ord'), out = el.querySelector('.out'), fbox = el.querySelector('.f');

    function program(order) { return order.split('').map(function (c) { return cfg.instrs[c]; }).join('\n'); }
    function run(order, fwd) { return Y.simulate(Y.parse(program(order)), { forwarding: fwd }); }
    function sig(r) { return cfg.regs.map(function (k) { return String(r.regs[k]); }).join(','); }
    var want = {};
    [true, false].forEach(function (f) { want[f] = run(original, f); });

    function go() {
      var order = input.value.toUpperCase().replace(/\s+/g, '');
      var fwd = fbox.checked;
      var sorted = order.split('').sort().join('');
      if (sorted !== letters.slice().sort().join('')) {
        out.innerHTML = '<p class="verdict no">Use each of ' + letters.join(' ') + ' exactly once.</p>';
        return;
      }
      var res = run(order, fwd);
      var same = sig(res) === sig(want[fwd]);
      if (same && (best[fwd] === undefined || res.dataStalls < best[fwd])) best[fwd] = res.dataStalls;
      out.innerHTML =
        '<p><strong>' + res.dataStalls + '</strong> bubble' + (res.dataStalls === 1 ? '' : 's') +
        ' (' + (fwd ? 'with' : 'no') + ' forwarding) · ' + res.cycles + ' cycles total</p>' +
        '<p class="verdict ' + (same ? 'ok' : 'no') + '">' +
        (same ? 'Same final registers as the original.'
              : 'Different result! Some instruction now reads a register before (or after) the write it depended on.') + '</p>' +
        (best[fwd] !== undefined ? '<p class="muted">Your best legal order so far: ' + best[fwd] + ' bubbles.</p>' : '') +
        '<div class="diagram"></div>';
      Y.render(out.querySelector('.diagram'), res);
    }

    function minimum() {
      var fwd = fbox.checked, target = sig(want[fwd]), bestN = Infinity, winners = [];
      (function perm(prefix, rest) {
        if (!rest.length) {
          var r = run(prefix, fwd);
          if (sig(r) !== target) return;
          if (r.dataStalls < bestN) { bestN = r.dataStalls; winners = []; }
          if (r.dataStalls === bestN) winners.push(prefix);
          return;
        }
        for (var i = 0; i < rest.length; i++) perm(prefix + rest[i], rest.slice(0, i) + rest.slice(i + 1));
      })('', original);
      out.innerHTML = '<p>Minimum ' + (fwd ? 'with' : 'without') + ' forwarding: <strong>' + bestN + '</strong> bubbles. ' +
        winners.length + ' legal orders reach it, e.g. <code>' + winners.slice(0, 4).join('</code>, <code>') + '</code>.</p>';
    }

    el.querySelector('.run').addEventListener('click', go);
    el.querySelector('.min').addEventListener('click', function () {
      if (!confirm('Reveal the minimum? Try for it yourself first. It is the whole point.')) return;
      minimum();
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    fbox.addEventListener('change', go);
    go();
  }

  root.Reorder = { mount: mount };
})(window);
