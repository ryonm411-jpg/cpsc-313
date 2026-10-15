/* snapshot.js — "freeze the pipeline" drills (R2.3 / R2.4 / R2.5 / R2.10-style).
 *
 *   Snapshot.fields(ins)   {srcA, srcB, dstE, dstM} for one parsed instruction (CS:APP Fig. 4.57).
 *   Snapshot.stage(el)     "When X is in stage S, where is Y / what is in E_dstM?" (no stalls).
 *   Snapshot.nops(el)      PIPE- (no hazard handling): how many nops before each hazard line? (cumulative)
 *
 * Needs y86pipe.js (Y86.parse) and quiz.js (Quiz.verdict).
 */
(function (root) {
  'use strict';

  var STAGES = ['F', 'D', 'E', 'M', 'W'];
  var STAGE_NAME = { F: 'Fetch', D: 'Decode', E: 'Execute', M: 'Memory', W: 'Write-back' };
  var OPS = /^(addq|subq|andq|xorq|mulq|divq|modq)$/;

  function fields(ins) {
    var f = { srcA: null, srcB: null, dstE: null, dstM: null };
    var op = ins.op;
    if (OPS.test(op)) { f.srcA = ins.rA; f.srcB = ins.rB; f.dstE = ins.rB; }
    else if (op === 'rrmovq') { f.srcA = ins.rA; f.dstE = ins.rB; }
    else if (op === 'irmovq') { f.dstE = ins.rB; }
    else if (op === 'rmmovq') { f.srcA = ins.rA; f.srcB = ins.rB; }
    else if (op === 'mrmovq') { f.srcB = ins.rB; f.dstM = ins.rA; }
    else if (op === 'pushq') { f.srcA = ins.rA; f.srcB = 'rsp'; f.dstE = 'rsp'; }
    else if (op === 'popq') { f.srcA = 'rsp'; f.srcB = 'rsp'; f.dstE = 'rsp'; f.dstM = ins.rA; }
    else if (op === 'call') { f.srcB = 'rsp'; f.dstE = 'rsp'; }
    else if (op === 'ret') { f.srcA = 'rsp'; f.srcB = 'rsp'; f.dstE = 'rsp'; }
    return f;
  }

  function h(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function int(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
  function esc(s) { return s.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  function reg(r) { return r ? '%' + r : 'NONE'; }

  var POOL = ['rax', 'rbx', 'rcx', 'rdx', 'rsi', 'rdi', 'r8', 'r9', 'r10', 'r11', 'r13', 'r14'];
  function randomInstr(src, dst, allowStack) {
    var t = Math.random(), hex = '0x' + int(16, 0xefff).toString(16);
    if (allowStack && t < 0.12) return pick(['pushq   %' + src, 'popq   %' + dst]);
    if (t < 0.35) return pick(['addq', 'subq', 'xorq', 'mulq', 'andq']) + '   %' + src + ', %' + dst;
    if (t < 0.6) return 'mrmovq   ' + hex + '(%' + src + '), %' + dst;
    if (t < 0.75) return 'irmovq   $' + hex + ', %' + dst;
    if (t < 0.88) return 'rrmovq   %' + src + ', %' + dst;
    return 'rmmovq   %' + src + ', ' + hex + '(%' + dst + ')';
  }

  // Score line + "next" button shared by both drills.
  function finish(card, ok, score, html, next) {
    score.total++; if (ok) score.right++;
    var why = card.querySelector('.why');
    why.innerHTML = html + '<p class="muted">Score: ' + score.right + ' / ' + score.total + '</p>' +
      '<button class="btn nx" type="button">Next problem →</button>';
    root.Quiz.verdict(card, ok);
    why.querySelector('.nx').addEventListener('click', next);
  }

  // ------------------------------------------------------------------ stage snapshot drill
  function stage(el) {
    var score = { right: 0, total: 0 };
    el.innerHTML = '';
    var card = h('<div class="quiz drill"></div>');
    el.appendChild(card);

    function next() {
      var n = int(3, 5), lines = [];
      for (var i = 0; i < n; i++) lines.push(randomInstr(pick(POOL), pick(POOL), true));
      var prog = root.Y86.parse(lines.join('\n')).instrs;
      var labels = lines.map(function (_, i) { return 'Ln_' + (i + 1); });
      // anchor instruction a is in stage sa; instruction k is (a - k) stages further along.
      var a = int(1, n - 1), sa = int(Math.min(a, 2), 4);
      var kind = Math.random() < 0.4 ? 'where' : 'field';
      var q, opts, answer, explain;
      if (kind === 'where') {
        var k = int(0, n - 1); while (k === a) k = int(0, n - 1);
        var sk = sa + (a - k);
        answer = sk > 4 ? 'already finished' : sk < 0 ? 'not fetched yet' : STAGE_NAME[STAGES[sk]];
        opts = ['Fetch', 'Decode', 'Execute', 'Memory', 'Write-back', sk > 4 ? 'already finished' : 'not fetched yet'];
        q = 'No stalls. When <code>' + labels[a] + '</code> is in <strong>' + STAGE_NAME[STAGES[sa]] +
          '</strong>, which stage is <code>' + labels[k] + '</code> in?';
        explain = '<code>' + labels[k] + '</code> is ' + Math.abs(a - k) + ' instruction' + (Math.abs(a - k) > 1 ? 's' : '') +
          (k < a ? ' earlier, so it is that many stages <em>further along</em>' : ' later, so it is that many stages <em>behind</em>') + '.';
      } else {
        // D uses the signal computed in Decode (d_dstE); E/M/W use the pipeline register (E_dstE).
        // Sometimes the stage holds an instruction the question never shows -> NONE (the R2.4 trap).
        var regStage = pick(['D', 'E', 'M', 'W']);
        var idx = a - (STAGES.indexOf(regStage) - sa);      // instruction currently in that stage
        var shown = idx >= 0 && idx <= n - 1;
        if (!shown && Math.random() < 0.6) return next();
        var field = pick(['dstE', 'dstM']);
        var pre = regStage === 'D' ? 'd' : regStage;
        var f = shown ? fields(prog[idx]) : null;
        answer = shown ? reg(f[field]) : 'NONE';
        var set = {}; set.NONE = 1; set['%rsp'] = 1;
        prog.forEach(function (p) { [p.rA, p.rB].forEach(function (r) { if (r) set['%' + r] = 1; }); });
        opts = Object.keys(set).sort();
        q = 'No stalls. When <code>' + labels[a] + '</code> is in <strong>' + STAGE_NAME[STAGES[sa]] +
          '</strong>, what does <code>' + pre + '_' + field + '</code> hold? (NONE if there isn\'t enough information.)';
        explain = '<code>' + pre + '_…</code> belongs to whichever instruction is <em>in ' + STAGE_NAME[regStage] + '</em> right now' +
          (shown ? ': <code>' + labels[idx] + ': ' + esc(lines[idx].replace(/\s+/g, ' ')) + '</code>. Its ' + field + ' is <code>' + answer + '</code>' +
            (field === 'dstM' ? ' (dstM is only set by loads: <code>mrmovq</code> → rA, <code>popq</code> → rA).' : ' (dstE: OPq/rrmovq/irmovq → rB; push/pop/call/ret → %rsp).')
          : '. That is ' + (idx > n - 1 ? 'an instruction <em>after</em> <code>' + labels[n - 1] + '</code>' : 'an instruction <em>before</em> <code>Ln_1</code>') +
            ', and the question never shows it, so the answer is NONE. This is the R2.4 trap.');
      }
      card.classList.remove('done');
      card.innerHTML = '<p class="q">' + q + '</p><pre><code>' +
        lines.map(function (l, i) { return labels[i] + ':    ' + esc(l); }).join('\n') +
        '</code></pre><ol class="opts"></ol><div class="why"></div>';
      var ol = card.querySelector('.opts');
      opts.forEach(function (o) {
        var li = document.createElement('li'), b = document.createElement('button');
        b.type = 'button'; b.innerHTML = '<code>' + esc(o) + '</code>'; b.dataset.v = o;
        b.addEventListener('click', function () {
          if (card.classList.contains('done')) return;
          ol.querySelectorAll('button').forEach(function (x) {
            if (x.dataset.v === answer) x.classList.add('right'); else if (x === b) x.classList.add('wrong');
          });
          finish(card, o === answer, score, '<p>Answer: <strong><code>' + esc(answer) + '</code></strong>. ' + explain + '</p>', next);
        });
        li.appendChild(b); ol.appendChild(li);
      });
    }
    next();
  }

  // ------------------------------------------------------------------ PIPE- nop drill
  // A register written in W is readable in Decode the next cycle, so with no hazard handling
  // the consumer must be >= 4 instructions after the producer: nops = max(0, 4 - distance).
  function solveNops(prog) {
    var pos = [], extra = 0, lastWriter = {}, hazards = [];
    prog.forEach(function (ins, i) {
      var f = fields(ins), need = 0, cause = null;
      [f.srcA, f.srcB].forEach(function (r) {
        if (!r || lastWriter[r] === undefined) return;
        var d = (i + extra) - pos[lastWriter[r]], nn = Math.max(0, 4 - d);
        if (cause === null || nn > need) { need = Math.max(need, nn); cause = { r: r, from: lastWriter[r], d: d }; }
      });
      if (cause) hazards.push({ line: i, need: need, cause: cause });
      extra += need;
      pos[i] = i + extra;
      if (f.dstE) lastWriter[f.dstE] = i;
      if (f.dstM) lastWriter[f.dstM] = i;
    });
    return hazards;
  }

  function nops(el) {
    var score = { right: 0, total: 0 };
    el.innerHTML = '';
    var card = h('<div class="quiz drill"></div>');
    el.appendChild(card);

    function next() {
      var n = int(5, 7), lines = [], recent = [];
      for (var i = 0; i < n; i++) {
        var src = recent.length && Math.random() < 0.6 ? pick(recent) : pick(POOL);
        var dst = pick(POOL);
        lines.push(randomInstr(src, dst, false));
        var f = fields(root.Y86.parse(lines[i]).instrs[0]);
        recent = recent.concat([f.dstE, f.dstM].filter(Boolean)).slice(-2);
      }
      var prog = root.Y86.parse(lines.join('\n')).instrs;
      var hz = solveNops(prog).filter(function (x) { return x.line - x.cause.from < 4; });
      if (hz.length < 2) return next();
      hz = hz.slice(0, 3);
      card.classList.remove('done');
      card.innerHTML =
        '<p class="q">PIPE- (no stalling, no forwarding). Answer cumulatively: assume each earlier answer\'s nops have been inserted.</p>' +
        '<pre><code>' + lines.map(function (l, i) { return 'Ln_' + i + ':    ' + esc(l); }).join('\n') + '</code></pre>' +
        hz.map(function (x, j) {
          return '<p>Q' + (j + 1) + ': line ' + x.line + ' reads <code>%' + x.cause.r + '</code> written by line ' + x.cause.from +
            '. How many nops immediately before line ' + x.line + '? <input type="number" min="0" class="n" data-j="' + j + '"></p>';
        }).join('') +
        '<div class="row"><button class="btn chk" type="button">Check</button></div><div class="why"></div>';
      var inputs = card.querySelectorAll('.n');
      function check() {
        if (card.classList.contains('done')) return;
        var ok = true, empty = false;
        inputs.forEach(function (inp, j) { if (inp.value === '') empty = true; if (Number(inp.value) !== hz[j].need) ok = false; });
        if (empty) return;
        finish(card, ok, score, '<ol>' + hz.map(function (x, j) {
          var mine = Number(inputs[j].value);
          return '<li><strong>' + x.need + '</strong> nop' + (x.need === 1 ? '' : 's') + (mine === x.need ? ' ✓' : ' (you said ' + mine + ')') +
            '. Distance ' + x.cause.d + (x.cause.d !== (x.line - x.cause.from) ? ' (counting earlier inserted nops)' : '') +
            ' → 4 − ' + x.cause.d + ' = ' + (4 - x.cause.d) + (x.need === 0 ? ', so none needed.' : '.') + '</li>';
        }).join('') + '</ol>', next);
      }
      card.querySelector('.chk').addEventListener('click', check);
      inputs.forEach(function (inp) { inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') check(); }); });
    }
    next();
  }

  var api = { fields: fields, stage: stage, nops: nops, solveNops: solveNops };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Snapshot = api;
})(this);
