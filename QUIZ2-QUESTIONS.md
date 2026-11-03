# Quiz 2: questions as remembered (for the retake)

Quiz 2 was taken on 2026-10-16. These are the questions as the student remembered them right after the quiz. They are not the official wording, and no answers or scores were given.

## Student's words (verbatim)

> - for a naive pipeline gives 5 instructions and says it runs 6 cycles and asks for what stage each instruction is in can be retired or not yet started asks the same for pipeline without forwarding but with stalls for the same instructions
> - another one asks for where instruction gets forwaded from e.g EMemE or eExectionE
> - another asks for throughput of seq vs pipeline
> - another asks to compare 5 stage converted to 3 stage |FD|EM|W where it says one stage has to wait from other, can forward from start of one stage to start of another or anywhere in one stage to end of another - answer multiple choice comparing 5 and 3 stage and how many stalls for a code for the 3 stage
> - another one asks to count stalls and squashes from code with a loop

## Cleaned-up version

1. **Pipeline snapshot.** 5 instructions; the processor has run 6 cycles. For each instruction, give its stage (F/D/E/M/W), *retired*, or *not yet started*:
   - (a) for a **naive** pipeline (no hazard handling);
   - (b) for a pipeline **without forwarding, with stalls**, using the same instructions.
2. **Forwarding source.** Where does an instruction get its operand forwarded from? The options looked like "EMemE" / "eExecutionE", which probably means `M_valE`, `e_valE`, etc.
3. **Throughput.** SEQ vs. pipelined throughput.
4. **5-stage → 3-stage `|FD|EM|W|`.** The question said one stage has to wait for another. Forwarding rules given: a value can go from the *start of one stage to the start of another*, or from *anywhere in one stage to the end of another*.
   - Multiple choice comparing the 5-stage and 3-stage pipelines.
   - How many stalls a given piece of code has on the 3-stage pipeline.
5. **Loop counting.** Count the stalls and squashes for a piece of code with a loop.

## Practice

- Lesson 10, built from these questions: [lessons/0010-quiz2-replay.html](lessons/0010-quiz2-replay.html)
- Its §4 (3-stage) uses timing rules inferred from the description above. Fix it if the exact wording turns up.
