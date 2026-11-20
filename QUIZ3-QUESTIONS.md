# Quiz 3: questions as remembered (for the retake)

The student took Quiz 3 around 2026-11-06. There are two sets of notes here:

1. **Quiz review notes (2026-11-18), the more accurate set.** The student opened the quiz viewing and took notes question by question. These use the **real question numbers** (Q3–Q10; Q1, Q2 and the questions after Q10 weren't recorded). The student says the retake will be mostly the same, with **one question harder and changed**.
2. **First recall (2026-11-06)**, written from memory right after the quiz. This is less reliable, and its numbering doesn't match the quiz. Its worked sections are kept below because they still teach the methods.

Practice for everything: [lessons/quiz3/0013-retake-replay.html](lessons/quiz3/0013-retake-replay.html). It has one section per real question number, a harder version of each, and random drills for Q6–Q10. For Q1/Q2 (probably the eviction-policy question), Q10 b/c and Q11 onward: [lessons/quiz3/0014-the-rest-of-the-quiz.html](lessons/quiz3/0014-the-rest-of-the-quiz.html).

---

## Quiz review notes (2026-11-18): real question numbers

### Student's words (verbatim, minus the pasted summaries)

> Q3 -a) asks given a 64 byte cache line iterating over a array much larger what happens to miss rate if stride S doubles(answer should be stay the same b) if step size t triples and is greater than cache line what happens to miss rate(should = 1)
> Q4 - given a list of terms asked which were a part of the memory hierarchy (remember one of the answers were flash drives)
> Q5- which one of these miss handlings is beladys always more optimal than(answer should be none of the above)
> Q6 - [random eviction, max misses] basically the opposite of beladies - replace the next up one and count the misses
> Q7 - given a writeback/allocate and miss rate=..., time to access cache read/write=... , time to access memory = ... , average acess time = ... - find the rate of evictions being dirty evicts)
> Q8 - [Amdahl] a) given meory speedup by 3.6 - and memory logic made non memory speedup by ... , 52% of instructions are memory - what is the speedup? - b) if old time was 132 what is the new time
> Q9 - [2D loop] cache size 2048, 4 cache lines given code int sum = 0 double arr[16][16] - for i=0; i < 4; i++ for j=i j<4 j++ sum[i][j] a) - given arr[0][0] arr[0][1] ect - which are hits(i think that the answers were arr[0][1] and every other one starting from then b) instead of i<4, j<4 becomes <16 and iterates over second loop 122 times - give the number of hits and misses c) second loops j++ changed to +=2 - do miss/hits increase or decrease
> Q10 - only remember a litte of the start given a 32 byte cache line - give the hexadecimal mask for the index bits and give the real index bits in binary - dont remember part b,c

### How to solve each

| Q | Topic | Method | Notes / traps |
|---|---|---|---|
| **Q3** | Stride vs. miss rate (64-byte lines, array ≫ cache) | S < L: miss rate = S/L. S ≥ L: miss rate = 1. | **(a) "Stays the same" is right only if S was already ≥ 64.** If S < 64, doubling S doubles the miss rate (up to 1). Check S's size first. **(b)** t > line, then tripled: still 1. |
| **Q4** | Memory hierarchy members | Slides 3.1 list: registers → L1 → L2 → L3 → (L4, rare) → main memory → **solid-state (flash) drive** → disk drive. | Test: does it *store* data at a level? ALU, decoder and branch predictor are **not** levels. |
| **Q5** | "Belady is always more optimal than…" | Belady is optimal (never more misses), but others can **tie** it. | So "always strictly better" fails for every policy: **none of the above**. A tie example: A B A B with 2 slots. |
| **Q6** | Random eviction, max misses | Opposite of Belady: on each miss, evict the line needed **soonest**. | A repeat must hit if the cache isn't full yet or no miss happened since its last use. If distinct lines ≤ slots, max = min. See the Q1 worked section below. |
| **Q7** | WB/WA: find the dirty fraction p from the average T | T = c + m·d·(1 + p), so **p = (T − c)/(m·d) − 1** | Hit c, clean miss c + d, dirty miss c + 2d. Example: c = 2, d = 50, m = 0.1, T = 9.5 gives p = 0.5. If p < 0 or > 1, recheck. A harder version may solve for m or T instead. |
| **Q8** | Amdahl, two parts | fraction = 0.52/3.6 + 0.48/s₂; speedup = 1/fraction; new = old × fraction | With s₂ = 1.4: 0.48730 gives **2.0521×**, and **132 s → 64.32 s**. If non-memory gets *slower*, s₂ < 1 (e.g. 0.9 gives 89.47 s). "% of instructions" = % of time unless per-instruction times are given. |
| **Q9** | Triangle loop `j = i` over `double arr[16][16]` | Elements per line E; element 16i + j is in line ⌊(16i + j)/E⌋; first touch misses. | The note "arr[0][1] then every other one hits" matches **E = 2**. 4×4 triangle: E = 2 gives 4 hits, 6 misses; E = 4 gives 6 hits, 4 misses. 16×16 triangle (136 accesses): E = 2 gives 72 misses, 64 hits; E = 4 gives 40 misses, 96 hits. **(c) `j += 2`: misses stay the same, hits drop** (the same lines are touched), so the miss rate rises. "122 times" doesn't match any loop I can reconstruct (136 or 58); count it yourself on the retake. |
| **Q10** | Index mask in hex, index in binary (32-byte lines) | b = 5; mask = (sets − 1) << 5; index = (addr & mask) >> 5 in exactly s bits | 8 KB direct-mapped: 256 sets, mask **0x1FE0**; 2-way: **0xFE0**; fully associative: **0**. 0x1F is the *offset* mask. Example: 0x0040B7C4 has index 1011 1110 (DM) or 011 1110 (2-way). |

