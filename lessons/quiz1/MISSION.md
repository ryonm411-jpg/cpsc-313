# Mission: Quiz 1 retake (CPSC 313, Unit 1)

> Separate from the top-level MISSION.md, which is about Quiz 2 (pipelining). This folder is ONLY Quiz 1 (the ISA / C↔Y86 / calling conventions / stack / encoding / SEQ material).

## Why
Pass the Quiz 1 **retake** (scheduled for 2026-10-16, 50 min, ORCA/PrairieTest). First attempt scored 64% (gradebook, per top-level NOTES). The references available during the quiz are: y86 Reference, y86 Calling Conventions, y86 sequential implementation diagram.

## What the student struggled with (their own words, 2026-10-15)
1. **Deciding whether assembly matches the C** — is it a `for`/`while`/`do-while`, "neither", or was something *changed* (operator flipped, off-by-one, wrong register, load vs. store)?
2. **Translating both directions** — C → asm, asm → C, and asm from a plain-English description.
3. **A "stack smash" question**: given a base pointer (used `%rbx`) and an array plus assembly, figure out *where* to insert an instruction, *what* to insert, and the *address* the write lands at — involving **hex addition and multiplication** (base + index × 8).

## Success looks like
- Read a Y86 loop and name its shape (do-while vs. while/for) by where the test sits, and say how many times the body runs minimum (0 or ≥1).
- Translate asm → C and C → Y86 fluently, respecting Y86 limits (no mem→mem, no imm→mem, no `cmpq`/`testq`, `subq` is destructive).
- Spot a deliberately-altered instruction by back-translating each line.
- Compute an array element's address as base + index × 8 in hex, and reason about stack-frame layout (return address / saved regs relative to %rsp and %rbp).
- Recall calling conventions cold: arg order, return reg, caller- vs callee-saved.

## Lessons (this folder)
- 0001 — C ⇄ Y86: loops, if/else, and "did it change?"
- 0002 — Stack frames, arrays & the address-arithmetic ("smash") question
- 0003 — Grab bag: calling conventions, directives, shorthand notation, encoding/SEQ pointers

## Out of scope
- Pipelining, forwarding, hazards, CPI — that's Quiz 2 (see ../../MISSION.md and lessons 0001–0008).
