/* fs2.js — Quiz 4 drills in the exact PrairieLearn formats of the course (I22, I24, I25, L8-Ind).
 *
 * Course conventions (slides 4.4, 4.5 and the pasted practice questions):
 *   - "Neither the file's metadata structure nor any other data has been read": the inode read COUNTS as an IO.
 *   - Multi-level index: the inode holds the root pointer(s); the tree is only as deep as the file size needs.
 *   - Index positions are numbered from 0; "Level 1" is the top (root) index block; unused levels are -1.
 *   - Hybrid metadata positions: directs first, then indirect(s), then double(s), then triple(s).
 *   - dirent (macOS, 32-bit inode): ino u32 LE | reclen u16 LE | type u8 | namlen u8 | name, padded to 4 bytes.
 *     DT_DIR 4, DT_REG 8, DT_LNK 10. Inode 0 = deleted entry. hexdump shows 16 bytes per line.
 *
 * FS2.ios(el)       IOs to read one block: single extent / multi-level / hybrid (nothing cached)
 * FS2.maxkb(el)     maximum file size in KB: extent / flat / multi-level / hybrid
 * FS2.levels(el)    index positions at each level (multi-level, L8-Ind.13) or hybrid (L8-Ind.14)
 * FS2.blocks(el)    follow pointers through a table of disk blocks (I24.4 / I24.5)
 * FS2.dirent(el)    decode a directory hexdump (I25.1–I25.4)
 * FS2.fdoff(el)     offsets and bytes read with dup2, separate opens and threads (I22)
 * Needs quiz.js and fs.js first. FS2.calc works in node for checking.
 */
