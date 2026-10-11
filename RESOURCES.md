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
