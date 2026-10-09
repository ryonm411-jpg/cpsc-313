# y86 Pipelining Resources

## Knowledge

- [Course slides 2.3: Pipelining — Forwarding](./2.3-valueForwarding%20(2).pdf)
  The authority for course conventions. Use for: need-vs-have reasoning, the three forwarding ideas that don't work.
- [Course slides 2.4: Pipelining — Branch Prediction](./2.4-branchPrediction.pdf)
  Use for: control-hazard costs (jmp/call 0, ret 3, jXX 2), predictor success rates, squashing, likely/unlikely.
- [Book: _Computer Systems: A Programmer's Perspective_ 3e, Bryant & O'Hallaron](https://csapp.cs.cmu.edu/)
  The course textbook; y86 and PIPE come from Chapter 4. Use for: §4.5.4 next-PC prediction, §4.5.5 hazards (forwarding, load/use, control), §4.5.8 pipeline control logic, §4.5.9 CPI.
- [Paper: Yavarzadeh et al., "Half&Half: Demystifying Intel's Directional Branch Predictors"](https://ieeexplore.ieee.org/document/10179415/)
  Cited in slides 2.4. Use for: curiosity about real-world predictors only; beyond course scope.

## Wisdom (Communities)

- Course discussion board (Piazza/Ed) and TA office hours
  Use for: confirming course-specific conventions (e.g. whether CPI includes pipeline-fill cycles), checking hand-traced answers.

## Gaps

- No confirmed statement yet of the course's exact CPI convention (fill cycles included or not).