(function (root) {
  'use strict';
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function rint(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
  function fmt(n) { return n.toLocaleString('en-US'); }
  function hx(n, w) { var s = n.toString(16); while (s.length < (w || 2)) s = '0' + s; return s; }

  var calc = {
    // number of index levels a multi-level tree needs for a file of n blocks (p pointers per block, r roots in the inode)
    depth: function (p, n, r) { r = r || 1; var L = 0, cap = r; while (cap < n) { L++; cap = r * Math.pow(p, L); } return L; },
    ioExtent: function () { return 2; },                                    // inode + the data block
    ioMulti: function (B, a, n, r) { return 1 + calc.depth(B / a, n, r) + 1; },  // inode + index levels + data
    ioHybrid: function (B, a, d, s, dd, t, lbn) {
      var p = B / a, r = lbn - d;
      if (r < 0) return 2;
      if (r < s * p) return 3;
      r -= s * p; if (r < dd * p * p) return 4;
      return 5;
    },
    kbExtent: function (B, maxBlocks) { return maxBlocks * B / 1024; },
    kbFlat: function (B, a, idxBlocks) { return idxBlocks * (B / a) * B / 1024; },
    kbMulti: function (B, a, roots, levels) { return roots * Math.pow(B / a, levels) * B / 1024; },
    kbHybrid: function (B, a, d, s, dd, t) { var p = B / a; return (d + s * p + dd * p * p + t * p * p * p) * B / 1024; },
    // multi-level positions, top-down; -1 for levels the file does not need
    multiIdx: function (p, n, maxL, lbn) {
      var L = calc.depth(p, n, 1), out = [];
      for (var k = 1; k <= maxL; k++) out.push(k <= L ? Math.floor(lbn / Math.pow(p, L - k)) % p : -1);
      return out;
    },
    // hybrid positions: [metadata, indirect block, double block, triple block]
    hybridIdx: function (p, d, s, dd, t, lbn) {
      if (lbn < d) return [lbn, -1, -1, -1];
      var r = lbn - d;
      if (r < s * p) return [d + Math.floor(r / p), r % p, -1, -1];
      r -= s * p;
      if (r < dd * p * p) return [d + s + Math.floor(r / (p * p)), r % p, Math.floor((r % (p * p)) / p), -1];
      r -= dd * p * p;
      return [d + s + dd + Math.floor(r / (p * p * p)), r % p, Math.floor((r % (p * p)) / p), Math.floor((r % (p * p * p)) / (p * p))];
    },
    reclen: function (namlen) { return Math.ceil((8 + namlen + 1) / 4) * 4; },
    // parse dirent bytes → [{off, ino, reclen, type, name}]
    dirents: function (b) {
      var out = [];
      for (var o = 0; o + 8 <= b.length;) {
        var ino = (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0, rl = b[o + 4] | (b[o + 5] << 8);
        var nl = b[o + 7], name = '';
        for (var i = 0; i < nl; i++) name += String.fromCharCode(b[o + 8 + i]);
        out.push({ off: o, ino: ino, reclen: rl, type: b[o + 6], name: name });
        if (!rl) break; o += rl;
      }
      return out;
    }
  };
  var TYPE = { 4: 'DT_DIR', 8: 'DT_REG', 10: 'DT_LNK' };

  /* ---------- I24.1–3 + I26.3: IOs to read one block ---------- */
  function ios(el) {
    root.FS.card(el, function () {
      var kind = pick(['extent', 'multi', 'multi', 'hybrid', 'hybrid']);
      var B = pick([512, 1024, 2048, 4096, 8192]), a = pick([4, 4, 8]), p = B / a;
      var intro = 'Block size <strong>' + fmt(B) + '</strong> bytes, disk addresses <strong>' + a + '</strong> bytes. Neither the file\'s metadata structure nor any of its data or metadata has been read yet.';
      if (kind === 'extent') {
        var mx = rint(100000, 400000), lbn = rint(1000, mx - 1);
        return { q: 'Files use a <strong>single extent</strong> (max ' + fmt(mx) + ' blocks). ' + intro + ' How many IOs to read block number ' + fmt(lbn) + '?',
          parts: [{ label: 'IOs:', answer: 2, how: 'read the inode (it holds the start of the extent), then the data block at start + ' + fmt(lbn) + '. The block number never changes the count' }] };
      }
      if (kind === 'multi') {
        var maxL = pick([2, 3]), n = pick([rint(2, p), rint(p + 1, p * p), p, p * 4, 1]);
        if (maxL === 2 && n > p * p) n = p * p;
        var lb = rint(0, n - 1), L = calc.depth(p, n, 1);
        return { q: 'Files use a <strong>multi-level index</strong> (only as deep as the file needs, at most ' + maxL + ' levels of index blocks). ' + intro + ' The file has <strong>' + fmt(n) + ' blocks</strong>. How many IOs to read block number ' + fmt(lb) + '?',
          parts: [{ label: 'IOs:', answer: 2 + L, how: p + ' pointers per index block. ' + fmt(n) + ' blocks need ' + L + ' level(s) of index blocks (' + (L === 0 ? 'one block: the inode points straight at it' : L === 1 ? '≤ ' + p + ', so one index block' : '> ' + p + ', so ' + L + ' levels') + '). IOs = inode + ' + L + ' index + data = ' + (2 + L) }] };
      }
      var d = rint(4, 14), s = pick([1, 1, 2]), dd = 1, t = pick([0, 1]), region = pick(['direct', 'single', 'double', 'double', t ? 'triple' : 'double']);
      var lbh = region === 'direct' ? rint(0, d - 1) : region === 'single' ? rint(d, d + s * p - 1) : region === 'double' ? rint(d + s * p, d + s * p + p * p - 1) : d + s * p + p * p + rint(0, p * p * 3);
      var io = calc.ioHybrid(B, a, d, s, dd, t, lbh);
      return { q: 'Files use a <strong>hybrid index</strong> with ' + d + ' direct, ' + s + ' indirect, 1 double indirect and ' + t + ' triple indirect pointer(s) in the metadata. ' + intro + ' How many IOs to read block number ' + fmt(lbh) + '?',
        parts: [{ label: 'IOs:', answer: io, how: 'p = ' + p + '. Directs cover 0–' + (d - 1) + ', indirect(s) up to ' + fmt(d + s * p - 1) + ', double up to ' + fmt(d + s * p + p * p - 1) + '. Block ' + fmt(lbh) + ' is ' + ['', '', 'direct', 'under an indirect', 'under the double indirect', 'under the triple indirect'][io] + ': inode + ' + (io - 2) + ' index block(s) + data = ' + io }] };
    });
  }

  /* ---------- L8-Ind.9–12: max size in KB ---------- */
  function maxkb(el) {
    root.FS.card(el, function () {
      var kind = pick(['extent', 'flat', 'multi', 'hybrid']);
      var B = pick([1024, 2048, 4096, 8192]), a = 4, p = B / a;
      var head = 'Block size <strong>' + fmt(B) + '</strong> bytes, disk addresses <strong>' + a + '</strong> bytes. ';
      if (kind === 'extent') {
        var mx = rint(100000, 500000);
        return { q: head + 'Files are a <strong>single extent</strong> of at most ' + fmt(mx) + ' blocks. Maximum file size in KB?',
          parts: [{ label: 'KB:', answer: calc.kbExtent(B, mx), how: fmt(mx) + ' blocks × ' + B / 1024 + ' KB. The address size is a distractor' }] };
      }
      if (kind === 'flat') {
        var ib = rint(100, 3000);
        return { q: head + 'Files use a <strong>flat index</strong> with a maximum index size of ' + fmt(ib) + ' blocks. Maximum file size in KB?',
          parts: [{ label: 'KB:', answer: calc.kbFlat(B, a, ib), how: 'each index block holds ' + p + ' addresses: ' + fmt(ib) + ' × ' + p + ' = ' + fmt(ib * p) + ' data blocks × ' + B / 1024 + ' KB' }] };
      }
      if (kind === 'multi') {
        var L = pick([2, 3]), r = pick([1, 1, 2]);
        if (B === 8192 && L === 3) L = 2;
        return { q: head + 'Files use a <strong>multi-level index</strong> with ' + r + ' pointer(s) in the file metadata and at most ' + L + ' levels of index blocks. Maximum file size in KB?',
          parts: [{ label: 'KB:', answer: calc.kbMulti(B, a, r, L), how: r + ' × ' + p + '^' + L + ' = ' + fmt(r * Math.pow(p, L)) + ' data blocks × ' + B / 1024 + ' KB' }] };
      }
      var d = rint(4, 12), s = pick([1, 2]), dd = 1, t = pick([0, 1]);
      if (B === 8192 && t) B = 2048, p = 512, head = 'Block size <strong>2,048</strong> bytes, disk addresses <strong>4</strong> bytes. ';
      var blocks = d + s * p + dd * p * p + t * p * p * p;
      return { q: head + 'Files use a <strong>hybrid index</strong> with ' + d + ' direct, ' + s + ' indirect, 1 double indirect and ' + t + ' triple indirect pointer(s). Maximum file size in KB?',
        parts: [{ label: 'KB:', answer: calc.kbHybrid(B, a, d, s, dd, t), how: d + ' + ' + s + '·' + p + ' + ' + p + '²' + (t ? ' + ' + p + '³' : '') + ' = ' + fmt(blocks) + ' blocks × ' + B / 1024 + ' KB' }] };
    });
  }

  /* ---------- L8-Ind.13–14: index positions ---------- */
  function levels(el) {
    root.FS.card(el, function () {
      var B = pick([1024, 2048, 4096, 8192]), a = 4, p = B / a;
      if (Math.random() < 0.5) {
        var maxL = 3, n = pick([rint(2, p), rint(p + 1, p * 50), p * p + rint(1, p * p)]), lbn = rint(0, n - 1);
        var ix = calc.multiIdx(p, n, maxL, lbn), L = calc.depth(p, n, 1);
        var how = function (k) { return k > L ? 'the file only needs ' + L + ' level(s), so level ' + k + ' doesn\'t exist' : L === 1 ? 'one level: the position is the LBN itself' : 'level ' + k + ' of ' + L + ': ⌊' + fmt(lbn) + ' / ' + p + '^' + (L - k) + '⌋ mod ' + p; };
        return { q: 'Multi-level index, block size <strong>' + fmt(B) + '</strong>, 4-byte addresses, 1 pointer in the metadata, at most 3 levels. The file has <strong>' + fmt(n) + ' blocks</strong>. Position at each level for logical block <strong>' + fmt(lbn) + '</strong> (−1 if unused):',
          parts: [1, 2, 3].map(function (k) { return { label: 'Level ' + k + ' index:', answer: ix[k - 1], how: how(k) }; }) };
      }
      var d = rint(4, 12), t = 1, region = pick(['single', 'double', 'double', 'triple']);
      var lb = region === 'single' ? rint(d, d + p - 1) : region === 'double' ? rint(d + p, d + p + p * p - 1) : d + p + p * p + rint(0, p * p * 5);
      var h = calc.hybridIdx(p, d, 1, 1, t, lb), r1 = lb - d, r2 = r1 - p, r3 = r2 - p * p;
      var msg = region === 'single' ? lb + ' − ' + d + ' = ' + r1 + ' → indirect position ' + r1
        : region === 'double' ? fmt(lb) + ' − ' + d + ' − ' + p + ' = ' + fmt(r2) + ' → double position ⌊' + fmt(r2) + '/' + p + '⌋ = ' + h[2] + ', indirect position ' + fmt(r2) + ' mod ' + p + ' = ' + h[1]
        : fmt(lb) + ' − ' + d + ' − ' + p + ' − ' + p + '² = ' + fmt(r3) + ' → triple ⌊' + fmt(r3) + '/' + p + '²⌋ = ' + h[3] + ', double ⌊(' + fmt(r3) + ' mod ' + p + '²)/' + p + '⌋ = ' + h[2] + ', indirect ' + fmt(r3) + ' mod ' + p + ' = ' + h[1];
      return { q: 'Hybrid index, block size <strong>' + fmt(B) + '</strong>, 4-byte addresses, ' + d + ' direct, 1 indirect, 1 double, 1 triple pointer in the metadata. Positions for logical block <strong>' + fmt(lb) + '</strong> (−1 if unused):',
        parts: [
          { label: 'Metadata index:', answer: h[0], how: 'directs are 0–' + (d - 1) + ', indirect ' + d + ', double ' + (d + 1) + ', triple ' + (d + 2) },
          { label: 'Index in indirect block:', answer: h[1], how: msg },
          { label: 'Index in double indirect block:', answer: h[2], how: h[2] < 0 ? 'not used' : 'see above' },
          { label: 'Index in triple indirect block:', answer: h[3], how: h[3] < 0 ? 'not used' : 'see above' }
        ] };
    });
  }

  /* ---------- I24.4–5: follow pointers through a table of blocks ---------- */
  function blocks(el) {
    root.FS.card(el, function () {
      var p = 8, used = {}, rows = [];
      function pbn() { var x; do { x = rint(1000, 65535); } while (used[x]); used[x] = 1; return x; }
      function blk(vals) { var a = pbn(); rows.push([a].concat(vals)); return a; }
      function rnd() { var v = []; for (var i = 0; i < p; i++) v.push(rint(1000, 65535)); return v; }
      var kind = pick(['multi', 'hybrid']), lbn, ans, q, how;
      if (kind === 'multi') {
        lbn = rint(0, 63); var leafIdx = Math.floor(lbn / p), leaves = [];
        for (var i = 0; i < p; i++) leaves.push(rows.length < 3 || i === leafIdx ? blk(rnd()) : rint(1000, 65535));
        var leafRow = rows.filter(function (r) { return r[0] === leaves[leafIdx]; })[0];
        ans = leafRow[1 + lbn % p];
        var rootP = blk(leaves);
        q = 'Multi-level index, block size <strong>16</strong>, 2-byte addresses (so ' + p + ' per block), at most 2 levels, maximum-size file. The inode\'s index pointer is <strong>' + rootP + '</strong>. Physical address of logical block <strong>' + lbn + '</strong>?';
        how = 'Root block ' + rootP + ', position ⌊' + lbn + '/8⌋ = ' + leafIdx + ' → ' + leaves[leafIdx] + '. In that block, position ' + lbn + ' mod 8 = ' + (lbn % p) + ' → ' + ans;
      } else {
        var D = 4, direct = [], k;
        for (k = 0; k < D; k++) direct.push(rint(1000, 65535));
        lbn = pick([rint(4, 11), rint(12, 75), rint(12, 75)]);
        var single = blk(rnd()), dbl;
        var inner = []; for (k = 0; k < p; k++) inner.push(rint(1000, 65535));
        var r = lbn - D;
        if (r < p) {
          ans = rows[0][1 + r];
          var x1 = blk(rnd()); dbl = blk([x1].concat(rnd().slice(1)));
          how = lbn + ' − 4 directs = ' + r + ' < 8, so it\'s in the indirect block ' + single + ', position ' + r + ' → ' + ans;
        } else {
          r -= p; var di = Math.floor(r / p), ii = r % p, leaf = blk(rnd());
          inner[di] = leaf; dbl = blk(inner);
          ans = rows.filter(function (x) { return x[0] === leaf; })[0][1 + ii];
          how = lbn + ' − 4 − 8 = ' + r + ', so it\'s under the double indirect ' + dbl + ': position ⌊' + r + '/8⌋ = ' + di + ' → ' + leaf + ', then position ' + r + ' mod 8 = ' + ii + ' → ' + ans;
        }
        blk(rnd());
        q = 'Hybrid index, block size <strong>16</strong>, 2-byte addresses (' + p + ' per block). Metadata pointers: direct ' + direct.join(', ') + '; indirect <strong>' + single + '</strong>; double indirect <strong>' + dbl + '</strong>. Physical address of logical block <strong>' + lbn + '</strong>?';
      }
      rows.sort(function () { return Math.random() - 0.5; });
      var tbl = '<div class="table-scroll"><table class="data" style="font-family:var(--mono);font-size:.8rem"><tr><th>PBN</th><th colspan="8">contents (positions 0–7)</th></tr>' + rows.map(function (r) {
        return '<tr><td><strong>' + r[0] + '</strong></td>' + r.slice(1).map(function (v) { return '<td>' + v + '</td>'; }).join('') + '</tr>';
      }).join('') + '</table></div>';
      return { q: q + tbl, parts: [{ label: 'Disk address:', answer: ans, how: how }] };
    });
  }

  /* ---------- I25: directory hexdumps ---------- */
  var ANIMALS = ['Sparrow', 'Sheep', 'Fish', 'Baboon', 'Muskox', 'Turkey', 'Arctic fox', 'Reptile', 'Gorilla', 'Swift', 'Canid', 'Yak', 'Guanaco', 'Red panda', 'Fowl',
    'Pelican', 'Snail', 'Marsupial', 'Rodent', 'Chameleon', 'Pigeon', 'Starfish', 'Marmoset', 'Domestic canary', 'Sperm whale', 'Sockeye salmon', 'Otter', 'Lynx', 'Heron', 'Bison'];
  function hexdump(b) {
    var lines = [];
    for (var o = 0; o < b.length; o += 16) lines.push(hx(o, 7) + ' ' + b.slice(o, o + 16).map(function (x) { return hx(x); }).join(' '));
    lines.push(hx(b.length, 7));
    return '<pre style="font-size:.8rem">' + lines.join('\n') + '</pre>';
  }
  function makeDir() {
    var pool = ANIMALS.slice(), es = [], dirNo = 2, fileNo = 0x64;
    es.push({ ino: 0x100000, type: 4, name: '.' }, { ino: 0x100001, type: 4, name: '..' });
    var n = rint(6, 9);
    for (var i = 0; i < n; i++) {
      var name = pool.splice(rint(0, pool.length - 1), 1)[0], ty = pick([8, 8, 8, 10, 10, 4]);
      es.push({ ino: ty === 4 ? 0x100000 + dirNo++ : fileNo++, type: ty, name: name });
    }
    var dupOf = es[rint(3, es.length - 1)]; es.splice(rint(2, es.indexOf(dupOf)), 0, { ino: 0, type: dupOf.type, name: dupOf.name });
    var dead = rint(0, 1);
    for (var k = 0; k < dead; k++) { var j = rint(2, es.length - 1); if (es[j] !== dupOf) es[j].ino = 0; }
    var b = [], prev = [];
    es.forEach(function (e) {
      var rl = calc.reclen(e.name.length), start = b.length;
      b.push(e.ino & 255, (e.ino >> 8) & 255, (e.ino >> 16) & 255, (e.ino >>> 24) & 255, rl & 255, rl >> 8, e.type, e.name.length);
      for (var c = 0; c < e.name.length; c++) b.push(e.name.charCodeAt(c));
      b.push(0);
      while (b.length < start + rl) b.push(prev.length ? prev[(b.length) % prev.length] : 0);   // leftover junk, like the real dumps
      prev = e.name.split('').map(function (ch) { return ch.charCodeAt(0); });
    });
    return { es: es, b: b };
  }
  function dirent(el) {
    root.FS.card(el, function () {
      var d = makeDir(), live = d.es.filter(function (e) { return e.ino; }), files = live.slice(2), t = pick(files);
      var mode = pick(['name', 'type', 'ino', 'count']);
      var head = 'Directory entries are <code>struct dirent { u32 d_ino; u16 d_reclen; u8 d_type; u8 d_namlen; char d_name[]; }</code>, little-endian. DT_DIR 4, DT_REG 8, DT_LNK 10.' + hexdump(d.b);
      var at = d.es.indexOf(t), off = 0; for (var i = 0; i < at; i++) off += calc.reclen(d.es[i].name.length);
      var where = 'entry at offset 0x' + hx(off) + ': inode bytes ' + [0, 1, 2, 3].map(function (k) { return hx(d.b[off + k]); }).join(' ') + ' (low byte first) = 0x' + t.ino.toString(16) + ', reclen ' + calc.reclen(t.name.length) + ', type ' + t.type + ', namlen ' + t.name.length + ' → "' + t.name + '"';
      if (mode === 'name') return { q: head + 'What is the name of the object with inode number <strong>0x' + t.ino.toString(16) + '</strong>?', parts: [{ label: 'Name:', kind: 'txt', ph: 'name', w: '10rem', text: t.name, how: where }] };
      if (mode === 'type') return { q: head + 'What is the type of the object whose inode number is <strong>0x' + t.ino.toString(16) + '</strong>? (DIR, REG or LNK)', parts: [{ label: 'Type:', kind: 'txt', ph: 'DIR/REG/LNK', w: '8rem', text: TYPE[t.type].slice(3), alts: [TYPE[t.type], String(t.type)], how: where + '; type ' + t.type + ' = ' + TYPE[t.type] }] };
      if (mode === 'ino') {
        // the name might also appear in a deleted entry: the answer is the LIVE one
        return { q: head + 'What is the inode number (in hex) of <strong>' + t.name + '</strong>?', parts: [{ label: 'Inode: 0x', kind: 'txt', ph: 'hex', w: '6rem', text: t.ino.toString(16), alts: ['0x' + t.ino.toString(16)], how: where + '. Skip any entry with the same name whose inode is 00 00 00 00 (deleted)' }] };
      }
      var deadN = d.es.length - live.length;
      return { q: head + 'How many valid entries are in this directory? (Count <code>.</code> and <code>..</code>; skip entries whose inode is 0.)',
        parts: [{ label: 'Valid entries:', answer: live.length, how: 'walk by reclen: ' + d.es.length + ' entries, ' + deadN + ' with inode 0 (deleted) → ' + live.length + '. Without . and .. it would be ' + (live.length - 2) }] };
    });
  }

  /* ---------- I22: offsets with dup2, separate opens and threads ---------- */
  function fdoff(el) {
    root.FS.card(el, function () {
      var kind = pick(['dup2', 'open2', 'value', 'value', 'thread']), a = rint(200, 999), b = rint(200, 999);
      if (kind === 'dup2' || kind === 'open2') {
        var share = kind === 'dup2';
        var code = 'int fd1 = open("myfile.txt", O_RDWR, 0);\n' + (share ? 'int fd2 = fd1 + 1;\nassert(dup2(fd1, fd2) == fd2);' : 'int fd2 = open("myfile.txt", O_RDWR, 0);') + '\nchar buf[4096];\nread(fd1, buf, ' + a + ');\nread(fd2, buf, ' + b + ');';
        return { q: '<pre>' + code + '</pre>The file is big enough that no EOF happens.',
          parts: [
            { label: 'Offset of fd2:', answer: share ? a + b : b, how: share ? 'dup2 makes fd2 share fd1\'s open-file entry, so there is one offset: ' + a + ' + ' + b : 'two open() calls give two open-file entries with separate offsets; fd2 only read ' + b },
            { label: 'Offset of fd1:', answer: share ? a + b : a, how: share ? 'same shared offset' : 'fd1 read ' + a }
          ] };
      }
      if (kind === 'value') {
        var share2 = Math.random() < 0.5, w = rint(500, 999), r = share2 ? rint(100, 999) : pick([w, rint(100, w - 1), rint(w + 1, w + 300)]);
        var code2 = 'int fd1 = open("myfile.txt", O_RDWR, 0);\n' + (share2 ? 'int fd2 = fd1 + 1;\nassert(dup2(fd1, fd2) == fd2);' : 'int fd2 = open("myfile.txt", O_RDWR, 0);') +
          '\nmemset(buf, \'c\', 4096);\nwrite(fd1, buf, ' + w + ');\nwrite(fd1, &writebyte, 1);   // writebyte = \'X\'\nread(fd2, buf, ' + r + ');\nread(fd2, &readbyte, 1);';
        var pos = share2 ? w + 1 + r : r, ans = pos < w ? 'c' : pos === w ? 'X' : '?';
        var why = share2 ? 'shared offset: after the writes it is ' + (w + 1) + ', the read moves it to ' + (w + 1 + r) + ', so readbyte comes from offset ' + pos + ', past everything written: not enough information'
          : 'separate offsets: fd2 starts at 0, skips ' + r + ' bytes, and reads offset ' + r + '. The c\'s fill 0–' + (w - 1) + ' and X is at ' + w + ' → ' + (ans === '?' ? 'past the written data: not enough information' : ans);
        return { q: '<pre>' + code2 + '</pre>No EOF happens. What is <code>readbyte</code>? Type <strong>c</strong>, <strong>X</strong>, or <strong>?</strong> for "not enough information".',
          parts: [{ label: 'readbyte:', kind: 'txt', ph: 'c / X / ?', text: ans, how: why }] };
      }
      var t1own = Math.random() < 0.6, t2dup = Math.random() < 0.7;
      var c1 = t1own ? 'int fd2 = open("myfile.txt", O_RDONLY, 0);\nread(fd2, buf, ' + a + ');' : 'read(fd, buf, ' + a + ');';
      var c2 = t2dup ? 'int fd2 = 6;\nassert(dup2(fd, fd2) == fd2);\nread(fd2, buf, ' + b + ');' : 'int fd2 = open("myfile.txt", O_RDONLY, 0);\nread(fd2, buf, ' + b + ');';
      var off = (t1own ? 0 : a) + (t2dup ? b : 0);
      return { q: 'P opens myfile.txt into global <code>fd1</code>, starts threads T1 and T2 with <code>fd1</code> as their argument <code>fd</code>, and waits for both.<pre>// T1\n' + c1 + '\n// T2\n' + c2 + '</pre>No EOF happens.',
        parts: [{ label: 'Offset of fd1 when both finish:', answer: off, how: 'threads share the process\'s fd table. ' + (t1own ? 'T1 opened its own entry (no effect on fd1). ' : 'T1 reads through fd1 itself: +' + a + '. ') + (t2dup ? 'T2\'s dup2 makes fd 6 share fd1\'s entry: +' + b + '. ' : 'T2 opened its own entry (no effect). ') + '→ ' + off }] };
    });
  }

  root.FS2 = { calc: calc, ios: ios, maxkb: maxkb, levels: levels, blocks: blocks, dirent: dirent, fdoff: fdoff, hexdump: hexdump, makeDir: makeDir };
})(typeof window !== 'undefined' ? window : globalThis);
