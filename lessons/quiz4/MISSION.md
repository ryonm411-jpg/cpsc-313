# Mission: Quiz 4 (CPSC 313, Unit 4)

> Separate from the top-level MISSION.md (Quiz 2), lessons/quiz1/ and lessons/quiz3/.

## Why
Do well on Quiz 4: 50 minutes in ORCA (PrairieTest). Started 2026-11-23; the student describes themselves as a complete beginner on these topics. Quiz date not yet given.

## Success looks like
- Explain MSI and MESI states and transitions, and where the two differ.
- Explain why disks are block devices; compute access time; reason about RPM, seek and sector changes.
- Define a file descriptor, use it in C, trace fd / open-file / v-node tables through open, close, fork, dup, dup2; write I/O redirection.
- Map offsets through flat, extent and hybrid indexes; first-indirect offsets; max file size; block-size trade-offs.
- Count disk reads for path resolution; hard vs symbolic links; inode / directory / directory entry.
- Read binary dumps of directories: course format is the macOS dirent (u32 ino, u16 reclen, u8 type, u8 namlen), Lesson 9.
- Schedule (pasted 2026-11-25): Quiz 4 is week 12 (week of 11/23) and covers 11/4 Using File System APIs, 11/6 File Descriptor Management, 11/13 Representing Files, 11/16 Building a file index, 11/18 Naming (incl. metadata/stat), 11/20 File System Case Studies (v6, ext2 vs v6).

## Constraints
- In the quiz: y86 sheets, cache summary, Amdahl, MSI and MESI diagrams, man pages (open, close, fopen, fclose, read, write, lseek, dup, fork, execve, pipe, ascii).
- Course slides override outside sources (course MSI: M -> I on a remote read).
