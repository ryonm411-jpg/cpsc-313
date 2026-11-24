/* fs.js — random drills for Quiz 4 (disks and file systems).
 *
 * FS.disk(el)     average access time to read one sector: seek + half a rotation + one sector's transfer
 * FS.fd(el)       two processes reading/writing one file: separate open() vs fork() vs dup()
 * FS.index(el)    hybrid index: first indirect offset, which pointer covers an offset, disk reads
 * FS.maxsize(el)  largest file for a hybrid index (direct + single + double [+ triple])
 * FS.extent(el)   extent list → physical block number of a logical block
 * FS.path(el)     disk reads to resolve a path and read the file's first byte
 *
 * Parts are numeric ({answer, tol}) or text ({text, kind: 'txt'}). Needs quiz.js first.
 * Exposes FS.calc for checking by hand / in node.
 */
(function (root) {
  'use strict';
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function rint(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
  function r2(x) { return Math.round(x * 100) / 100; }
  function r4(x) { return Math.round(x * 10000) / 10000; }
  function fmt(n) { return n.toLocaleString('en-US'); }

  function norm(v) { return String(v).trim().toUpperCase(); }

  function card(el, build) {
    var score = { right: 0, total: 0 };
    el.innerHTML = '<div class="quiz drill"></div>';
    var box = el.firstChild;
    function go() {
      var p = build();
      box.classList.remove('done');
      box.innerHTML = '<p class="q">' + p.q + '</p>' + p.parts.map(function (x) {
        var t = x.kind ? 'text' : 'number';
        return '<p>' + x.label + ' <input type="' + t + '" step="any" class="n" autocomplete="off" spellcheck="false"' +
          (x.kind ? ' placeholder="letter" style="width:5rem"' : '') + '> ' + (x.unit || '') + '</p>';
      }).join('') + '<div class="row"><button class="btn chk" type="button">Check</button></div><div class="why"></div>';
      var inputs = box.querySelectorAll('.n');
      function ok(i) {
        var x = p.parts[i], v = inputs[i].value;
        if (x.kind) return norm(v) === norm(x.text);
        return Math.abs(Number(v) - x.answer) <= (x.tol || 0) + 1e-9;
      }
      function check() {
        if (box.classList.contains('done')) return;
        var all = true;
        for (var i = 0; i < inputs.length; i++) { if (inputs[i].value === '') return; if (!ok(i)) all = false; }
        score.total++; if (all) score.right++;
        var why = box.querySelector('.why');
        why.innerHTML = '<ol>' + p.parts.map(function (x, j) {
          var shown = x.kind ? x.text : fmt(r4(x.answer));
          return '<li><strong>' + shown + '</strong>' + (ok(j) ? ' ✓' : ' (you said ' + inputs[j].value + ')') + ': ' + x.how + '</li>';
        }).join('') + '</ol>' + (p.extra || '') + '<p class="muted">Score: ' + score.right + ' / ' + score.total + '</p><button class="btn nx" type="button">Next problem →</button>';
        root.Quiz.verdict(box, all);
        why.querySelector('.nx').addEventListener('click', go);
      }
      box.querySelector('.chk').addEventListener('click', check);
      inputs.forEach(function (inp) { inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') check(); }); });
    }
    go();
  }

  /* ---------- pure calculators ---------- */
  var calc = {
    rev: function (rpm) { return 60000 / rpm; },                       // ms per rotation
    access: function (seek, rpm, spt) {
      var rev = 60000 / rpm;
      return { rev: rev, rot: rev / 2, xfer: rev / spt, total: seek + rev / 2 + rev / spt };
    },
    // file-offset at which a hybrid index first needs a block of each kind
    hybrid: function (B, a, d) {
      var p = B / a;
      return { ptrs: p, firstSingle: d * B, firstDouble: (d + p) * B, firstTriple: (d + p + p * p) * B };
    },
    // which pointer covers offset `off`, and disk reads to fetch that byte if only the inode is cached
    where: function (B, a, d, off) {
      var p = B / a, lbn = Math.floor(off / B);
      if (lbn < d) return { lbn: lbn, kind: 'direct', reads: 1 };
      lbn -= d; if (lbn < p) return { lbn: lbn + d, kind: 'single indirect', reads: 2 };
      lbn -= p; if (lbn < p * p) return { lbn: lbn + d + p, kind: 'double indirect', reads: 3 };
      return { lbn: Math.floor(off / B), kind: 'triple indirect', reads: 4 };
    },
    maxsize: function (B, a, d, s, dd, t) {
      var p = B / a, blocks = d + s * p + dd * p * p + (t || 0) * p * p * p;
      return { ptrs: p, blocks: blocks, bytes: blocks * B };
    },
    extent: function (ext, lbn) {
      for (var i = 0; i < ext.length; i++) {
        if (lbn < ext[i][1]) return ext[i][0] + lbn;
        lbn -= ext[i][1];
      }
      return null;
    },
    // fd scenario simulator: mode 'open' (two separate open calls) | 'fork' | 'dup'
    fd: function (text, base, mode, steps) {
      var file = {}; for (var i = 0; i < text.length; i++) file[base + i] = text[i];
      var off = { A: base, B: base }, shared = mode !== 'open', out = [];
      steps.forEach(function (s) {
        var who = shared ? 'A' : s.p;
        if (s.op === 'read') { out.push(file[off[who]]); off[who] += 1; }
        else { for (var k = 0; k < s.data.length; k++) file[off[who] + k] = s.data[k]; off[who] += s.data.length; out.push(null); }
      });
      return out;
    }
  };

  /* ---------- disk access time ---------- */
  function disk(el) {
    card(el, function () {
      var seek = pick([3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18, 21]);
      var rpm = pick([3600, 4800, 5400, 6000, 7200, 10000, 12000, 15000]);
      var spt = pick([8, 10, 12, 16, 20, 25, 32, 50, 64, 100]);
      var c = calc.access(seek, rpm, spt);
      return {
        q: 'Average seek time <strong>' + seek + ' ms</strong>, <strong>' + fmt(rpm) + ' RPM</strong>, <strong>' + spt + ' sectors per track</strong>. Read one sector (2 decimals).',
        parts: [
          { label: 'Average rotational latency', unit: 'ms', answer: r2(c.rot), tol: 0.011, how: 'one rotation = 60,000 / ' + fmt(rpm) + ' = ' + r4(c.rev) + ' ms; on average you wait half of it' },
          { label: 'Transfer time for one sector', unit: 'ms', answer: r2(c.xfer), tol: 0.011, how: 'one sector is 1/' + spt + ' of a rotation: ' + r4(c.rev) + ' / ' + spt },
          { label: 'Average access time', unit: 'ms', answer: r2(c.total), tol: 0.011, how: seek + ' + ' + r4(c.rot) + ' + ' + r4(c.xfer) + ' = ' + r4(c.total) + ' (round only at the end)' }
        ]
      };
    });
  }

  /* ---------- file descriptors ---------- */
  function fd(el) {
    var L = 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split('');
    card(el, function () {
      var text = []; while (text.length < 10) { var ch = pick(L); if (text.indexOf(ch) < 0) text.push(ch); }
      var rest = L.filter(function (c) { return text.indexOf(c) < 0; });
      var w = [rest[0], rest[1]];
      var base = rint(100, 2000), mode = pick(['open', 'open', 'fork', 'dup']);
      var steps = [{ p: 'A', op: 'read' }, { p: 'B', op: 'read' }, { p: 'B', op: 'write', data: w }, { p: 'A', op: 'read' }, { p: 'B', op: 'read' }];
      var out = calc.fd(text, base, mode, steps);
      var setup = {
        open: 'Two processes A and B <strong>each call open()</strong> on the file and lseek to ' + base + '.',
        fork: 'Process A opens the file and lseeks to ' + base + ', then calls <strong>fork()</strong>; the child is B.',
        dup: 'One process opens the file and lseeks to ' + base + ', then calls <strong>dup()</strong>. "A" reads through the original fd, "B" through the new one.'
      }[mode];
      var why = mode === 'open'
        ? 'Two open() calls make two open-file-table entries, so <strong>each has its own offset</strong>. Both share the same file data (same v-node), so B\'s write is visible to A.'
        : 'fork() and dup() copy the fd but point at the <strong>same open-file-table entry</strong>, so there is <strong>one shared offset</strong>.';
      function o(i, h) { return { label: h, kind: 'txt', text: out[i], how: why.split('.')[0] }; }
      return {
        q: 'The file holds <code>' + text.join(',') + '</code> starting at offset ' + base + '. ' + setup + ' In order:',
        parts: [
          o(0, '1. A reads 1 byte:'),
          o(1, '2. B reads 1 byte:'),
          o(3, '3. B writes ' + w.join(',') + '; then A reads 1 byte:'),
          o(4, '4. B reads 1 byte:')
        ],
        extra: '<p>' + why + '</p>'
      };
    });
  }

  /* ---------- hybrid index ---------- */
  function index(el) {
    card(el, function () {
      var B = pick([512, 1024, 2048, 4096, 8192]), a = pick([4, 4, 8]), d = pick([8, 10, 12, 13, 14, 15, 16]);
      var h = calc.hybrid(B, a, d);
      var kind = pick(['direct', 'single', 'double']);
      var lbn = kind === 'direct' ? rint(0, d - 1) : kind === 'single' ? rint(d, d + h.ptrs - 1) : rint(d + h.ptrs, d + h.ptrs + 3 * h.ptrs);
      var off = lbn * B + rint(0, B - 1), w = calc.where(B, a, d, off);
      return {
        q: 'Blocks are <strong>' + fmt(B) + ' bytes</strong>, disk addresses are <strong>' + a + ' bytes</strong>, the inode has <strong>' + d + ' direct</strong> pointers, then one single, one double and one triple indirect pointer.',
        parts: [
          { label: 'Pointers that fit in one indirect block:', answer: h.ptrs, how: fmt(B) + ' / ' + a },
          { label: 'Smallest file offset that needs the single indirect block:', answer: h.firstSingle, how: 'the direct pointers cover blocks 0…' + (d - 1) + ', i.e. bytes 0…' + fmt(h.firstSingle - 1) + '; the next byte is ' + d + ' × ' + fmt(B) },
          { label: 'Smallest offset that needs the double indirect block:', answer: h.firstDouble, how: '(' + d + ' + ' + h.ptrs + ') × ' + fmt(B) },
          { label: 'Offset ' + fmt(off) + ' is in logical block number:', answer: w.lbn, how: '⌊' + fmt(off) + ' / ' + fmt(B) + '⌋' },
          { label: 'Disk reads to fetch that byte (inode already in memory, nothing else cached):', answer: w.reads, how: 'LBN ' + w.lbn + ' is reached through the <strong>' + w.kind + '</strong> pointer: ' + (w.reads - 1) + ' index block(s) + 1 data block' }
        ]
      };
    });
  }

  function maxsize(el) {
    card(el, function () {
      var B = pick([256, 400, 500, 512, 800, 1000, 1024, 2048]), a = pick([4, 4, 8]);
      if (B % a) B = 512;
      var d = rint(4, 14), s = pick([1, 1, 2, 3]), dd = pick([0, 1, 1, 2]), t = pick([0, 0, 1]);
      var m = calc.maxsize(B, a, d, s, dd, t);
      var desc = d + ' direct, ' + s + ' single indirect, ' + dd + ' double indirect, ' + t + ' triple indirect';
      return {
        q: 'Block size <strong>' + B + ' bytes</strong>, block addresses <strong>' + a + ' bytes</strong>; the inode has ' + desc + ' pointer(s). Largest file?',
        parts: [
          { label: 'Pointers per index block p =', answer: m.ptrs, how: B + ' / ' + a },
          { label: 'Data blocks the file can have:', answer: m.blocks, how: d + ' + ' + s + '·p' + (dd ? ' + ' + dd + '·p²' : '') + (t ? ' + ' + t + '·p³' : '') + ' with p = ' + m.ptrs },
          { label: 'Largest file in bytes:', answer: m.bytes, how: fmt(m.blocks) + ' × ' + B }
        ]
      };
    });
  }

  function extent(el) {
    card(el, function () {
      var n = rint(3, 4), ext = [], pbn = rint(100, 900);
      for (var i = 0; i < n; i++) { var len = rint(2, 9); ext.push([pbn, len]); pbn += len + rint(5, 400); }
      var total = ext.reduce(function (s, e) { return s + e[1]; }, 0);
      var l1 = rint(0, ext[0][1] - 1), l2 = rint(ext[0][1], total - 1);
      var rows = ext.map(function (e, i) { return '(' + e[0] + ', ' + e[1] + ')'; }).join(' &nbsp; ');
      function how(l) {
        var x = l, k = 0; while (x >= ext[k][1]) { x -= ext[k][1]; k++; }
        return 'skip ' + (k ? 'extents 1…' + k + ' (' + (l - x) + ' blocks), ' : '') + 'then ' + x + ' into extent ' + (k + 1) + ': ' + ext[k][0] + ' + ' + x;
      }
      return {
        q: 'A file\'s extents, as (starting PBN, length in blocks), in order: <code>' + rows + '</code>',
        parts: [
          { label: 'Physical block of logical block ' + l1 + ':', answer: calc.extent(ext, l1), how: how(l1) },
          { label: 'Physical block of logical block ' + l2 + ':', answer: calc.extent(ext, l2), how: how(l2) },
          { label: 'How many blocks long is the file?', answer: total, how: 'add the lengths' }
        ]
      };
    });
  }

  function path(el) {
    var names = ['a', 'b', 'usr', 'home', 'x', 'lib', 'n', 'w', 'gn', 'brd', 'src', 'tmp', 'etc', 'k', 'q', 'doc'];
    card(el, function () {
      var k = rint(2, 7), comps = []; for (var i = 0; i < k; i++) comps.push(pick(names));
      var p = '/' + comps.join('/');
      return {
        q: 'Path <code>' + p + '</code>. No inodes or data blocks are in memory; every inode is in its own block; each directory fits in one block; inodes stay in memory once read.',
        parts: [
          { label: 'Components after the root:', answer: k, how: 'count the names between slashes' },
          { label: 'Directories that must be searched (including /):', answer: k, how: 'every directory on the way: / and the first ' + (k - 1) + ' names' },
          { label: 'Fewest disk reads to read the file\'s first byte:', answer: 2 * (k + 1), how: 'each directory costs inode + data block = 2 × ' + k + '; the file costs its inode + its first data block = 2 → 2(' + k + ' + 1)' }
        ]
      };
    });
  }

  root.FS = { calc: calc, disk: disk, fd: fd, index: index, maxsize: maxsize, extent: extent, path: path };
})(typeof window !== 'undefined' ? window : globalThis);
