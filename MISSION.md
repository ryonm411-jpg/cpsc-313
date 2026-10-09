# Mission: y86 Pipelining (CPSC 313, Unit 2)

## Why
Do well on CPSC 313's pipelining coursework — the in-class/pre-class questions (P8–P10, I9–I10), Lab 5, and Quiz 2 — by actually being able to reason about how the y86 pipeline handles hazards, not by pattern-matching answers. *(Inferred from the pasted assignment questions and lecture slides; confirm with the user.)*

## Success looks like
- Given a producer/consumer pair, name the forwarding source (`e_valE`, `M_valE`, `W_valE`, `m_valM`, `W_valM`) or the stall count, instantly.
- Count total stall + squash cycles for a short y86 program under any forwarding / prediction configuration.
- Compute CPI and pick the better branch predictor for a given program.
- Reason about an unfamiliar instruction (e.g. `callR`/`retR`) by asking "when is the next PC / the value first known?"
- Write a y86 program with a conditional jump and predict its pipeline behaviour (exercise 10.2).

## Constraints
- Course-paced: Quiz 2 is imminent ("next week" per slides 2.3/2.4).
- Course conventions (slides) override textbook conventions where they differ.

## Out of scope
- Full PIPE control-logic HDL, exceptions, superscalar/out-of-order execution.
