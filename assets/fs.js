/* fs.js — random drills for Quiz 4 (disks and file systems).
 *
 * FS.disk(el)     average access time to read one sector: seek + half a rotation + one sector's transfer
 * FS.fd(el)       two processes reading/writing one file: separate open() vs fork() vs dup()
 * FS.index(el)    hybrid index: first indirect offset, which pointer covers an offset, disk reads
 * FS.maxsize(el)  largest file for a hybrid index (direct + single + double [+ triple])
 * FS.extent(el)   extent list → physical block number of a logical block
 * FS.path(el)     disk reads to resolve a path and read the file's first byte
 * FS.lseek(el)    return values of lseek / read on a file of known size
 * FS.layout(el)   contiguous vs scattered blocks: time to read a whole file
 * FS.dirdump(el)  read a v6-style directory block from a hex dump (16-byte entries, little-endian)
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
          (x.kind ? ' placeholder="' + (x.ph || 'letter') + '" style="width:' + (x.w || '5rem') + '"' : '') + '> ' + (x.unit || '') + '</p>';
      }).join('') + '<div class="row"><button class="btn chk" type="button">Check</button></div><div class="why"></div>';
      var inputs = box.querySelectorAll('.n');
      function ok(i) {
        var x = p.parts[i], v = inputs[i].value;
        if (x.kind) return [x.text].concat(x.alts || []).some(function (t) { return norm(v) === norm(t); });
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
    // whole-file read time: blocks on one track (contiguous) vs every block needing its own seek
    layout: function (seek, rpm, spt, n) {
      var rev = 60000 / rpm, x = rev / spt;
      return { contig: seek + rev / 2 + n * x, scattered: n * (seek + rev / 2 + x) };
    },
    // v6-style directory: entries [inode, name] -> bytes (16 per entry: 2-byte LE inode, 14-byte name)
    v6dir: function (entries) {
      var b = [];
      entries.forEach(function (e) {
        b.push(e[0] & 255, (e[0] >> 8) & 255);
        for (var i = 0; i < 14; i++) b.push(i < e[1].length ? e[1].charCodeAt(i) : 0);
      });
      return b;
    },
    v6parse: function (bytes) {
      var out = [];
      for (var o = 0; o + 16 <= bytes.length; o += 16) {
        var ino = bytes[o] | (bytes[o + 1] << 8), name = '';
        for (var i = 2; i < 16 && bytes[o + i]; i++) name += String.fromCharCode(bytes[o + i]);
        out.push([ino, name]);
      }
      return out;
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


  function lseek(el) {
    card(el, function () {
      var S = rint(300, 5000), a = rint(0, S - 1), n = pick([50, 100, 200, 500, 1000]);
      if (Math.random() < 0.4) a = S - rint(1, Math.min(n - 1, S - 1));
      var got = Math.min(n, S - a), off = a + got, k = rint(1, Math.min(off, 300)), m = pick([10, 64, 128]);
      return {
        q: 'A file is <strong>' + fmt(S) + ' bytes</strong> long. A program opens it with <code>O_RDONLY</code> and then runs these calls in order. What does each one return?',
        parts: [
          { label: '<code>lseek(fd, ' + a + ', SEEK_SET)</code> returns', answer: a, how: 'SEEK_SET puts the offset exactly at ' + a + ', and lseek returns the new offset' },
          { label: '<code>read(fd, buf, ' + n + ')</code> returns', answer: got, how: got < n ? 'only ' + fmt(S) + ' − ' + a + ' = ' + got + ' bytes are left before the end, so read returns fewer than you asked for (a "short read")' : 'at least ' + n + ' bytes are left, so it reads all ' + n + ' and the offset becomes ' + off },
          { label: '<code>lseek(fd, -' + k + ', SEEK_CUR)</code> returns', answer: off - k, how: 'the offset was ' + off + ' after the read, and SEEK_CUR moves relative to it: ' + off + ' − ' + k },
          { label: '<code>lseek(fd, 0, SEEK_END)</code> returns', answer: S, how: 'SEEK_END means the file size plus the amount given: ' + fmt(S) + ' + 0' },
          { label: '<code>read(fd, buf, ' + m + ')</code> returns', answer: 0, how: 'the offset is at the end of the file, and read returns <strong>0</strong> at end-of-file (−1 would mean an error)' }
        ]
      };
    });
  }

  function layout(el) {
    card(el, function () {
      var seek = pick([4, 5, 6, 8, 9, 10, 12]), rpm = pick([5400, 6000, 7200, 10000, 12000, 15000]);
      var spt = pick([100, 200, 250, 400, 500]), n = pick([10, 20, 25, 40, 50, 80, 100]);
      var c = calc.layout(seek, rpm, spt, n), rev = 60000 / rpm;
      return {
        q: 'Average seek <strong>' + seek + ' ms</strong>, <strong>' + fmt(rpm) + ' RPM</strong>, <strong>' + spt + ' sectors per track</strong>. A file is <strong>' + n + ' blocks</strong>, and one block is one sector. Time to read the whole file (2 decimals):',
        parts: [
          { label: 'All on one track, one after another:', unit: 'ms', answer: r2(c.contig), tol: 0.011, how: 'one seek and one half rotation, then the ' + n + ' sectors stream past: ' + seek + ' + ' + r4(rev / 2) + ' + ' + n + ' × ' + r4(rev / spt) },
          { label: 'Scattered, every block in a random place:', unit: 'ms', answer: r2(c.scattered), tol: 0.011, how: 'every block pays seek + half rotation + transfer: ' + n + ' × (' + seek + ' + ' + r4(rev / 2) + ' + ' + r4(rev / spt) + ')' },
          { label: 'How many times slower is scattered? (1 decimal)', answer: Math.round(c.scattered / c.contig * 10) / 10, tol: 0.051, how: r2(c.scattered) + ' / ' + r2(c.contig) + '. This is why file systems try to keep a file\'s blocks together.' }
        ]
      };
    });
  }

  function hex2(x) { return (x < 16 ? '0' : '') + x.toString(16); }
  function dumpHTML(bytes) {
    var rows = [];
    for (var o = 0; o < bytes.length; o += 16) {
      var h = [], t = '';
      for (var i = 0; i < 16; i++) { var b = bytes[o + i]; h.push(hex2(b)); t += b >= 32 && b < 127 ? String.fromCharCode(b) : '.'; }
      rows.push(('000' + o.toString(16)).slice(-4) + ':  ' + h.slice(0, 8).join(' ') + '  ' + h.slice(8).join(' ') + '  ' + t.replace(/&/g, '&amp;').replace(/</g, '&lt;'));
    }
    return '<pre style="font-size:.78rem">' + rows.join('\n') + '</pre>';
  }

  function dirdump(el) {
    var names = ['notes', 'src', 'a.out', 'lab8', 'tmp', 'bin', 'data.txt', 'main.c', 'README', 'docs', 'q4', 'shell.c', 'x'];
    card(el, function () {
      var self = rint(2, 1500), parent = rint(1, 1500), pool = names.slice(), es = [[self, '.'], [parent, '..']];
      var k = rint(3, 4);
      for (var i = 0; i < k; i++) { var nm = pool.splice(rint(0, pool.length - 1), 1)[0]; es.push([rint(2, 3000), nm]); }
      var dead = Math.random() < 0.7 ? rint(2, es.length - 1) : -1;
      if (dead >= 0) es[dead] = [0, es[dead][1]];
      var live = es.filter(function (e) { return e[0] !== 0; }), target = live[rint(2, live.length - 1)];
      if (target[0] < 256 && Math.random() < 0.7) target[0] += 256 * rint(1, 9);
      var bytes = calc.v6dir(es);
      return {
        q: 'Assumed format (v6 style; check it against your slides): each directory entry is <strong>16 bytes</strong>, made of a <strong>2-byte little-endian inode number</strong> and then a <strong>14-byte name</strong> padded with zero bytes. Inode number 0 means the slot is unused. Here is one directory\'s data block:' + dumpHTML(bytes),
        parts: [
          { label: 'Inode number of <code>' + target[1] + '</code> (decimal):', answer: target[0], how: 'its first two bytes are ' + hex2(target[0] & 255) + ' ' + hex2(target[0] >> 8) + '. Little-endian puts the low byte first, so read them backwards: 0x' + hex2(target[0] >> 8) + hex2(target[0] & 255) + ' = ' + target[0] },
          { label: 'Inode number of this directory\'s parent:', answer: es[1][0], how: 'the parent is the <code>..</code> entry: 0x' + hex2(es[1][0] >> 8) + hex2(es[1][0] & 255) + ' = ' + es[1][0] },
          { label: 'How many entries are in use (count . and ..):', answer: live.length, how: es.length + ' slots' + (dead >= 0 ? ', minus the one whose inode number is 00 00. It was deleted, but its old name bytes are still there' : ', and none has inode 0') }
        ]
      };
    });
  }

  root.FS = { card: card, calc: calc, disk: disk, fd: fd, index: index, maxsize: maxsize, extent: extent, path: path, lseek: lseek, layout: layout, dirdump: dirdump };
})(typeof window !== 'undefined' ? window : globalThis);
