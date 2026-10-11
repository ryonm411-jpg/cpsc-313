# Notes

- 2026-10-09: User asked to be taught slides 2.3 (forwarding) and 2.4 (branch prediction); pasted P8.1–P10.1, I9.x, I10.x, 10.2 questions. Mission inferred from these — confirm.
- Course y86 includes `mulq`, `divq` (and likely `modq`). In-class problems use `Ln_N:` labels and uninitialised registers (= 0); divide-by-zero can occur on paths (simulator treats as 0).
- Timing model in `assets/y86pipe.js` verified against slide facts: no-fwd 3/2/1/0 stalls; load/use 1 stall + m_valM; ret 3; jXX 2 (stall or squash).
- Open question: course CPI convention — CS:APP's (I + bubbles)/I used for now.
- Assets: `course.css` (shared style), `quiz.js` (declarative quizzes), `y86pipe.js` (interpreter + timing + diagram; supports `.quad` data + `irmovq label`), `drills.js` (forwarding drill, lost-cycles drill, sandbox), `reorder.js` (lettered-instruction reorder checker), `bench.js` (multi-version lab notebook: I / bubbles / CPI / cycles / correctness). Reuse these.
- 2026-10-09 (session 2): User pasted Tutorial 4 (pipelining wrap-up: shuffling instructions; recursive vs loop `sum`). Built Lesson 3 (scheduling) + Lesson 4 (C → fast y86) + playbook reference. Verified answers: shuffle program = 0 SEQ / 8 no-fwd / min 4 reordered (e.g. ABDECFGH, 26 ties) / 0 with fwd. Recursive sum n=10 (fwd+BTFNT, 4-instr main) = 128 I, 55 bubbles, 187 cycles; best count-down loop = 60 I, 69 cycles; unrolled×2 = 58 cycles.
- recr-start.s / loop-start.s are in the user's student repo, not this workspace — lesson numbers use our own 4-instruction driver, so totals may differ slightly from theirs.
- Lab 5 (heapsort optimization in y86) is the next big deliverable; tutorial objectives not yet covered by a lesson: latency/throughput SEQ vs PIPE, allocating logic blocks to stages to minimise clock cycle. Good candidate for Lesson 5.
- No learning records written yet: no evidence of mastery observed so far (only material delivered). Ask the user how the drills/quizzes went next session.
