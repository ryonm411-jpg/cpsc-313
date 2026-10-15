/* y86pipe.js — a tiny y86-64 interpreter + 5-stage pipeline timing model.
 *
 * Timing rules (CPSC 313 slides 2.3 / 2.4, CS:APP 3e §4.5):
 *   - A value written in W can be read from the register file in Decode the NEXT cycle.
 *   - Consumer needs operands by the END of its Decode cycle.
 *   - ALU results exist at end of Execute (e_valE); loaded values at end of Memory (m_valM).
 *   - jmp / call: target known in Fetch (valC) -> no penalty.
 *   - ret: return address read in Memory, used to fetch when ret is in W -> 3 bubbles.
 *   - jXX: outcome known after Execute; correct fetch happens when jXX is in Memory
 *          -> 2 lost cycles (stalls with no prediction, squashed instrs on a mispredict).
 *
 * Data: `.quad v` (with labels) is placed at 0x8000+; `irmovq label, rB` loads a label's value.
 *       Instructions are addressed by index, so .pos/.align are ignored.
 *
 * API: Y86.parse(src) · Y86.simulate(prog, {forwarding, predict}) · Y86.render(el, result)
 *      Y86.randomProgram(kind, rng)
 */
(function (root) {
  'use strict';

  var REGS = ['rax', 'rcx', 'rdx', 'rbx', 'rsp', 'rbp', 'rsi', 'rdi',
              'r8', 'r9', 'r10', 'r11', 'r12', 'r13', 'r14'];
  var OPS = { addq: 1, subq: 1, andq: 1, xorq: 1, mulq: 1, divq: 1, modq: 1 };
  var JXX = { jmp: 1, jle: 1, jl: 1, je: 1, jne: 1, jge: 1, jg: 1 };
  var CMOV = { rrmovq: 1, cmovle: 1, cmovl: 1, cmove: 1, cmovne: 1, cmovge: 1, cmovg: 1 };
  var MASK = (1n << 64n) - 1n;
  var DATA_BASE = 0x8000n;   // .quad words live here; if a program has data, %rsp starts at 0x10000

  function toSigned(x) { x &= MASK; return x >= (1n << 63n) ? x - (1n << 64n) : x; }

  function parseImm(s) {
    s = s.trim().replace(/^\$/, '');
    var neg = s[0] === '-';
    if (neg) s = s.slice(1);
    var v = BigInt(s.toLowerCase().startsWith('0x') ? s : s.replace(/^0+(?=\d)/, ''));
    return toSigned(neg ? -v : v);
  }

  function reg(s) {
    var r = s.trim().replace(/^%/, '');
    if (REGS.indexOf(r) < 0) throw new Error('Unknown register: ' + s);
    return r;
  }

  // "D(%rB)" or "(%rB)"
  function memOperand(s) {
    var m = s.trim().match(/^(.*)\(\s*(%\w+)\s*\)$/);
    if (!m) throw new Error('Bad memory operand: ' + s);
    return { disp: m[1].trim() ? parseImm(m[1]) : 0n, rB: reg(m[2]) };
  }

  function parse(src) {
    var instrs = [], labels = {}, pending = [], data = [];
    src.split(/\r?\n/).forEach(function (raw) {
      var line = raw.replace(/#.*$/, '').trim();
      // peel off any number of "label:" prefixes
      var m;
      while ((m = line.match(/^([A-Za-z_.][\w.]*)\s*:\s*/))) {
        pending.push(m[1]);
        line = line.slice(m[0].length);
      }
      if (!line) return;
      // ".quad v" lays down a data word in a separate data region; its labels name that address.
      var q = line.match(/^\.quad\s+(\S+)/);
      if (q) {
        var addr = DATA_BASE + BigInt(data.length * 8);
        data.push({ addr: addr, value: q[1] });
        pending.forEach(function (l) { labels[l] = addr; });
        pending = [];
        return;
      }
      if (line[0] === '.') return;   // .pos / .align: ignored (instructions are addressed by index)
      var sp = line.search(/\s/);
      var op = (sp < 0 ? line : line.slice(0, sp)).toLowerCase();
      var args = sp < 0 ? [] : splitArgs(line.slice(sp + 1));
      var ins = { op: op, text: line.replace(/\s+/g, ' '), idx: instrs.length };
      if (op === 'halt' || op === 'nop' || op === 'ret') {
        // no operands
      } else if (op === 'irmovq') {
        ins.rB = reg(args[1]);
        if (/^\$?-?(0x[0-9a-f]+|\d+)$/i.test(args[0].trim())) ins.imm = parseImm(args[0]);
        else ins.immLabel = args[0].trim().replace(/^\$/, '');
      } else if (CMOV[op]) {
        ins.rA = reg(args[0]); ins.rB = reg(args[1]);
      } else if (OPS[op]) {
        ins.rA = reg(args[0]); ins.rB = reg(args[1]);
      } else if (op === 'rmmovq') {
        var d = memOperand(args[1]); ins.rA = reg(args[0]); ins.rB = d.rB; ins.imm = d.disp;
      } else if (op === 'mrmovq') {
        var s = memOperand(args[0]); ins.rB = s.rB; ins.imm = s.disp; ins.rA = reg(args[1]);
      } else if (op === 'pushq' || op === 'popq') {
        ins.rA = reg(args[0]);
      } else if (JXX[op] || op === 'call') {
        ins.target = args[0];
      } else {
        throw new Error('Unsupported instruction: ' + line);
      }
      pending.forEach(function (l) { labels[l] = ins.idx; });
      pending = [];
      instrs.push(ins);
    });
    // trailing labels point past the end (an implicit halt lives there)
    pending.forEach(function (l) { labels[l] = instrs.length; });
    function resolve(name) {
      if (!(name in labels)) throw new Error('Unknown label: ' + name);
      return labels[name];
    }
    data.forEach(function (d) {
      d.value = /^-?(0x[0-9a-f]+|\d+)$/i.test(d.value) ? parseImm(d.value) : BigInt(resolve(d.value));
    });
    instrs.forEach(function (ins) {
      if (ins.immLabel !== undefined) ins.imm = BigInt(resolve(ins.immLabel));
      if (ins.target !== undefined) {
        if (!(ins.target in labels)) throw new Error('Unknown label: ' + ins.target);
        ins.targetIdx = labels[ins.target];
      }
    });
    return { instrs: instrs, labels: labels, data: data };
  }

  function splitArgs(s) {
    var out = [], depth = 0, cur = '';
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (c === '(') depth++;
      if (c === ')') depth--;
      if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += c;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  function cond(op, cc) {
    var lt = cc.SF !== cc.OF;
    switch (op.replace(/^(j|cmov)/, '')) {
      case 'mp': case 'rmovq': return true;
      case 'le': return lt || cc.ZF;
      case 'l': return lt;
      case 'e': return cc.ZF;
      case 'ne': return !cc.ZF;
      case 'ge': return !lt;
      case 'g': return !lt && !cc.ZF;
    }
    return true;
  }

  // Registers this instruction reads in Decode.
  function sources(ins) {
    switch (ins.op) {
      case 'irmovq': case 'nop': case 'halt': case 'call': return ins.op === 'call' ? ['rsp'] : [];
      case 'mrmovq': return [ins.rB];
      case 'rmmovq': return [ins.rA, ins.rB];
      case 'pushq': return [ins.rA, 'rsp'];
      case 'popq': case 'ret': return ['rsp'];
    }
    if (OPS[ins.op]) return [ins.rA, ins.rB];
    if (CMOV[ins.op]) return [ins.rA];
    return [];
  }

  /* Run the program. opts.forwarding: bool. opts.predict: 'none'|'never'|'always'|'btfnt'|'ftbnt' (forward taken, backward not). */
  function simulate(prog, opts) {
    opts = opts || {};
    var fwd = opts.forwarding !== false;
    var predict = opts.predict || 'none';
    var maxSteps = opts.maxSteps || 3000;
    var instrs = prog.instrs;
    var R = {}; REGS.forEach(function (r) { R[r] = 0n; });
    if (opts.rsp !== undefined) R.rsp = BigInt(opts.rsp);
    if (opts.rsp === undefined && prog.data && prog.data.length) R.rsp = 0x10000n;
    var mem = new Map();
    (prog.data || []).forEach(function (d) { mem.set(d.addr, d.value); });
    var cc = { ZF: true, SF: false, OF: false };
    var lastWriter = {};          // reg -> {E, kind:'E'|'M', text}
    var rows = [], events = [], notes = [];
    var pc = 0, nextF = 1, prevE = 0;
    var dataStalls = 0, controlStalls = 0, squashed = 0, count = 0, lastW = 0;

    function load(a) { return mem.has(a) ? mem.get(a) : 0n; }

    for (var step = 0; step < maxSteps; step++) {
      var ins = pc < instrs.length ? instrs[pc]
        : { op: 'halt', text: 'halt (implicit)', idx: pc };
      count++;
      var F = nextF;
      var Dstart = Math.max(F + 1, prevE);
      var E = Dstart + 1;
      var why = [];
      var fwdFrom = [];
      sources(ins).forEach(function (r) {
        var p = lastWriter[r];
        if (!p) return;
        var need = fwd ? p.E + (p.kind === 'M' ? 2 : 1) : p.E + 4;
        if (need > E) { why.push({ r: r, p: p, need: need }); E = need; }
      });
      // record where each operand comes from (consumer's last Decode cycle is E-1)
      sources(ins).forEach(function (r) {
        var p = lastWriter[r];
        if (!p) return;
        var delta = (E - 1) - p.E;
        var src = 'register file';
        if (fwd) {
          if (p.kind === 'E') src = ['e_valE', 'M_valE', 'W_valE'][delta] || src;
          else src = [null, 'm_valM', 'W_valM'][delta] || src;
        }
        if (src !== 'register file') fwdFrom.push('%' + r + ' ← ' + src + ' (from ' + p.text + ')');
      });
      var stall = E - (Dstart + 1);
      if (stall > 0) {
        dataStalls += stall;
        var w = why.reduce(function (a, b) { return b.need >= a.need ? b : a; });
        events.push({
          kind: 'data', cycles: stall, at: ins.text, idx: ins.idx, reg: w.r,
          detail: (fwd && w.p.kind === 'M' ? 'load/use hazard' : 'data hazard') +
            ' on %' + w.r + ' (written by ' + w.p.text + ')'
        });
      }
      var row = { text: ins.text, F: F, D: Dstart, E: E, M: E + 1, W: E + 2, fwd: fwdFrom, stall: stall };
      rows.push(row);
      lastW = E + 2;
      prevE = E;

      // ---- execute semantics ----
      var next = pc + 1, op = ins.op;
      var a = ins.rA ? R[ins.rA] : 0n, b = ins.rB ? R[ins.rB] : 0n;
      var wE = null, wM = null;   // destination registers (valE path / valM path)
      if (op === 'halt') break;
      if (op === 'irmovq') { R[ins.rB] = ins.imm; wE = ins.rB; }
      else if (CMOV[op]) { if (cond(op, cc)) { R[ins.rB] = a; wE = ins.rB; } }
      else if (OPS[op]) {
        var t;
        if (op === 'addq') t = toSigned(b + a);
        if (op === 'subq') t = toSigned(b - a);
        if (op === 'andq') t = toSigned(b & a);
        if (op === 'xorq') t = toSigned(b ^ a);
        if (op === 'mulq') t = toSigned(b * a);
        if (op === 'divq' || op === 'modq') {
          if (a === 0n) { t = 0n; notes.push(ins.text + ': divide by zero (treated as 0)'); }
          else t = op === 'divq' ? b / a : b % a;
        }
        var of = false;
        if (op === 'addq') of = (a < 0n) === (b < 0n) && (t < 0n) !== (a < 0n);
        if (op === 'subq') of = (a < 0n) !== (b < 0n) && (t < 0n) !== (b < 0n);
        if (op === 'mulq') of = toSigned(b * a) !== b * a;
        cc = { ZF: t === 0n, SF: t < 0n, OF: of };
        R[ins.rB] = t; wE = ins.rB;
      }
      else if (op === 'rmmovq') mem.set(toSigned(b + ins.imm), a);
      else if (op === 'mrmovq') { R[ins.rA] = load(toSigned(b + ins.imm)); wM = ins.rA; }
      else if (op === 'pushq') { R.rsp = toSigned(R.rsp - 8n); mem.set(R.rsp, a); wE = 'rsp'; }
      else if (op === 'popq') {
        var v = load(R.rsp); R.rsp = toSigned(R.rsp + 8n); R[ins.rA] = v; wE = 'rsp'; wM = ins.rA;
      }
      else if (op === 'call') {
        R.rsp = toSigned(R.rsp - 8n); mem.set(R.rsp, BigInt(pc + 1)); wE = 'rsp'; next = ins.targetIdx;
      }
      else if (op === 'ret') {
        var ra = load(R.rsp); R.rsp = toSigned(R.rsp + 8n); wE = 'rsp'; next = Number(ra);
      }
      if (wE) lastWriter[wE] = { E: E, kind: 'E', text: ins.text };
      if (wM) lastWriter[wM] = { E: E, kind: 'M', text: ins.text };

      // ---- control flow timing ----
      nextF = Dstart;  // normal: next instr is fetched while this one is in Decode
      if (op === 'ret') {
        nextF = E + 2;
        controlStalls += 3;
        events.push({ kind: 'control', cycles: 3, at: ins.text, idx: ins.idx, detail: 'ret: return address not known until ret reaches Write-back' });
      } else if (JXX[op] && op !== 'jmp') {
        var taken = cond(op, cc);
        if (taken) next = ins.targetIdx;
        var guess = predict === 'never' ? false : predict === 'always' ? true
          : predict === 'ftbnt' ? ins.targetIdx > ins.idx
          : predict === 'btfnt' ? ins.targetIdx <= ins.idx : null;
        nextF = E + 1;
        if (guess === null) {
          controlStalls += 2;
          events.push({ kind: 'control', cycles: 2, at: ins.text, idx: ins.idx, taken: taken, detail: 'no prediction: stall until the outcome (' + (taken ? 'taken' : 'not taken') + ') is known' });
        } else if (guess !== taken) {
          squashed += 2;
          var wrong = guess ? ins.targetIdx : ins.idx + 1;
          [0, 1].forEach(function (k) {
            var wi = instrs[wrong + k];
            rows.push({ text: wi ? wi.text : '(past end)', F: E - 1 + k, D: k === 0 ? E : null, squashed: true });
          });
          events.push({ kind: 'squash', cycles: 2, at: ins.text, idx: ins.idx, taken: taken, detail: 'mispredicted (guessed ' + (guess ? 'taken' : 'not taken') + ', actually ' + (taken ? 'taken' : 'not taken') + '): 2 instructions squashed' });
        } else {
          nextF = Dstart;
          events.push({ kind: 'ok', cycles: 0, at: ins.text, idx: ins.idx, taken: taken, detail: 'predicted correctly (' + (taken ? 'taken' : 'not taken') + ')' });
        }
      }
      // jmp / call: target is valC, known in Fetch -> no penalty
      if (op === 'jmp') next = ins.targetIdx;
      pc = next;
      if (step === maxSteps - 1) notes.push('Stopped after ' + maxSteps + ' instructions.');
    }
    var bubbles = dataStalls + controlStalls + squashed;
    return {
      rows: rows, events: events, notes: notes,
      dataStalls: dataStalls, controlStalls: controlStalls, squashed: squashed,
      lost: bubbles, instructions: count, cycles: lastW,
      cpi: (count + bubbles) / count, regs: R
    };
  }

  // ---------- rendering ----------
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function render(container, res, opts) {
    opts = opts || {};
    var maxRows = opts.maxRows || 40;
    container.innerHTML = '';
    var rows = res.rows.slice(0, maxRows);
    var maxC = 0;
    rows.forEach(function (r) { maxC = Math.max(maxC, r.W || r.D || r.F); });
    var wrap = el('div', 'pipe-wrap');
    var tbl = el('table', 'pipe');
    var head = el('tr');
    head.appendChild(el('th', 'pipe-ins', 'instruction'));
    for (var c = 1; c <= maxC; c++) head.appendChild(el('th', null, String(c)));
    tbl.appendChild(head);
    rows.forEach(function (r) {
      var tr = el('tr', r.squashed ? 'squashed' : '');
      tr.appendChild(el('td', 'pipe-ins', r.text + (r.squashed ? '  ✕' : '')));
      for (var c = 1; c <= maxC; c++) {
        var s = '', cls = '';
        if (r.squashed) {
          if (c >= r.F && (r.D === null ? c === r.F : c < r.D)) s = 'F';
          else if (r.D !== null && c === r.D) s = 'D';
        } else if (c >= r.F && c < r.D) { s = 'F'; if (c > r.F) cls = 'hold'; }
        else if (c >= r.D && c < r.E) { s = 'D'; if (c > r.D) cls = 'hold'; }
        else if (c === r.E) s = 'E';
        else if (c === r.M) s = 'M';
        else if (c === r.W) s = 'W';
        var td = el('td', ('st-' + s + ' ' + cls).trim(), s);
        tr.appendChild(td);
      }
      tbl.appendChild(tr);
    });
    wrap.appendChild(tbl);
    container.appendChild(wrap);
    if (res.rows.length > maxRows) container.appendChild(el('p', 'pipe-note', '…first ' + maxRows + ' rows shown.'));
  }

  function summary(res) {
    var lines = [];
    var grouped = {};
    res.events.forEach(function (e) {
      if (e.kind === 'ok') return;
      var k = e.at + ' — ' + e.detail;
      grouped[k] = grouped[k] || { n: 0, cycles: 0, e: e };
      grouped[k].n++; grouped[k].cycles += e.cycles;
    });
    Object.keys(grouped).forEach(function (k) {
      var g = grouped[k];
      lines.push((g.n > 1 ? g.n + ' × ' : '') + k + ' → ' + g.cycles + ' cycle' + (g.cycles === 1 ? '' : 's'));
    });
    return lines;
  }

  // ---------- practice-problem generator ----------
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function randomProgram(kind, rng) {
    rng = rng || Math.random;
    var pick = function (a) { return a[Math.floor(rng() * a.length)]; };
    var int = function (lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); };
    var pool = ['rsi', 'rdi', 'rbp', 'r8', 'r9', 'r10', 'r11', 'r12', 'r14'];
    var recent = [];
    function filler() {
      var dst = pick(pool), src = rng() < 0.45 && recent.length ? pick(recent) : pick(pool);
      var t = rng(), s;
      if (t < 0.3) s = pick(['addq', 'subq', 'xorq', 'andq', 'mulq']) + '   %' + src + ', %' + dst;
      else if (t < 0.5) s = 'mrmovq   0x' + int(16, 4000).toString(16) + '(%' + src + '), %' + dst;
      else if (t < 0.65) s = 'irmovq    $0x' + int(1, 4000).toString(16) + ', %' + dst;
      else if (t < 0.8) s = 'rrmovq   %' + src + ', %' + dst;
      else if (t < 0.9) s = 'popq   %' + dst;
      else s = 'pushq   %' + src;
      recent = [dst];
      return s;
    }
    var lines = [];
    if (kind === 'loop') {
      var lim = int(3, 9), j = pick(['jge', 'jg', 'je']);
      if (rng() < 0.5) {
        lines = ['    irmovq $0, %rax', '    irmovq $' + lim + ', %rbx', '    irmovq $1, %rcx',
          'loop_start:', '    rrmovq %rax, %rdi', '    addq %rcx, %rax', '    subq %rbx, %rdi',
          '    ' + j + ' loop_end', '    jmp loop_start', 'loop_end:', '    halt'];
      } else {
        lines = ['    irmovq $1, %rcx', '    irmovq $' + lim + ', %rbx', '    irmovq $0, %rax',
          'loop:', '    addq %rcx, %rax', '    rrmovq %rbx, %rdi', '    subq %rax, %rdi',
          '    ' + pick(['jg', 'jne']) + ' loop', '    halt'];
      }
      return lines.join('\n');
    }
    // "if"-shaped problem, like the I10 in-class questions
    var a = int(-20, 20) || 3, b = int(-20, 20) || 5;
    var op = pick(['subq', 'addq', 'andq', 'xorq', 'mulq', 'divq']);
    if (op === 'divq' && a === 0) a = 7;
    lines.push('Ln_1:    irmovq    $' + a + ', %rbx');
    lines.push('Ln_2:    irmovq    $' + b + ', %rcx');
    lines.push('Ln_3:    ' + op + '   %rbx, %rcx');
    lines.push('Ln_4:    ' + pick(['jl', 'jle', 'je', 'jne', 'jge', 'jg']) + '   L1');
    recent = ['rcx'];
    for (var i = 5; i <= 7; i++) lines.push('Ln_' + i + ':    ' + filler());
    lines.push('', 'L1:');
    recent = [];
    for (var k = 10; k <= 13; k++) lines.push('Ln_' + k + ':    ' + filler());
    return lines.join('\n');
  }

  var api = { parse: parse, simulate: simulate, render: render, summary: summary, randomProgram: randomProgram, rng: mulberry };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Y86 = api;
})(this);
