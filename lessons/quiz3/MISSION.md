# Mission: Quiz 3 (CPSC 313, Unit 3)

> Separate from the top-level MISSION.md (Quiz 2 pipelining) and lessons/quiz1/.

## Why
Do well on Quiz 3: 50 minutes in ORCA, written about 2026-11-06 per the student (window Nov 3-7 per the slides). The student described having little to no knowledge of the topics on 2026-10-31. Past scores: Q0 77%, Q1 64%, Q2 81%.

## Success looks like
- Split any address and find tag, index, offset, sets and slots.
- Trace hits and misses under any associativity and replacement policy.
- Compute average access time, required hit rate, Amdahl speedup and multi-level miss times.
- Give write latency for every write policy combination and solve a break-even hit rate.
- Reason from a stride to a hit rate, and handle arrays slightly larger than the cache.
- Read MSI and MESI transitions and say where they differ, using the course diagrams.
- Place pipelining among other forms of parallelism, and still count hazard stalls.

## Constraints
- References in the quiz: y86 sheets, cache parameter summary, Amdahl's Law, MESI diagram. Nothing else.
- Course slides override other sources, notably the course MSI edge M -> I on a remote read.

## Out of scope
File systems and virtual memory (Quiz 4 onward).
