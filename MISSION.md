# Mission: y86 Pipelining (CPSC 313, Unit 2)

## Why
Do well on CPSC 313's pipelining coursework — the in-class/pre-class questions (P8–P10, I9–I10), Lab 5, and Quiz 2 — by actually being able to reason about how the y86 pipeline handles hazards, not by pattern-matching answers. Confirmed 2026-10-10: the immediate goal is Quiz 2 (50 min, ORCA/PrairieTest, with the y86 reference and SEQ/PIPE diagrams provided).

## Success looks like
- Given a producer/consumer pair, name the forwarding source (`e_valE`, `M_valE`, `W_valE`, `m_valM`, `W_valM`) or the stall count, instantly.
- Count total stall + squash cycles for a short y86 program under any forwarding / prediction configuration.
- Compute CPI and pick the better branch predictor for a given program.
- Reason about an unfamiliar instruction (e.g. `callR`/`retR`) by asking "when is the next PC / the value first known?"
- Write a y86 program with a conditional jump and predict its pipeline behaviour (exercise 10.2).
- Freeze the pipeline at any cycle: which stage each instruction is in, what each pipeline register field (e.g. `E_dstM`) holds; count PIPE- nops.
- Quiz 2 goals: encoding + SEQ notation covered by Lesson 7 (2026-10-14). Still open: "describe a made-up pipeline in y86 notation"; C struct offsets (R2.2).

## Constraints
- Course-paced: Quiz 2 is imminent ("next week" per slides 2.3/2.4).
- Course conventions (slides) override textbook conventions where they differ.

## Out of scope
- Full PIPE control-logic HDL, exceptions, superscalar/out-of-order execution.
