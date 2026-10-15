/* perf.js — endless numeric drills for pipeline performance (CS:APP §4.4.1–4.4.3, §4.5.9).
 *
 *   Perf.timing(el)  register latency + stage delays → SEQ/PIPE latency (ps) and throughput (GIPS).
 *   Perf.cpi(el)     instruction-mix word problem → CPI = 1 + Σ frequency × penalty.
 *
 * Needs quiz.js (Quiz.verdict). Styling comes from course.css (.quiz, .row, .btn).
 */
(function (root) {
  'use strict';

  function int(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function r2(x) { return Math.round(x * 100) / 100; }
  function trim(x) { return String(Math.round(x * 1e6) / 1e6); }

  // A card with numeric inputs [{label, answer, tol, unit}] and a step-by-step explanation.
  function card(el, score, build) {
    el.innerHTML = '<div class="quiz drill"></div>';
    var box = el.firstChild;
    function next() {
      var p = build();
      box.classList.remove('done');
      box.innerHTML = '<p class="q">' + p.q + '</p>' +
        p.parts.map(function (x, i) {
          return '<p>' + x.label + ' <input type="number" step="any" class="n" data-i="' + i + '"> ' + (x.unit || '') + '</p>';
        }).join('') +
        '<div class="row"><button class="btn chk" type="button">Check</button></div><div class="why"></div>';
      var inputs = box.querySelectorAll('.n');
      function check() {
        if (box.classList.contains('done')) return;
        var ok = true, empty = false;
        inputs.forEach(function (inp, i) {
          if (inp.value === '') empty = true;
          else if (Math.abs(Number(inp.value) - p.parts[i].answer) > (p.parts[i].tol || 0) + 1e-9) ok = false;
        });
        if (empty) return;
        score.total++; if (ok) score.right++;
        var why = box.querySelector('.why');
        why.innerHTML = '<ol>' + p.parts.map(function (x, i) {
          var mine = Number(inputs[i].value), good = Math.abs(mine - x.answer) <= (x.tol || 0) + 1e-9;
          return '<li><strong>' + trim(x.answer) + '</strong> ' + (x.unit || '') + (good ? ' ✓' : ' (you said ' + inputs[i].value + ')') +
            ': ' + x.how + '</li>';
        }).join('') + '</ol><p class="muted">Score: ' + score.right + ' / ' + score.total + '</p>' +
          '<button class="btn nx" type="button">Next problem →</button>';
        root.Quiz.verdict(box, ok);
        why.querySelector('.nx').addEventListener('click', next);
      }
      box.querySelector('.chk').addEventListener('click', check);
      inputs.forEach(function (inp) { inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') check(); }); });
    }
    next();
  }

  function timing(el) {
    card(el, { right: 0, total: 0 }, function () {
      var reg = int(10, 30), k = int(3, 6), uniform = Math.random() < 0.6, stages = [];
      if (uniform) { var d = int(5, 20) * 10; for (var i = 0; i < k; i++) stages.push(d); }
      else for (var j = 0; j < k; j++) stages.push(int(5, 20) * 10);
      var sum = stages.reduce(function (a, b) { return a + b; }, 0);
      var mx = Math.max.apply(null, stages), cyc = mx + reg;
      var q = 'Register latency <strong>' + reg + ' ps</strong>. ' +
        (uniform ? k + ' stages, each <strong>' + stages[0] + ' ps</strong>.'
                 : k + ' stages taking <strong>' + stages.join(', ') + ' ps</strong>.') +
        ' Throughput to 2 decimal places.';
      return { q: q, parts: [
        { label: 'SEQ latency', unit: 'ps', answer: sum + reg,
          how: 'one big block of logic + one register: ' + sum + ' + ' + reg + '.' },
        { label: 'SEQ throughput', unit: 'GIPS', answer: r2(1000 / (sum + reg)), tol: 0.005,
          how: '1000 / ' + (sum + reg) + ' (one instruction per ' + (sum + reg) + ' ps; 1000/ps = GIPS).' },
        { label: 'PIPE latency', unit: 'ps', answer: k * cyc,
          how: k + ' stages × clock ' + cyc + ' ps (clock = slowest stage ' + mx + ' + register ' + reg + ').' },
        { label: 'PIPE throughput', unit: 'GIPS', answer: r2(1000 / cyc), tol: 0.005,
          how: 'one instruction retires every clock: 1000 / ' + cyc + '.' }
      ] };
    });
  }

  function cpi(el) {
    card(el, { right: 0, total: 0 }, function () {
      var br = int(5, 25), cond = int(40, 90), lu = int(5, 25), ret = pick([0, 0, int(1, 5)]);
      var predicted = Math.random() < 0.4, miss = int(20, 50);
      var condF = br / 100 * cond / 100;
      var brPen = predicted ? condF * miss / 100 * 2 : condF * 2;
      var ans = 1 + lu / 100 + brPen + ret / 100 * 3;
      var q = 'Forwarding is on. ' + br + '% of instructions are branches, and ' + cond + '% of the branches are conditional. ' +
        lu + '% of instructions have a data hazard forwarding cannot avoid. ' +
        (ret ? ret + '% of instructions are <code>ret</code>. ' : 'There are no returns. ') +
        (predicted ? 'Branch prediction is used, and ' + miss + '% of conditional branches are mispredicted.' : 'There is no branch prediction.') +
        ' Ignore pipeline fill.';
      return { q: q, parts: [{ label: 'CPI', answer: Math.round(ans * 1e6) / 1e6, tol: 0.0005,
        how: '1 + ' + trim(lu / 100) + ' (load/use × 1) + ' + trim(brPen) + ' (' + trim(condF) + ' conditional' +
          (predicted ? ' × ' + trim(miss / 100) + ' mispredicted' : '') + ' × 2)' +
          (ret ? ' + ' + trim(ret / 100 * 3) + ' (ret × 3)' : '') + '. Unconditional jmp/call cost 0.' }] };
    });
  }

  root.Perf = { timing: timing, cpi: cpi };
})(this);
