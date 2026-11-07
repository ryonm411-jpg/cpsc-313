# Quiz 3: questions as remembered (for the retake)

The student took Quiz 3 around 2026-11-06 and wrote these questions down from memory right afterwards. The wording and numbers are **not** official, and some details may be wrong or swapped between Q3 and Q5. The student expects most of the retake to use the same question types, and **all five are ones they struggled with**.

## Student's words (verbatim)

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

## Q1 · Random eviction: maximum possible misses

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

## Q2 · Which line does each policy evict?

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

## Q3 · 2D array loop: hit or miss for each element

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

## Q4 · Amdahl with two parts that both speed up

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

## Q5 · Address bits: offset, index (in hex), tag

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
