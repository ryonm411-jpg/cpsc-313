/* drills.js — endless, auto-checked practice built on y86pipe.js + quiz.js.
 *
 *   Drill.forwarding(el)  "Where does the consumer get its operand, and how many stalls?"
 *   Drill.lostCycles(el)  "How many cycles are lost to stalls + squashes?" (I10-style)
 *   Drill.sandbox(el)     paste any y86 snippet, pick a configuration, see the diagram.
 */
(function (root) {
  'use strict';
  var Y = root.Y86;

  function h(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function esc(s) { return s.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }

  var LEGEND = '<p class="legend">Shaded <span class="sw" style="background:var(--hold)"></span>cells = the instruction is held (stalled) in that stage. ' +
    'Struck-through rows = squashed (wrong-path) instructions.</p>';

  var PREDICT_LABEL = {
    none: 'no branch prediction', never: 'predict never taken',
    always: 'predict always taken', btfnt: 'predict backward taken, forward not taken',
    ftbnt: 'predict forward taken, backward not taken'
  };

  // ------------------------------------------------------------------ forwarding drill
  var SOURCES = ['e_valE', 'M_valE', 'W_valE', 'm_valM', 'W_valM', 'register file'];

  function forwarding(el) {
    var score = { right: 0, total: 0 };
    el.innerHTML = '';
    var card = h('<div class="quiz drill"></div>');
    el.appendChild(card);

    function next() {
      var fwd = Math.random() < 0.75;
      var reg = pick(['rbx', 'rcx', 'rdx', 'rsi']);
      var producers = [
        'addq %rax, %' + reg, 'subq %r8, %' + reg, 'irmovq $42, %' + reg, 'rrmovq %rdi, %' + reg,
        'mrmovq 8(%rbp), %' + reg, 'popq %' + reg
      ];
      var prod = pick(producers);
      var dist = 1 + Math.floor(Math.random() * 4);
      var fillers = ['nop', 'irmovq $5, %r9', 'xorq %r10, %r11', 'rrmovq %r12, %r13'];
      var lines = [prod];
      for (var i = 1; i < dist; i++) lines.push(pick(fillers));
      var cons = pick(['addq %' + reg + ', %r14', 'subq %' + reg + ', %r14', 'rmmovq %' + reg + ', 0(%r14)', 'rrmovq %' + reg + ', %r14']);
      lines.push(cons);
      var res = Y.simulate(Y.parse(lines.join('\n')), { forwarding: fwd, predict: 'none' });
      var last = res.rows[lines.length - 1];   // consumer row (rows also include the implicit halt)
      var m = (last.fwd[0] || '').match(/← (\w+)/);
      var src = m ? m[1] : 'register file';
      var stalls = res.dataStalls;

      card.classList.remove('done');
      card.innerHTML =
        '<p class="q">' + (fwd ? 'With forwarding' : '<em>No</em> forwarding (stall only)') +
        ': the last instruction reads <code>%' + reg + '</code>.</p>' +
        '<pre><code>' + esc(lines.join('\n')) + '</code></pre>' +
        (fwd ? '<p>1. Where does it get <code>%' + reg + '</code>?</p><ol class="opts src"></ol>' : '') +
        '<p>' + (fwd ? '2. ' : '') + 'How many stall cycles?</p>' +
        '<div class="row"><input type="number" min="0" class="n"> <button class="btn chk" type="button">Check</button></div>' +
        '<div class="why"></div>';
      var chosen = null;
      if (fwd) {
        var ol = card.querySelector('.src');
        SOURCES.forEach(function (s) {
          var li = document.createElement('li');
          var b = document.createElement('button');
          b.type = 'button'; b.innerHTML = '<code>' + s + '</code>';
          b.addEventListener('click', function () {
            if (card.classList.contains('done')) return;
            ol.querySelectorAll('button').forEach(function (x) { x.classList.remove('picked'); });
            b.classList.add('picked'); chosen = s;
          });
          b.dataset.src = s;
          li.appendChild(b); ol.appendChild(li);
        });
      }
      var input = card.querySelector('.n');
      function check() {
        if (card.classList.contains('done') || input.value === '' || (fwd && !chosen)) return;
        var okN = Number(input.value) === stalls;
        var okS = !fwd || chosen === src;
        if (fwd) card.querySelectorAll('.src button').forEach(function (b) {
          if (b.dataset.src === src) b.classList.add('right');
          else if (b.dataset.src === chosen) b.classList.add('wrong');
        });
        score.total++; if (okN && okS) score.right++;
        var why = card.querySelector('.why');
        var isLoad = /^(mrmovq|popq)/.test(prod);
        why.innerHTML =
          '<p>' + (fwd ? 'Source: <strong><code>' + src + '</code></strong>. ' : '') +
          'Stalls: <strong>' + stalls + '</strong>. ' +
          'The value comes from ' + (isLoad ? 'memory (valM — ready at the <em>end of Memory</em>)' : 'the ALU (valE — ready at the <em>end of Execute</em>)') +
          '; distance = ' + dist + '.</p><div class="diagram"></div>' + LEGEND +
          '<p class="muted">Score: ' + score.right + ' / ' + score.total + '</p>' +
          '<button class="btn nx" type="button">Next problem →</button>';
        Y.render(why.querySelector('.diagram'), res);
        root.Quiz.verdict(card, okN && okS);
        why.querySelector('.nx').addEventListener('click', next);
      }
      card.querySelector('.chk').addEventListener('click', check);
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') check(); });
    }
    next();
  }

  // ------------------------------------------------------------------ lost-cycles drill
  function lostCycles(el, opts) {
    opts = opts || {};
    var score = { right: 0, total: 0 };
    el.innerHTML =
      '<div class="row no-print" style="margin-bottom:.6rem">' +
      '<label>Forwarding <select class="f"><option value="rand">random</option><option value="1">on</option><option value="0">off</option></select></label>' +
      '<label>Prediction <select class="p"><option value="rand">random</option><option value="none">none</option><option value="never">never taken</option><option value="always">always taken</option><option value="btfnt">BTFNT</option><option value="ftbnt">FTBNT (reverse)</option></select></label>' +
      '<label>Shape <select class="k"><option value="rand">random</option><option value="if">if (I10-style)</option><option value="loop">loop (P9.2-style)</option></select></label>' +
      '</div><div class="quiz drill"></div>';
    var card = el.querySelector('.quiz');
    ['f', 'p', 'k'].forEach(function (c) { if (opts[c]) el.querySelector('.' + c).value = opts[c]; });

    function next() {
      var fsel = el.querySelector('.f').value, psel = el.querySelector('.p').value, ksel = el.querySelector('.k').value;
      var fwd = fsel === 'rand' ? Math.random() < 0.6 : fsel === '1';
      var pred = psel === 'rand' ? pick(['none', 'never', 'always', 'btfnt']) : psel;
      var kind = ksel === 'rand' ? (Math.random() < 0.7 ? 'if' : 'loop') : ksel;
      var src = Y.randomProgram(kind);
      var res = Y.simulate(Y.parse(src), { forwarding: fwd, predict: pred });

      card.classList.remove('done');
      card.innerHTML =
        '<p class="q">Pipelined y86, <em>' + (fwd ? 'with' : 'no') + ' forwarding</em>, <em>' + PREDICT_LABEL[pred] + '</em>. ' +
        'In total, for how many cycles will the pipeline stall or execute instructions that get squashed?</p>' +
        '<pre><code>' + esc(src) + '</code></pre>' +
        '<p class="muted">Registers start at 0. Trace the values first — you need the real branch outcome.</p>' +
        '<div class="row"><input type="number" min="0" class="n"> <button class="btn chk" type="button">Check</button></div>' +
        '<div class="why"></div>';
      var input = card.querySelector('.n');
      function check() {
        if (card.classList.contains('done') || input.value === '') return;
        var ok = Number(input.value) === res.lost;
        score.total++; if (ok) score.right++;
        var why = card.querySelector('.why');
        var lines = Y.summary(res);
        why.innerHTML =
          '<p>Answer: <strong>' + res.lost + '</strong> = ' + res.dataStalls + ' data-stall + ' +
          res.controlStalls + ' control-stall + ' + res.squashed + ' squashed.</p>' +
          (lines.length ? '<ul>' + lines.map(function (l) { return '<li><code>' + esc(l.split(' — ')[0]) + '</code> — ' + esc(l.split(' — ').slice(1).join(' — ')) + '</li>'; }).join('') + '</ul>' : '<p>No hazards cost anything here.</p>') +
          (res.notes.length ? '<p class="muted">' + res.notes.map(esc).join('<br>') + '</p>' : '') +
          '<p class="muted">' + res.instructions + ' instructions (incl. halt) · CPI = (' + res.instructions + ' + 4 fill + ' + res.lost + ') / ' + res.instructions + ' ≈ ' + ((res.instructions + 4 + res.lost) / res.instructions).toFixed(2) + ' (slides 2.5 count the 4 fill cycles)</p>' +
          '<div class="diagram"></div>' + LEGEND +
          '<p class="muted">Score: ' + score.right + ' / ' + score.total + '</p>' +
          '<button class="btn nx" type="button">Next problem →</button>';
        Y.render(why.querySelector('.diagram'), res);
        root.Quiz.verdict(card, ok);
        why.querySelector('.nx').addEventListener('click', next);
      }
      card.querySelector('.chk').addEventListener('click', check);
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') check(); });
    }
    el.querySelectorAll('select').forEach(function (s) { s.addEventListener('change', next); });
    next();
  }

  // ------------------------------------------------------------------ sandbox
  function sandbox(el, initial) {
    el.innerHTML =
      '<textarea class="src" spellcheck="false" style="width:100%;min-height:14rem;font-family:var(--mono);font-size:.85rem;background:var(--code-bg);color:var(--ink);border:1px solid var(--rule);border-radius:4px;padding:.6rem"></textarea>' +
      '<div class="row" style="margin:.5rem 0">' +
      '<label><input type="checkbox" class="f" checked> forwarding</label>' +
      '<label>Prediction <select class="p"><option value="none">none</option><option value="never">never taken</option><option value="always">always taken</option><option value="btfnt">BTFNT</option><option value="ftbnt">FTBNT (reverse)</option></select></label>' +
      '<button class="btn run" type="button">Run</button></div><div class="out"></div>';
    var ta = el.querySelector('.src');
    ta.value = initial || '';
    function run() {
      var out = el.querySelector('.out');
      try {
        var res = Y.simulate(Y.parse(ta.value), { forwarding: el.querySelector('.f').checked, predict: el.querySelector('.p').value, rsp: 0x1000 });
        var lines = Y.summary(res);
        out.innerHTML = '<p><strong>' + res.lost + '</strong> lost cycles = ' + res.dataStalls + ' data-stall + ' + res.controlStalls +
          ' control-stall + ' + res.squashed + ' squashed · ' + res.instructions + ' instructions · CPI ≈ ' + res.cpi.toFixed(2) + '</p>' +
          (lines.length ? '<ul>' + lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' : '') +
          (res.notes.length ? '<p class="muted">' + res.notes.map(esc).join('<br>') + '</p>' : '') +
          '<div class="diagram"></div>' + LEGEND;
        Y.render(out.querySelector('.diagram'), res, { maxRows: 80 });
      } catch (e) {
        out.innerHTML = '<p class="verdict no">' + esc(e.message) + '</p>';
      }
    }
    el.querySelector('.run').addEventListener('click', run);
    el.querySelectorAll('select, input[type=checkbox]').forEach(function (s) { s.addEventListener('change', run); });
    run();
  }

  root.Drill = { forwarding: forwarding, lostCycles: lostCycles, sandbox: sandbox };
})(window);