---

## First recall (2026-11-06)

### Student's words (verbatim)

> Q1 - gave 4 slots and a set of Lines like A, H, G ... and asked for the maximum number of misses if evicted lines were selected at random and somehow gave the most misses possible
>
> Q2 - 3 different set of lines H, E, G in 3 slot and then gave another set of lines ... Q and asked for LRU, MRU, FAFA, LFU, mb others i dont remember but it asked what set was evicted before Q using each of the eviction methods
>
> Q3 Cache size 2048, cache line 4, direct mapped, and calls sum and array[16][16] of 8 byte floats(or something else i dont remember) and gives a loop for i=0 i<4 i++: for k=1 k<4 k++ and asks for if a[0][0], a[0][1], ect will be hit, missed - then changes the second for loop k<16 and another one to k+=2 as the increment and asks the same - also asks what changes for 16 way associative and fully associaitive ect annd what would change if stride was increased and what would happen if stride equals the cache line size? - mb some of these were asked in Q5 i likewise the other way arround I dont remember
>
> Q4 gave 3.6 times faster for memory and 1.4 times faster for non memory then said that 52 percent was in memory and asked for the speedup then gave before time of 300 second and asked for the new time
>
> Q5 gave cache size and cacheline size mb less mb more info - and then asks for the index bits in hexadeciaml and the offset in bits - then changes to 16 way associate and full associative and asks the same and what changes and asks what would change if stride was increased - and other stuff

---

### Recall Q1 (= quiz Q6) · Random eviction: maximum possible misses

**Question:** A fully associative cache with 4 slots gets a sequence of lines (A, H, G, …). Eviction is random. What is the **maximum** number of misses the random choice could produce?

**Idea:** "Maximum" means you assume the unluckiest random pick every time. The unluckiest pick is the opposite of Belady: **evict the line that will be needed soonest.**

**Method:**
1. **Compulsory misses:** every distinct line misses the first time it's used. Count the distinct letters.
2. **No eviction while the cache isn't full.** Until 4 different lines are in, nothing gets evicted, so any repeat before then is a guaranteed **hit**.
3. Once it's full, on every miss evict the line that comes back **soonest**. Then trace it.
4. **Quick check:** a repeated line can only miss if **at least one miss happened since it was last used** (after the cache filled up). If no miss happened in between, it's a guaranteed hit, even with bad luck.

**Worked example (made up):** 4 slots, `A H G B A C A H G B C` (11 accesses).

| Access | Result | Cache after | Why |
|---|---|---|---|
| A H G B | 4 misses | A H G B | cold; cache now full |
| A | **hit** | A H G B | no miss since A was used, so it can't have been evicted |
| C | miss | evict **A** (needed next) | unluckiest pick |
| A | miss | evict **H** (needed next) | |
| H | miss | evict **G** | |
| G | miss | evict **B** | |
| B | miss | evict **C** | |
| C | miss | | |

**Maximum = 10 misses** out of 11 (checked by trying every possible eviction choice). For comparison, Belady (the luckiest pick) gives 6.

