/* workout.js — I11 / peer-problem style whole-program pipeline counting.
 *
 *   Workout.generate(rng)   -> { src, lines }   a 12–25 line loop program (I11.1 / I11.2 / I11.4 / P10.2 shapes)
 *   Workout.solve(src, opts) -> answers + course-style breakdown ("[Line 9] … 2 stalls due to data hazard on %rdi (8 times)")
 *   Workout.problem(el)     the drill: taken count, data stalls, control stalls, squashed, instructions, CPI.
 *
 * CPI follows slides 2.5: CPI = (instructions + 4 to fill the pipeline + bubbles) / instructions,
 * counting the final halt (71/37, 43/37 on the slides). Needs y86pipe.js and quiz.js.
 */
(function (root) {
  'use strict';
  var Y = root.Y86 || (typeof require !== 'undefined' ? require('./y86pipe.js') : null);

  var PREDICT_LABEL = {
    none: 'no branch prediction (stall on every conditional jump)', never: 'predict never taken',
    always: 'predict always taken', btfnt: 'predict backward taken, forward not taken',
    ftbnt: 'predict forward taken, backward not taken'
  };

  function shuffle(a, rng) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  // ------------------------------------------------------------------ generator
  function generate(rng) {
    rng = rng || Math.random;
    var pick = function (a) { return a[Math.floor(rng() * a.length)]; };
    var int = function (lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); };
    var regs = shuffle(['rax', 'rbx', 'rcx', 'rdx', 'rsi', 'rdi', 'rbp', 'r8', 'r9', 'r10', 'r11', 'r12', 'r13', 'r14'], rng);
    var c = regs[0], s = regs[1], t = regs[2], lim = regs[3], w1 = regs[4], w2 = regs[5], p = regs[6], e = regs[7];
    var N = int(3, 8);
    var shape = pick(['bottom', 'top', 'countup']);
    var useArray = shape === 'top' ? rng() < 0.75 : rng() < 0.3;
    var setup = [], body = [], data = [];

    // ---- loop work: never touches the control registers
    var work = [];
    if (useArray) {
      setup.push('irmovq    list, %' + p, 'irmovq    $8, %' + e);
      for (var d = 0; d < N + 2; d++) data.push(pick([-9, -4, -1, 0, 2, 3, 5, 7, 10, 13]));
      work.push('mrmovq    0(%' + p + '), %' + w2);
      if (shape === 'top' && rng() < 0.6) {
        // P10.2-style inner if: a forward branch on the loaded value
        work.push('andq    %' + w2 + ', %' + w2, pick(['jle', 'jl', 'je']) + '    skip', 'addq    %' + w2 + ', %' + w1, 'skip:');
      } else {
        work.push(pick(['addq', 'xorq', 'subq']) + '    %' + w2 + ', %' + w1);
        if (rng() < 0.4) work.push('rrmovq    %' + w1 + ', %' + t);
      }
      work.push('addq    %' + e + ', %' + p);
    } else {
      var k = int(1, 3);
      for (var i = 0; i < k; i++) {
        var r = rng();
        if (r < 0.35) work.push(pick(['addq', 'xorq', 'mulq']) + '    %' + c + ', %' + w1);
        else if (r < 0.6) work.push('rrmovq    %' + c + ', %' + w2);
        else if (r < 0.8) work.push(pick(['addq', 'subq']) + '    %' + w2 + ', %' + w1);
        else work.push('irmovq    $' + int(2, 9) + ', %' + w2);
      }
    }

    var loopLabel = 'loop_start', endLabel = 'loop_end';
    if (shape === 'bottom') {
      // I11.1: count down, backward conditional jump at the bottom
      setup.push('irmovq    $' + N + ', %' + c, 'irmovq    $1, %' + s);
      body = work.slice();
      if (rng() < 0.5) {
        setup.push('irmovq    $1, %' + lim);
        body.push('rrmovq    %' + c + ', %' + t, 'subq    %' + s + ', %' + c, 'subq    %' + lim + ', %' + t, 'jg    ' + loopLabel);
      } else {
        body.push('subq    %' + s + ', %' + c, pick(['jg', 'jne']) + '    ' + loopLabel);
      }
    } else if (shape === 'top') {
      // I11.4 / P10.2: test at the top, forward exit, jmp back
      setup.push('irmovq    $' + N + ', %' + c, 'irmovq    $1, %' + s);
      body = ['andq    %' + c + ', %' + c, 'je    ' + endLabel].concat(work, ['subq    %' + s + ', %' + c, 'jmp    ' + loopLabel]);
    } else {
      // I11.2: count up, compare against a limit, forward exit + jmp back
      var start = int(0, 2);
      setup.push('irmovq    $' + start + ', %' + c, 'irmovq    $' + (start + N) + ', %' + lim, 'irmovq    $1, %' + s);
      body = work.concat(['addq    %' + s + ', %' + c, 'rrmovq    %' + lim + ', %' + t, 'subq    %' + c + ', %' + t,
        'jle    ' + endLabel, 'jmp    ' + loopLabel]);
    }
    shuffle(setup, rng);

    // ---- tail after the loop (I11.1 / I11.2 style), with its own hazards
    var tail = [], recent = [w1, t];
    var pool = [w1, w2, t, regs[8], regs[9], regs[10], regs[11]];
    var nt = int(2, 5);
    for (var j = 0; j < nt; j++) {
      var dst = pick(pool), src = rng() < 0.5 ? pick(recent) : pick(pool), x = rng(), line;
      if (x < 0.35) line = pick(['addq', 'subq', 'xorq', 'mulq']) + '   %' + src + ', %' + dst;
      else if (x < 0.55) line = 'rrmovq   %' + src + ', %' + dst;
      else if (x < 0.7) line = 'mrmovq   ' + int(0, 4) * 8 + '(%' + src + '), %' + dst;
      else if (x < 0.85) line = 'popq   %' + dst;
      else { line = 'pushq   %' + src; dst = null; }
      tail.push(line);
      if (dst) recent = [dst];
    }

    var out = [''];
    setup.forEach(function (l) { out.push('    ' + l); });
    out.push('', loopLabel + ':');
    body.forEach(function (l) { out.push(/:$/.test(l) ? l : '    ' + l); });
    out.push('', endLabel + ':');
    tail.forEach(function (l) { out.push('    ' + l); });
    out.push('    halt');
    if (data.length) {
      out.push('', '    .pos    0x2000', 'list:');
      data.forEach(function (v) { out.push('    .quad    ' + v); });
    }
    return out.join('\n');
  }

  // ------------------------------------------------------------------ solver
  // Map instruction index -> 1-based source line (same rules as Y86.parse).
  function lineMap(src) {
    var map = [];
    src.split(/\r?\n/).forEach(function (raw, i) {
      var line = raw.replace(/#.*$/, '').trim().replace(/^([A-Za-z_.][\w.]*\s*:\s*)+/, '');
      if (line && line[0] !== '.') map.push(i + 1);
    });
    return map;
  }

  function solve(src, opts) {
    var prog = Y.parse(src);
    var res = Y.simulate(prog, { forwarding: opts.forwarding, predict: opts.predict, rsp: 0x1000 });
    var map = lineMap(src);
    var jumps = {}, perLine = {};
    res.events.forEach(function (ev) {
      if (ev.taken !== undefined) {
        jumps[ev.idx] = jumps[ev.idx] || { taken: 0, notTaken: 0 };
        jumps[ev.idx][ev.taken ? 'taken' : 'notTaken']++;
      }
      if (ev.kind === 'ok') return;
      var key = ev.kind + '|' + ev.cycles + '|' + (ev.reg || '');
      var L = perLine[ev.idx] = perLine[ev.idx] || { text: ev.at, order: [], groups: {} };
      if (!L.groups[key]) { L.groups[key] = { ev: ev, n: 0 }; L.order.push(key); }
      L.groups[key].n++;
    });
    var breakdown = Object.keys(perLine).map(Number).sort(function (a, b) { return a - b; }).map(function (idx) {
      var L = perLine[idx];
      return {
        line: map[idx] || '(end)', text: L.text,
        items: L.order.map(function (k) {
          var g = L.groups[k], ev = g.ev, what;
          if (ev.kind === 'data') what = ev.cycles + ' stall' + (ev.cycles > 1 ? 's' : '') + ' due to data hazard on %' + ev.reg;
          else if (ev.kind === 'squash') what = '2 squashes due to branch prediction failure';
          else what = ev.cycles + ' stalls due to control hazard (' + (ev.taken === undefined ? 'ret' : ev.taken ? 'taken' : 'not taken') + ')';
          return what + (g.n > 1 ? ' (' + g.n + ' times)' : '');
        })
      };
    });
    var condIdx = prog.instrs.filter(function (x) { return /^j(le|l|e|ne|ge|g)$/.test(x.op); }).map(function (x) { return x.idx; });
    var bubbles = res.dataStalls + res.controlStalls + res.squashed;
    return {
      res: res, prog: prog, map: map, jumps: jumps, condIdx: condIdx, breakdown: breakdown,
      dataStalls: res.dataStalls, controlStalls: res.controlStalls, squashed: res.squashed,
      instructions: res.instructions, cycles: res.instructions + 4 + bubbles,
      cpi: (res.instructions + 4 + bubbles) / res.instructions,
      halted: !res.notes.some(function (n) { return /Stopped after/.test(n); })
    };
  }

  // ------------------------------------------------------------------ drill
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }

  function parseNum(v) {
    v = String(v).trim();
    var m = v.match(/^(-?[\d.]+)\s*\/\s*([\d.]+)$/);
    return m ? Number(m[1]) / Number(m[2]) : v === '' ? NaN : Number(v);
  }

  function problem(el) {
    var score = { right: 0, total: 0, streak: 0 };
    el.innerHTML =
      '<div class="row no-print" style="margin-bottom:.6rem">' +
      '<label>Forwarding <select class="f"><option value="rand">random</option><option value="0">no (stalling only)</option><option value="1">yes</option></select></label> ' +
      '<label>Prediction <select class="p"><option value="rand">random</option><option value="none">none</option><option value="never">never taken</option><option value="always">always taken</option><option value="btfnt">BTFNT</option><option value="ftbnt">FTBNT</option></select></label>' +
      '</div><div class="quiz drill"></div>';
    var card = el.querySelector('.quiz');

    function next() {
      var fsel = el.querySelector('.f').value, psel = el.querySelector('.p').value;
      var fwd = fsel === 'rand' ? Math.random() < 0.5 : fsel === '1';
      var pred = psel === 'rand' ? ['none', 'never', 'always', 'btfnt', 'ftbnt'][Math.floor(Math.random() * 5)] : psel;
      var src, sol, tries = 0;
      do { src = generate(); sol = solve(src, { forwarding: fwd, predict: pred }); } while (!sol.halted && ++tries < 20);
      var jIdx = sol.condIdx[sol.condIdx.length > 1 && Math.random() < 0.5 ? 1 : 0];
      var jLine = sol.map[jIdx];
      var jt = sol.jumps[jIdx] || { taken: 0, notTaken: 0 };
      var lines = src.split('\n');
      var listing = lines.map(function (l, i) { return (i + 1) + ':' + (i + 1 < 10 ? '    ' : '   ') + esc(l); }).join('\n');

      var qs = [
        { label: 'How many times is the jump on line ' + jLine + ' <em>taken</em>?', ans: jt.taken },
        { label: 'Stall cycles due to <strong>data</strong> hazards?', ans: sol.dataStalls },
        { label: 'Stall cycles due to <strong>control</strong> hazards?', ans: sol.controlStalls },
        { label: 'Instructions <strong>squashed</strong>?', ans: sol.squashed },
        { label: 'Instructions executed (count the <code>halt</code>, not squashed ones)?', ans: sol.instructions },
        { label: 'CPI? (a fraction like <code>69/42</code> is fine)', ans: sol.cpi, cpi: true }
      ];
      card.classList.remove('done');
      card.innerHTML =
        '<p class="q">Pipelined y86, <em>' + (fwd ? 'with forwarding' : 'no forwarding (stalling)') + '</em>, <em>' + PREDICT_LABEL[pred] + '</em>. Registers start at 0.</p>' +
        '<pre><code>' + listing + '</code></pre>' +
        '<ol class="wk">' + qs.map(function (q, i) {
          return '<li><span>' + q.label + '</span> <input type="text" inputmode="decimal" size="7" data-i="' + i + '"> <span class="mark"></span></li>';
        }).join('') + '</ol>' +
        '<div class="row"><button class="btn chk" type="button">Check all</button></div><div class="why"></div>';
      var inputs = card.querySelectorAll('input');

      function check() {
        if (card.classList.contains('done')) return;
        var allOk = true;
        inputs.forEach(function (inp, i) {
          var q = qs[i], v = parseNum(inp.value);
          var ok = q.cpi ? Math.abs(v - q.ans) < 0.0051 : v === q.ans;
          if (!ok) allOk = false;
          var m = inp.parentNode.querySelector('.mark');
          m.className = 'mark ' + (ok ? 'ok' : 'no');
          m.textContent = ok ? '✓' : '✗ ' + (q.cpi ? sol.cycles + '/' + sol.instructions + ' ≈ ' + q.ans.toFixed(3) : q.ans);
        });
        score.total++;
        if (allOk) { score.right++; score.streak++; } else score.streak = 0;
        var why = card.querySelector('.why');
        var bd = sol.breakdown.length ? '<pre class="bd"><code>' + sol.breakdown.map(function (b) {
          return '[Line ' + b.line + '] ' + esc(b.text) + '\n' + b.items.map(function (x) { return '    ' + esc(x); }).join('\n');
        }).join('\n') + '</code></pre>' : '<p>No stalls and no squashes at all.</p>';
        var jumpsTxt = sol.condIdx.map(function (ix) {
          var j = sol.jumps[ix] || { taken: 0, notTaken: 0 };
          return 'line ' + sol.map[ix] + ' (<code>' + esc(sol.prog.instrs[ix].text) + '</code>): taken ' + j.taken + ', not taken ' + j.notTaken;
        }).join('; ');
        why.innerHTML =
          '<p><strong>Branch outcomes.</strong> ' + jumpsTxt + '.</p>' +
          '<p><strong>Breakdown</strong>, in the course answer-key format:</p>' + bd +
          '<p><strong>Total.</strong> cycles = ' + sol.instructions + ' instructions + 4 to fill + ' + sol.dataStalls + ' data + ' + sol.controlStalls +
          ' control + ' + sol.squashed + ' squashed = <strong>' + sol.cycles + '</strong>. CPI = ' + sol.cycles + '/' + sol.instructions + ' ≈ <strong>' + sol.cpi.toFixed(3) + '</strong>.</p>' +
          '<details><summary>Show the pipeline diagram</summary><div class="diagram"></div></details>' +
          '<p class="muted">All six right: ' + score.right + ' / ' + score.total + ' · streak ' + score.streak + '</p>' +
          '<button class="btn nx" type="button">Next program →</button>';
        Y.render(why.querySelector('.diagram'), sol.res);
        if (root.Quiz) root.Quiz.verdict(card, allOk);
        why.querySelector('.nx').addEventListener('click', next);
      }
      card.querySelector('.chk').addEventListener('click', check);
      inputs.forEach(function (inp) { inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') check(); }); });
    }
    el.querySelectorAll('select').forEach(function (s) { s.addEventListener('change', next); });
    next();
  }

  var api = { generate: generate, solve: solve, problem: problem, lineMap: lineMap };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Workout = api;
})(this);
