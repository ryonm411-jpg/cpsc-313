# y86 Pipelining Resources

## Knowledge

- [Course slides 2.3: Pipelining — Forwarding](./2.3-valueForwarding%20(2).pdf)
  The authority for course conventions. Use for: need-vs-have reasoning, the three forwarding ideas that don't work.
- [Course slides 2.4: Pipelining — Branch Prediction](./2.4-branchPrediction.pdf)
  Use for: control-hazard costs (jmp/call 0, ret 3, jXX 2), predictor success rates, squashing, likely/unlikely.
- [Book: _Computer Systems: A Programmer's Perspective_ 3e, Bryant & O'Hallaron](https://csapp.cs.cmu.edu/)
  The course textbook; y86 and PIPE come from Chapter 4. Use for: §4.5.4 next-PC prediction, §4.5.5 hazards (forwarding, load/use, control), §4.5.8 pipeline control logic, §4.5.9 CPI.
- CS:APP 3e Chapter 5, "Optimizing Program Performance" (same book as above)
  Use for: Lab 5 — loop unrolling (§5.8), eliminating loop inefficiencies (§5.4), the general measure-then-optimize mindset. Also §3.7 (procedures, stack frames, callee-saved registers §3.7.5) for recursion costs.
- Tutorial 4 starter files `recr-start.s`, `loop-start.s` (student repo, not in this workspace)
  Use for: exact numbers the TAs expect; ask the user to paste them if needed.
- [Paper: Yavarzadeh et al., "Half&Half: Demystifying Intel's Directional Branch Predictors"](https://ieeexplore.ieee.org/document/10179415/)
  Cited in slides 2.4. Use for: curiosity about real-world predictors only; beyond course scope.

## Wisdom (Communities)

- Course discussion board (Piazza/Ed) and TA office hours
  Use for: confirming course-specific conventions (e.g. whether CPI includes pipeline-fill cycles), checking hand-traced answers.

## Gaps

- No confirmed statement yet of the course's exact CPI convention (fill cycles included or not).

## Quiz 3 (Unit 3)

- Course slides 2.6, 3.1-3.7 (in the parent folder `cpsc-313/`)
  The authority for Quiz 3. Note the course MSI diagram in 3.7 differs from many other sources (M -> I on a remote read).
- Quiz references: `summary-of-cache-parameters.pdf`, `amdahls-reference.pdf`, `diagramMESI.pdf` (parent folder)
  The sheets available during the quiz.
- CS:APP 3e §6.2-6.4 (memory hierarchy and caches), §6.4.5 (writes), §1.9.1 (Amdahl's Law)
  The readings listed on the slides, plus the book's Amdahl section.

## Quiz 4 (Unit 4)

- [OSTEP ch. 37 "Hard Disk Drives"](https://pages.cs.wisc.edu/~remzi/OSTEP/file-disks.pdf): geometry, seek/rotation/transfer, I/O time.
- [OSTEP ch. 39 "Files and Directories"](https://pages.cs.wisc.edu/~remzi/OSTEP/file-intro.pdf): fds, directories, hard and symbolic links.
- [OSTEP ch. 40 "File System Implementation"](https://pages.cs.wisc.edu/~remzi/OSTEP/file-implementation.pdf): inodes, multi-level index, extents, path-read walkthrough.
- CS:APP 3e §6.1.2 (disks), §10.8 (fd / open file / v-node tables), §10.9 (I/O redirection with dup2).
- GAP: the course's unit 4 slides (file systems, directory dump format) haven't been supplied yet.

## Course slides, Unit 4 (in cpsc-313/, supplied 2026-11-25)
- 4.1 fsDecisionSpace, 4.2 fsAdvanced (fd sharing rules, redirection), 4.3 fsFileRepresentation (extents, block size, fragmentation), 4.4 fsFileIndex (flat / multi-level / hybrid, worked LBN 3074 example), 4.5 fsNaming (path walk, dirent, links, hexdump hints), 4.6 fsExt2 (block groups, bitmaps, ext2 inode and dir entries). No v6 deck: P23 was pre-reading.
- Man pages: open, close, fopen, fclose, read, write, lseek, dup, fork, execve, pipe, ascii (PDFs in cpsc-313/; also provided in the quiz).
- Course v6 demo: https://www.students.cs.ubc.ca/~cs-313/v6fs/ (linked from slides 4.5).
- Tutorial 8 and 9 solutions (pasted by the student, course GitHub repo CPSC313-2026W1).
