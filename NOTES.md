# Notes

- 2026-10-09: User asked to be taught slides 2.3 (forwarding) and 2.4 (branch prediction); pasted P8.1–P10.1, I9.x, I10.x, 10.2 questions. Mission inferred from these — confirm.
- Course y86 includes `mulq`, `divq` (and likely `modq`). In-class problems use `Ln_N:` labels and uninitialised registers (= 0); divide-by-zero can occur on paths (simulator treats as 0).
- Timing model in `assets/y86pipe.js` verified against slide facts: no-fwd 3/2/1/0 stalls; load/use 1 stall + m_valM; ret 3; jXX 2 (stall or squash).
- Open question: course CPI convention — CS:APP's (I + bubbles)/I used for now.
- Assets: `course.css` (shared style), `quiz.js` (declarative quizzes), `y86pipe.js` (interpreter + timing + diagram), `drills.js` (forwarding drill, lost-cycles drill, sandbox). Reuse these.