**Traps:** Don't answer "every access misses." Repeats before the cache fills, and repeats with no miss in between, **must** hit.

---

### Recall Q2 (probably quiz Q1 or Q2) · Which line does each policy evict?

**Question:** 3 slots hold H, E, G. You're given the access history, then a new line **Q** arrives and misses. Which line is evicted under LRU, MRU, FIFO ("FAFA" is probably FIFO), LFU, and maybe Belady/OPT?

**Method:** write one small table **from the history** first:

| Line | Loaded at (position) | Last used (position) | Times used | Next used (future) |
|---|---|---|---|---|

Then read off the answer:
- **LRU:** smallest *last used* (the longest ago).
- **MRU:** largest *last used* (the most recent).
- **FIFO:** smallest *loaded at*. Reuse does **not** reset it. This is the difference from LRU.
- **LFU:** smallest *times used*. If there's a tie, use the tie rule the question gives (often LRU).
- **Belady / OPT:** the line whose *next use* is **furthest** in the future, or never used again. This needs the accesses **after** Q.

**Worked example (made up):** history `H E G E H E E`, then Q, then the future `G E H`.

| Line | Loaded | Last used | Count | Next use after Q |
|---|---|---|---|---|
| H | 1 | 5 | 2 | 3rd |
| E | 2 | 7 | 4 | 2nd |
| G | 3 | 3 | 1 | 1st |

LRU → **G** · MRU → **E** · FIFO → **H** · LFU → **G** · Belady → **H**

**Traps:** FIFO ignores reuse. Count positions carefully, because one slip changes the answer. For LFU, count every use, including the first load.

Practice: [lessons/quiz3/0003-replacement-policies.html](lessons/quiz3/0003-replacement-policies.html).

---

### Recall Q3 (= quiz Q9 / Q3) · 2D array loop: hit or miss for each element

**Question (reconstructed):** cache 2048 bytes, direct-mapped, a line holds 4 elements, `double a[16][16]` (8 bytes each, so 2048 bytes in total). Assume the array starts at the beginning of a line (line-aligned).

```c
for (i = 0; i < 4; i++)
    for (k = 1; k < 4; k++)
        sum += a[i][k];
```

Which of a[0][0], a[0][1], … hit or miss? Then they change the loop to `k < 16`, then to `k += 2`. They also ask what changes with 16-way or fully associative caches, a bigger stride, or a stride equal to the line size.

**Method:**
1. **Row-major:** `a[i][k]` sits at element `16·i + k`. Its line is `(16·i + k) / 4`, so elements 0–3 of a row share one line, 4–7 the next, and so on.
2. **The first access to a line misses**, and the rest of that line then hits, because the miss loaded the whole line.
3. **Elements that are never accessed are neither hit nor miss.** But they *are* brought into the cache by a neighbour's miss.
4. Check for conflicts. A 2048-byte array exactly fills a 2048-byte cache, so in a direct-mapped cache every line gets its own slot. There are **no conflicts, only cold misses**.

**Answers for the reconstruction:**

| Loop | Per row | Total (4 rows) |
|---|---|---|
| `k = 1; k < 4` | a[i][1] **miss**, a[i][2] hit, a[i][3] hit; **a[i][0] isn't accessed** (but it's loaded) | 4 misses, 8 hits |
| `k = 1; k < 16` | misses at k = 1, 4, 8, 12; the other 11 hit | 16 misses, 44 hits |
| `k = 1; k < 16; k += 2` | k = 1 miss, 3 hit, 5 miss, 7 hit, 9 miss, 11 hit, 13 miss, 15 hit | 16 misses, 16 hits |

**The "what changes" answers:**
- **16-way or fully associative:** **no change.** The array fits, and each line is only loaded once, so every miss is a cold miss. More ways only remove *conflict* misses, and there aren't any here.
  - It *would* matter if the array were bigger than the cache and the loop went over it again. Then use the set table in [lessons/quiz3/0012-round-two.html](lessons/quiz3/0012-round-two.html) §E.
- **Larger stride:** fewer accesses share each line, so the **hit rate drops**. For stride s < line size L, the hit rate is 1 − s/L. The miss count per line stays at 1.
- **Stride = line size (or bigger):** every access lands in a new line, so **every access misses (hit rate 0)** on the first pass.
- If the remembered "cache line 4" really meant **4 bytes** with 8-byte doubles (or 4-byte floats), a line holds ≤ 1 element, so **every first access misses**. Read the units on the retake.

