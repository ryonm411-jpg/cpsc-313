/* encode.js — y86-64 byte encoding + SEQ stage drills (course reference: y86reference.pdf).
 *
 * Y86.encode(asm)            → array of byte values, or throws Error(message)
 * Y86.hex(bytes)             → "30 f3 0f 00 …"
 * Encode.toBytes(el)         → drill: assembly → bytes
 * Encode.toAsm(el)           → drill: bytes → assembly (answer checked by re-encoding it)
 * Stages.sorter(el, list)    → drill: put each operation in its SEQ stage (or "not used")
 *
 * Course ISA includes mulq/divq/modq (ifun 4/5/6).
 */
(function (root) {
  'use strict';

  var REGS = ['%rax', '%rcx', '%rdx', '%rbx', '%rsp', '%rbp', '%rsi', '%rdi',
              '%r8', '%r9', '%r10', '%r11', '%r12', '%r13', '%r14'];
  var OPS = ['addq', 'subq', 'andq', 'xorq', 'mulq', 'divq', 'modq'];
  var CONDS = ['', 'le', 'l', 'e', 'ne', 'ge', 'g'];

  // mnemonic → [icode, ifun, form]
  var TABLE = { halt: [0, 0, 'none'], nop: [1, 0, 'none'], ret: [9, 0, 'none'],
                rrmovq: [2, 0, 'rr'], irmovq: [3, 0, 'ir'], rmmovq: [4, 0, 'rm'],
                mrmovq: [5, 0, 'mr'], call: [8, 0, 'dest'], pushq: [10, 0, 'r'], popq: [11, 0, 'r'] };
  OPS.forEach(function (m, i) { TABLE[m] = [6, i, 'rr']; });
  CONDS.forEach(function (c, i) {
    TABLE[i ? 'j' + c : 'jmp'] = [7, i, 'dest'];
    if (i) TABLE['cmov' + c] = [2, i, 'rr'];
  });

  function reg(s) {
    var i = REGS.indexOf(String(s).trim().toLowerCase());
    if (i < 0) throw new Error('“' + s + '” is not a register (write it like %rax).');
    return i;
  }

  function num(s, what) {
    var m = /^\$?\s*(-?)\s*(0x[0-9a-f]+|\d+)$/i.exec(String(s).trim());
    if (!m) throw new Error('Can\'t read the ' + what + ' “' + s + '”. Use decimal (16) or hex (0x10).');
    var v = BigInt(m[2]);
    return m[1] ? -v : v;
  }

  function le8(v) {
    var u = BigInt.asUintN(64, v), out = [];
    for (var i = 0; i < 8; i++) { out.push(Number(u & 0xffn)); u >>= 8n; }
    return out;
  }

  function memOperand(s) {
    var m = /^(.*)\((%\w+)\)$/.exec(String(s).replace(/\s+/g, ''));
    if (!m) throw new Error('Expected a memory operand like 8(%rbx), got “' + s + '”.');
    return { d: m[1] === '' ? 0n : num(m[1], 'displacement'), r: reg(m[2]) };
  }

  function encode(asm) {
    var line = String(asm).replace(/#.*/, '').trim();
    var sp = line.search(/\s/);
    var mn = (sp < 0 ? line : line.slice(0, sp)).toLowerCase();
    var args = sp < 0 ? [] : line.slice(sp).split(',').map(function (a) { return a.trim(); }).filter(Boolean);
    var t = TABLE[mn];
    if (!t) throw new Error('Unknown instruction “' + mn + '”.');
    var b0 = (t[0] << 4) | t[1];
    var need = { none: 0, r: 1, dest: 1, rr: 2, ir: 2, rm: 2, mr: 2 }[t[2]];
    if (args.length !== need) throw new Error(mn + ' takes ' + need + ' operand' + (need === 1 ? '' : 's') + '.');
    switch (t[2]) {
      case 'none': return [b0];
      case 'r': return [b0, (reg(args[0]) << 4) | 0xf];
      case 'rr': return [b0, (reg(args[0]) << 4) | reg(args[1])];
      case 'ir': return [b0, 0xf0 | reg(args[1])].concat(le8(num(args[0], 'immediate')));
      case 'rm': var m1 = memOperand(args[1]);
        return [b0, (reg(args[0]) << 4) | m1.r].concat(le8(m1.d));
      case 'mr': var m2 = memOperand(args[0]);
        return [b0, (reg(args[1]) << 4) | m2.r].concat(le8(m2.d));
      case 'dest': return [b0].concat(le8(num(args[0], 'destination')));
    }
  }

  function hex(bytes) {
    return bytes.map(function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join(' ');
  }

  function parseHex(s) {
    var clean = String(s).toLowerCase().replace(/0x/g, '').replace(/[^0-9a-f]/g, '');
    if (clean.length % 2) return null;
    var out = [];
    for (var i = 0; i < clean.length; i += 2) out.push(parseInt(clean.slice(i, i + 2), 16));
    return out;
  }

  // Label the byte fields so a wrong answer shows *which* field is off.
  function fields(bytes) {
    var ic = bytes[0] >> 4, parts = [['icode:ifun', [bytes[0]]]];
    var hasReg = [2, 3, 4, 5, 6, 10, 11].indexOf(ic) >= 0;
    var hasC = [3, 4, 5, 7, 8].indexOf(ic) >= 0;
    var i = 1;
    if (hasReg) { parts.push(['rA:rB', [bytes[1]]]); i = 2; }
    if (hasC) parts.push([ic === 7 || ic === 8 ? 'Dest (little-endian)' : (ic === 3 ? 'V' : 'D') + ' (little-endian)', bytes.slice(i, i + 8)]);
    return parts;
  }

  function fieldHTML(bytes) {
    return '<span class="enc">' + fields(bytes).map(function (p) {
      return '<span class="enc-f"><code>' + hex(p[1]) + '</code><small>' + p[0] + '</small></span>';
    }).join('') + '</span>';
  }

  // ---------- random instruction generator ----------
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function r() { return pick(REGS); }
  function r2() { var a = r(), b; do { b = r(); } while (b === a); return [a, b]; }
  function imm() {
    return pick([
      function () { return '$' + Math.floor(Math.random() * 300); },
      function () { return '$0x' + Math.floor(Math.random() * 0x10000).toString(16); },
      function () { return '$-' + (1 + Math.floor(Math.random() * 40)); },
      function () { return '$0x' + (0x100000000 + Math.floor(Math.random() * 0xffffffff)).toString(16); }
    ])();
  }
  function disp() { return pick(['', '8', '16', '24', '-8', '-16', '0x20', '0x100', String(8 * Math.floor(Math.random() * 40))]); }
  function addr() { return '0x' + (0x40 + 4 * Math.floor(Math.random() * 200)).toString(16); }

  var GEN = [
    function () { var p = r2(); return 'rrmovq ' + p[0] + ', ' + p[1]; },
    function () { var p = r2(); return 'cmov' + pick(CONDS.slice(1)) + ' ' + p[0] + ', ' + p[1]; },
    function () { return 'irmovq ' + imm() + ', ' + r(); },
    function () { var p = r2(); return 'rmmovq ' + p[0] + ', ' + disp() + '(' + p[1] + ')'; },
    function () { var p = r2(); return 'mrmovq ' + disp() + '(' + p[1] + '), ' + p[0]; },
    function () { var p = r2(); return pick(OPS) + ' ' + p[0] + ', ' + p[1]; },
    function () { return pick(['jmp', 'jle', 'jl', 'je', 'jne', 'jge', 'jg']) + ' ' + addr(); },
    function () { return 'call ' + addr(); },
    function () { return pick(['pushq', 'popq']) + ' ' + r(); },
    function () { return pick(['ret', 'halt', 'nop']); }
  ];
  var WEIGHTS = [2, 2, 3, 3, 3, 3, 2, 1, 2, 1];
  function randomAsm() {
    var total = WEIGHTS.reduce(function (a, b) { return a + b; }), x = Math.random() * total;
    for (var i = 0; i < GEN.length; i++) { x -= WEIGHTS[i]; if (x < 0) return GEN[i](); }
    return GEN[0]();
  }

  // ---------- drill scaffolding ----------
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function drillShell(box, title) {
    box.classList.add('quiz', 'drill');
    box.innerHTML = '';
    var score = { right: 0, tries: 0 };
    var head = el('p', 'q', title + ' <span class="muted drill-score"></span>');
    var prompt = el('div', 'drill-prompt');
    var row = el('div', 'row');
    var input = el('input'); input.type = 'text'; input.style.width = '100%'; input.style.maxWidth = '26rem';
    input.setAttribute('autocomplete', 'off'); input.setAttribute('spellcheck', 'false');
    var check = el('button', 'btn', 'Check'); check.type = 'button';
    var show = el('button', 'btn ghost', 'Show answer'); show.type = 'button';
    var next = el('button', 'btn ghost', 'Next →'); next.type = 'button';
    row.append(input, check, show, next);
    var fb = el('div', 'drill-fb');
    box.append(head, prompt, row, fb);
    function tally(ok) {
      score.tries++; if (ok) score.right++;
      head.querySelector('.drill-score').textContent = '· ' + score.right + '/' + score.tries;
    }
    return { prompt: prompt, input: input, check: check, show: show, next: next, fb: fb, tally: tally };
  }

  function toBytes(box) {
    var d = drillShell(box, 'Drill: assembly → bytes');
    var asm, ans, done;
    function fresh() {
      asm = randomAsm(); ans = encode(asm); done = false;
      d.prompt.innerHTML = '<pre><code>' + asm + '</code></pre>';
      d.input.value = ''; d.input.placeholder = 'hex bytes, e.g. 30 f3 0f 00 00 00 00 00 00 00';
      d.fb.innerHTML = ''; d.input.focus();
    }
    function verdict(ok, msg) {
      d.fb.innerHTML = '<p class="verdict ' + (ok ? 'ok' : 'no') + '">' + msg + '</p>' +
        '<p>Answer (' + ans.length + ' bytes): ' + fieldHTML(ans) + '</p>';
    }
    d.check.onclick = function () {
      if (done) return;
      var got = parseHex(d.input.value);
      if (!got) { d.fb.innerHTML = '<p class="verdict no">Odd number of hex digits. Write two digits per byte.</p>'; return; }
      var ok = got.length === ans.length && got.every(function (b, i) { return b === ans[i]; });
      done = true; d.tally(ok);
      if (ok) return verdict(true, 'Correct.');
      var hint = got.length !== ans.length
        ? 'You wrote ' + got.length + ' bytes; this instruction is ' + ans.length + '.'
        : 'First wrong byte is byte ' + got.findIndex(function (b, i) { return b !== ans[i]; }) + '.';
      verdict(false, 'Not quite. ' + hint);
    };
    d.show.onclick = function () { if (!done) { done = true; d.tally(false); } verdict(false, 'Here it is. Re-derive it field by field before moving on.'); };
    d.next.onclick = fresh;
    d.input.addEventListener('keydown', function (e) { if (e.key === 'Enter') (done ? fresh : d.check.onclick)(); });
    fresh();
  }

  function toAsm(box) {
    var d = drillShell(box, 'Drill: bytes → assembly');
    var asm, ans, done;
    function fresh() {
      asm = randomAsm(); ans = encode(asm); done = false;
      d.prompt.innerHTML = '<pre><code>' + hex(ans) + '</code></pre>';
      d.input.value = ''; d.input.placeholder = 'assembly, e.g. irmovq $15, %rbx';
      d.fb.innerHTML = ''; d.input.focus();
    }
    function verdict(ok, msg) {
      d.fb.innerHTML = '<p class="verdict ' + (ok ? 'ok' : 'no') + '">' + msg + '</p>' +
        '<p>Answer: <code>' + asm + '</code> &nbsp;' + fieldHTML(ans) + '</p>';
    }
    d.check.onclick = function () {
      if (done) return;
      var got;
      try { got = encode(d.input.value); }
      catch (e) { d.fb.innerHTML = '<p class="verdict no">' + e.message + '</p>'; return; }
      var ok = got.length === ans.length && got.every(function (b, i) { return b === ans[i]; });
      done = true; d.tally(ok);
      verdict(ok, ok ? 'Correct.' : 'Not quite. Your line encodes to <code>' + hex(got) + '</code>.');
    };
    d.show.onclick = function () { if (!done) { done = true; d.tally(false); } verdict(false, 'Here it is.'); };
    d.next.onclick = fresh;
    d.input.addEventListener('keydown', function (e) { if (e.key === 'Enter') (done ? fresh : d.check.onclick)(); });
    fresh();
  }

  // ---------- SEQ stage sorter ----------
  var STAGES = ['Fetch', 'Decode', 'Execute', 'Memory', 'Writeback', 'PC update', 'not used'];

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  // list: [{ name, note?, ops: [[text, stageIndex], …] }]  (stageIndex 6 = distractor)
  function sorter(box, list) {
    box.classList.add('quiz', 'drill');
    var idx = 0;
    function render() {
      var ins = list[idx];
      box.innerHTML = '';
      box.append(el('p', 'q', 'Drill: sort into stages · <code>' + ins.name + '</code> <span class="muted">(' + (idx + 1) + ' of ' + list.length + ')</span>'));
      if (ins.note) box.append(el('p', 'muted', ins.note));
      var rows = shuffle(ins.ops).map(function (op) {
        var r = el('div', 'sort-row');
        var sel = el('select');
        sel.innerHTML = '<option value="">choose…</option>' + STAGES.map(function (s, i) { return '<option value="' + i + '">' + s + '</option>'; }).join('');
        r.append(el('code', null, op[0]), sel);
        box.append(r);
        return { row: r, sel: sel, want: op[1] };
      });
      var bar = el('div', 'row'); bar.style.marginTop = '.7rem';
      var check = el('button', 'btn', 'Check'); check.type = 'button';
      var next = el('button', 'btn ghost', 'Next instruction →'); next.type = 'button';
      bar.append(check, next);
      var fb = el('div', 'drill-fb');
      box.append(bar, fb);
      check.onclick = function () {
        var wrong = 0;
        rows.forEach(function (x) {
          var ok = x.sel.value !== '' && Number(x.sel.value) === x.want;
          if (!ok) wrong++;
          x.row.classList.toggle('ok', ok); x.row.classList.toggle('no', !ok);
          var tag = x.row.querySelector('.sort-ans') || x.row.appendChild(el('small', 'sort-ans'));
          tag.textContent = ok ? '' : '→ ' + STAGES[x.want];
        });
        fb.innerHTML = '<p class="verdict ' + (wrong ? 'no' : 'ok') + '">' +
          (wrong ? wrong + ' misplaced. The right stage is shown next to each red row.' : 'All correct.') + '</p>' +
          (ins.why ? '<p>' + ins.why + '</p>' : '');
      };
      next.onclick = function () { idx = (idx + 1) % list.length; render(); };
    }
    render();
  }

  root.Y86 = { encode: encode, hex: hex, parseHex: parseHex, randomAsm: randomAsm, fields: fields };
  root.Encode = { toBytes: toBytes, toAsm: toAsm };
  root.Stages = { sorter: sorter, STAGES: STAGES };
  if (typeof module !== 'undefined') module.exports = root.Y86;
})(typeof window !== 'undefined' ? window : globalThis);
