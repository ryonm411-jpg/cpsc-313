/* codewrite.js — "write the code yourself" practice problems.
 *
 * Each problem gives a spec, an editable Y86 editor, and a "Run & check" button that
 *   (1) prepends a per-test input/data section to the student's code,
 *   (2) runs it through the Y86 interpreter (assets/y86pipe.js),
 *   (3) checks a result register or memory word against the expected value for several inputs,
 *   (4) on success, shows how the code behaves in the pipeline (instructions / bubbles / CPI).
 *
 * CodeWrite.problem(container, spec) where spec = {
 *   prompt:   HTML, the task,
 *   given:    HTML, describes the inputs/registers the student can assume,
 *   setup:    function(vars) -> Y86 source prepended before the student's code (sets inputs, lays data),
 *   starter:  string, initial editor contents (a skeleton — labels, ret, TODO),
 *   tests:    [ { vars:{...}, want:<number|bigint>, label:<string> } ],
 *   check:    function(res, vars) -> { got:<bigint>, want:<bigint> }   // reads res.reg(name) / res.word(i)
 *   solution: string, a reference implementation,
 *   predict:  optional predictor for the pipeline read-out (default 'btfnt'),
 *   maxSteps: optional cap,
 * }
 * Depends on window.Y86.
 */
(function (root) {
  'use strict';
  var Y86 = root.Y86;

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function big(x) { return typeof x === 'bigint' ? x : BigInt(x); }

  function decorate(res) {
    res.reg = function (name) { return res.regs[name] === undefined ? 0n : res.regs[name]; };
    res.word = function (i) { var a = 0x8000n + big(i) * 8n; return res.mem.has(a) ? res.mem.get(a) : 0n; };
    return res;
  }

  function runOne(spec, userCode, vars) {
    var src = spec.setup(vars) + '\n' + userCode;
    var prog = Y86.parse(src);                       // may throw on a syntax error
    var res = decorate(Y86.simulate(prog, { forwarding: true, predict: spec.predict || 'btfnt', maxSteps: spec.maxSteps || 4000 }));
    var stopped = res.notes.some(function (n) { return /Stopped after/.test(n); });
    return { res: res, src: src, stopped: stopped };
  }

  function problem(container, spec) {
    container.classList.add('cw');
    container.appendChild(el('div', 'cw-prompt', spec.prompt));
    if (spec.given) container.appendChild(el('div', 'callout cw-given', '<span class="label">What you\'re given</span>' + spec.given));

    var ta = el('textarea', 'cw-editor');
    ta.spellcheck = false; ta.rows = Math.max(6, (spec.starter.match(/\n/g) || []).length + 2);
    ta.value = spec.starter;
    container.appendChild(ta);

    var bar = el('div', 'row');
    var runBtn = el('button', 'btn', 'Run &amp; check');
    var solBtn = el('button', 'btn ghost', 'Show solution');
    var resetBtn = el('button', 'btn ghost', 'Reset');
    bar.appendChild(runBtn); bar.appendChild(solBtn); bar.appendChild(resetBtn);
    container.appendChild(bar);

    var out = el('div', 'cw-out'); container.appendChild(out);
    var sol = el('div', 'cw-sol'); sol.style.display = 'none'; container.appendChild(sol);

    resetBtn.addEventListener('click', function () { ta.value = spec.starter; out.innerHTML = ''; });

    solBtn.addEventListener('click', function () {
      if (sol.style.display === 'none') {
        sol.innerHTML = '';
        sol.appendChild(el('p', 'muted', 'One correct solution (there are many — yours is right if it passes all cases):'));
        var pre = el('pre', 'bd'); pre.appendChild(el('code', null)); pre.firstChild.textContent = spec.solution.trim();
        sol.appendChild(pre);
        var load = el('button', 'btn ghost', 'Load into editor');
        load.addEventListener('click', function () { ta.value = spec.solution.trim(); });
        sol.appendChild(load);
        sol.style.display = 'block'; solBtn.textContent = 'Hide solution';
      } else { sol.style.display = 'none'; solBtn.textContent = 'Show solution'; }
    });

    runBtn.addEventListener('click', function () {
      out.innerHTML = '';
      var userCode = ta.value;
      var allPass = true, firstRes = null;
      var list = el('div', 'cw-cases');
      spec.tests.forEach(function (t) {
        var row = el('div', 'cw-case');
        try {
          var r = runOne(spec, userCode, t.vars);
          if (!firstRes) firstRes = r.res;
          if (r.stopped) {
            allPass = false; row.className = 'cw-case no';
            row.innerHTML = '<span class="tag">✕</span> ' + t.label + ' — ran too long (likely an infinite loop — check your exit condition)';
          } else {
            var c = spec.check(r.res, t.vars);
            var ok = big(c.got) === big(c.want);
            if (!ok) allPass = false;
            row.className = 'cw-case ' + (ok ? 'ok' : 'no');
            row.innerHTML = '<span class="tag">' + (ok ? '✓' : '✕') + '</span> ' + t.label +
              ' — expected <code>' + c.want + '</code>, got <code>' + c.got + '</code>';
          }
        } catch (err) {
          allPass = false; row.className = 'cw-case no';
          row.innerHTML = '<span class="tag">✕</span> ' + t.label + ' — <strong>error:</strong> ' + String(err.message || err);
        }
        list.appendChild(row);
      });
      out.appendChild(list);

      var verdict = el('p', 'verdict ' + (allPass ? 'ok' : 'no'),
        allPass ? 'All cases pass. Nice — now read the pipeline behaviour below.' : 'Not yet — fix the failing case(s) and run again.');
      out.appendChild(verdict);

      if (allPass && firstRes) {
        var r = firstRes;
        var pipe = el('div', 'callout key');
        pipe.appendChild(el('span', 'label', 'How your code runs in the pipeline (forwarding on, ' + (spec.predict || 'btfnt') + ')'));
        pipe.appendChild(el('p', null,
          '<strong>' + r.instructions + '</strong> instructions · ' +
          '<strong>' + r.lost + '</strong> bubbles (' + r.dataStalls + ' data, ' + r.controlStalls + ' control-stall, ' + r.squashed + ' squashed) · ' +
          '<strong>' + r.cycles + '</strong> cycles · CPI ≈ <strong>' + (Math.round(r.cpi * 100) / 100) + '</strong>'));
        var sm = Y86.summary(r);
        if (sm.length) { var ul = el('ul'); sm.forEach(function (s) { ul.appendChild(el('li', null, s)); }); pipe.appendChild(ul); }
        var det = el('details'); det.appendChild(el('summary', null, 'Show the stage diagram'));
        var dg = el('div'); Y86.render(dg, r, { maxRows: 60 }); det.appendChild(dg);
        pipe.appendChild(det);
        out.appendChild(pipe);
      }
    });
  }

  root.CodeWrite = { problem: problem };
})(window);