**Traps:** a[0][0] when k starts at 1 isn't accessed at all, so it's neither hit nor miss. Watch whether the loop is `a[i][k]` (along a row, stride = 1 element) or `a[k][i]` (down a column, stride = 16 elements = 128 bytes, so every access misses).

---

### Recall Q4 (= quiz Q8) · Amdahl with two parts that both speed up

**Question:** 52% of the time is in memory, and memory gets 3.6× faster. The other 48% gets 1.4× faster. What's the overall speedup? And if the old time was 300 s, what's the new time?

**Method:** new time fraction = Σ (fraction ÷ its speedup). Speedup = 1 ÷ that sum. New time = old time × that sum.

```
new fraction = 0.52 / 3.6 + 0.48 / 1.4
             = 0.14444 + 0.34286
             = 0.48730

speedup      = 1 / 0.48730  ≈ 2.05
new time     = 300 × 0.48730 ≈ 146.19 s
```

**Check:** the speedup must land between the two parts' speedups (1.4 < 2.05 < 3.6). Also, new time = old time ÷ speedup, so 300 / 2.0521 = 146.19.

**Traps:**
- Don't average the speedups (0.52·3.6 + 0.48·1.4 = 2.54 is **wrong**). You average the *times*, not the speedups.
- Don't forget the 1.4 on the non-memory part. If only memory got faster, the second term would be 0.48/1, and the speedup would be 1/0.6244 ≈ 1.60.
- Keep 4–5 decimals until the last step.

Practice: [lessons/quiz3/0004-amdahl-and-multilevel.html](lessons/quiz3/0004-amdahl-and-multilevel.html).

---

### Recall Q5 (= quiz Q10) · Address bits: offset, index (in hex), tag

**Question (reconstructed):** given a cache size and a line size (and maybe an address), give the offset bits and the index (in hex), then redo it for 16-way and fully associative. What changes? What changes if the stride increases?

**Method:**
1. **Offset bits** = log₂(line size in bytes).
2. **Lines** = cache size ÷ line size. **Sets** = lines ÷ ways. **Index bits** = log₂(sets).
3. **Tag bits** = address bits − index − offset.
4. To pull fields out of an address: write it in **binary**, take the lowest *offset* bits as the offset, the next *index* bits as the index, and the rest as the tag. Convert each field back to hex. **Group from the right**, because fields don't line up with hex digits.

**Worked example (made up):** 32 KB cache, 64-byte lines, 32-bit address `0x12345678`.

| | Direct-mapped | 16-way | Fully associative |
|---|---|---|---|
| Sets | 512 | 32 | 1 |
| Offset bits | 6 | 6 | 6 |
| Index bits | 9 | 5 | **0** |
| Tag bits | 17 | 21 | 26 |
| Offset value | 0x38 | 0x38 | 0x38 |
| Index value | 0x159 | 0x19 | (none) |
| Tag value | 0x2468 | 0x2468A | 0x48D159 |

How the direct-mapped row comes out: `0x12345678` ends in `…0101 0110 0111 1000`. The low 6 bits, `111000`, give 0x38. Shift right by 6 to get 0x48D159, and its low 9 bits give 0x159. Shift right by another 9 bits to get the tag, 0x2468.

**What changes:**
- **More ways** (with the same size and line size): there are fewer sets, so **index bits shrink by log₂(ways factor)** and **tag bits grow by the same amount. The offset doesn't change.** Going direct-mapped → 16-way moves 4 bits from index to tag.
- **Fully associative:** **0 index bits.** Everything except the offset is tag.
- **Bigger line** (same size): offset +1, index −1, tag unchanged.
- **Stride doesn't change any of the bits.** The bit split depends only on the cache's shape. Stride changes the **hit rate** (see Q3).

**Traps:** log₂ the number of **sets**, not lines, unless the cache is direct-mapped. Convert KB carefully (32 KB = 32768 bytes).

Practice: [lessons/quiz3/0001-address-bits-and-access-time.html](lessons/quiz3/0001-address-bits-and-access-time.html).

---

## Before the retake

1. Redo each worked example above from a blank page, without looking.
2. Then do the drills: Lesson 3 (Q2), Lesson 4 (Q4), Lessons 1 and 6 (Q3, Q5), and Lesson 12 (all).
3. If the retake's wording differs from this file, write the exact wording down afterwards and correct this file.
