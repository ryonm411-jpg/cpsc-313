/* replay.js — Quiz 2 "replay" drills (Lesson 10).
 *
 *   Replay.freeze(el, {src, cycle})   "The program has run N cycles. Which stage is each instruction in?"
 *                                     Answered twice: naive pipeline (no hazard handling, pure staircase)
 *                                     and stalling pipeline (no forwarding). "New program" makes a random one.
 *
 * Stalling timing comes from y86pipe.js (forwarding: false): a consumer waits in Decode until the
 * producer has finished Write-back, and the instruction behind it waits in Fetch. Needs y86pipe.js.
 */
(function (root) {
  'use strict';

  var CHOICES = ['not started', 'F', 'D', 'E', 'M', 'W', 'retired'];
  var LABEL = { 'not started': 'Not started', F: 'Fetch', D: 'Decode', E: 'Execute', M: 'Memory', W: 'Write-back', retired: 'Retired' };

  function stageAt(r, c) {
    if (c < r.F) return 'not started';
    if (c < r.D) return 'F';
    if (c < r.E) return 'D';
    if (c === r.E) return 'E';
    if (c === r.E + 1) return 'M';
    if (c === r.E + 2) return 'W';
    return 'retired';
  }
  // Naive pipeline: instruction i (0-based) is fetched in cycle i+1, no matter what.
  function naiveAt(i, c) {
    var k = c - (i + 1);
    return k < 0 ? 'not started' : k > 4 ? 'retired' : 'FDEMW'[k];
  }

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function int(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }

  // Five straight-line instructions with at least one close read-after-write dependency.
  function randomProgram() {
    var regs = ['rax', 'rbx', 'rcx', 'rdx', 'rsi', 'rdi', 'r8', 'r9', 'r10'];
    for (var tries = 0; tries < 50; tries++) {
      var written = [], lines = [];
      for (var i = 0; i < 5; i++) {
        var src = written.length && Math.random() < 0.75 ? pick(written.slice(-2)) : pick(regs);
        var dst = pick(regs.filter(function (r) { return r !== src; }));
        var t = Math.random(), s;
        if (i === 0 || t < 0.2) { s = 'irmovq $' + int(1, 20) + ', %' + dst; written.push(dst); }
        else if (t < 0.5) { s = pick(['addq', 'subq', 'andq', 'xorq']) + ' %' + src + ', %' + dst; written.push(dst); }
        else if (t < 0.65) { s = 'rrmovq %' + src + ', %' + dst; written.push(dst); }
        else if (t < 0.82) { s = 'mrmovq ' + 8 * int(0, 4) + '(%' + src + '), %' + dst; written.push(dst); }
        else { s = 'rmmovq %' + src + ', ' + 8 * int(0, 4) + '(%' + dst + ')'; }
        lines.push(s);
      }
      var src5 = lines.join('\n');
      var res = Y86.simulate(Y86.parse(src5 + '\nhalt'), { forwarding: false, predict: 'none' });
      if (res.dataStalls >= 2) return src5;
    }
    return src5;
  }

  function freeze(el, opts) {
    opts = opts || {};
    var fixed = opts.src;
    el.classList.add('quiz', 'drill');
    function build(src, cycle) {
      var lines = src.split('\n');
      var res = Y86.simulate(Y86.parse(src + '\nhalt'), { forwarding: false, predict: 'none' });
      var rows = res.rows.filter(function (r) { return !r.squashed; });
      var html = '<p class="q">The program below has been running for <strong>' + cycle + ' cycles</strong>. ' +
        'During cycle ' + cycle + ', what is each instruction doing?</p>' +
        '<pre><code>' + lines.map(function (l, i) { return 'I' + (i + 1) + ':  ' + l; }).join('\n') + '</code></pre>' +
        '<div class="scroll-x"><table class="data"><thead><tr><th>Instr</th><th>(a) Naive pipeline</th><th>(b) Stalling, no forwarding</th></tr></thead><tbody>';
      lines.forEach(function (l, i) {
        html += '<tr><td><code>I' + (i + 1) + '</code></td>';
        ['naive', 'stall'].forEach(function (k) {
          html += '<td><select data-i="' + i + '" data-k="' + k + '"><option value="">?</option>' +
            CHOICES.map(function (c) { return '<option value="' + c + '">' + LABEL[c] + '</option>'; }).join('') +
            '</select> <span class="sort-ans"></span></td>';
        });
        html += '</tr>';
      });
      html += '</tbody></table></div><div class="row"><button type="button" class="btn">Check</button>' +
        '<button type="button" class="btn ghost">New program</button></div><div class="drill-fb"></div>';
      el.innerHTML = html;
      var fb = el.querySelector('.drill-fb');
      var btns = el.querySelectorAll('.row button');
      btns[0].addEventListener('click', function () {
        var right = 0, total = 0;
        el.querySelectorAll('select').forEach(function (s) {
          var i = +s.dataset.i;
          var want = s.dataset.k === 'naive' ? naiveAt(i, cycle) : stageAt(rows[i], cycle);
          var ok = s.value === want;
          total++; if (ok) right++;
          s.parentNode.style.background = ok ? 'var(--good-soft)' : 'var(--bad-soft)';
          s.nextElementSibling.textContent = ok ? '' : '→ ' + LABEL[want];
        });
        var how = rows.slice(0, lines.length).map(function (r, i) {
          var d = r.E - r.D, f = r.D - r.F;
          return 'I' + (i + 1) + ': F ' + r.F + (f > 1 ? '–' + (r.D - 1) : '') + ', D ' + r.D + (d > 1 ? '–' + (r.E - 1) : '') +
            ', E ' + r.E + ', M ' + (r.E + 1) + ', W ' + (r.E + 2) + (r.stall ? '   ← ' + r.stall + ' stall' + (r.stall > 1 ? 's' : '') + ' in Decode' : '');
        }).join('\n');
        fb.innerHTML = '<p class="verdict ' + (right === total ? 'ok' : 'no') + '">' + right + ' / ' + total + ' correct.</p>' +
          '<p><strong>(a) Naive:</strong> instruction I<em>k</em> is fetched in cycle <em>k</em>, so in cycle ' + cycle +
          ' it is ' + cycle + ' − <em>k</em> stages along (0 = F … 4 = W). Hazards are ignored, so nothing waits.</p>' +
          '<p><strong>(b) Stalling</strong> (consumer sits in Decode until the producer has <em>finished</em> Write-back; the instruction behind it sits in Fetch):</p>' +
          '<pre class="bd">' + how + '</pre><div class="dg"></div>';
        Y86.render(fb.querySelector('.dg'), res);
      });
      btns[1].addEventListener('click', function () { build(randomProgram(), pick([5, 6, 6, 7, 8])); });
    }
    build(fixed || randomProgram(), opts.cycle || 6);
  }

  root.Replay = { freeze: freeze, stageAt: stageAt, naiveAt: naiveAt };
})(window);
