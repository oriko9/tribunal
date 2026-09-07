# Mode A vs mode B: one run each

Comparing `runs/2026-09-05T17-35-07-358Z` (mode A, one model behind all seven
seats) against `runs/2026-09-06T07-24-33-092Z` and
`runs/2026-09-06T07-27-39-545Z` (mode B, seven distinct models — two attempts,
per `docs/models.md`). Same charge sheet, same seven prompts, same code
in all three; only the model or models behind the seats differ.

**What this document does not support.** One run of mode A and two attempts
at mode B is an anecdote, not a result. Nothing below should be read as "mode
A is more reliable than mode B" as a general claim about single-model versus
multi-model orchestration. It is a general claim about what happened on one
afternoon, on the free tier, with the specific models chosen that day. A
different day, a different set of seven, or a paid tier could easily look
different. The one claim this comparison does support is narrower and does
not need a second run to back it: **assigning seven independent models to one
run multiplies the chances that at least one of them is unavailable at that
moment**, because unavailability in a shared free pool is a property of each
model roughly independently, and probabilities compound. Both mode B attempts
demonstrate that; no amount of re-running mode A would have.

## The verdicts

Mode A completed and produced three opinions. Mode B did not complete in
either attempt, and produced none. This is stated as a fact about what
happened, not evened out by comparison:

| Judge | Mode A verdict (nemotron-3-super-120b-a12b, all seats) | Mode B, attempt 1 | Mode B, attempt 2 |
|---|---|---|---|
| The Barak model | `justified` | did not sit | did not sit |
| The Elon model | `not_justified` | did not sit | did not sit |
| The Shamgar model | `not_justified` | did not sit | did not sit |

Three opinions were returned in mode A, side by side, and are not combined,
ranked or averaged here or anywhere else in this project. Whether mode A's
three opinions were "more or less alike" than mode B's cannot be answered:
mode B never produced any opinions to compare them against. The honest
statement is that this comparison is empty on the one question it was
supposed to answer, and that emptiness is itself the finding — see
"What actually happened" below.

## What actually happened

In both mode B attempts, the judges never sat. The protocol requires all
four advocate arguments before any judge is called, and in both attempts
too few advocates returned usable output for that condition to be met.
No judge-assigned model — six of them across the two attempts, all
distinct — was ever invoked.

| | Mode A | Mode B, attempt 1 | Mode B, attempt 2 |
|---|---|---|---|
| Models behind the seats | 1 (`nvidia/nemotron-3-super-120b-a12b:free`) | 7 distinct | 7 distinct, none repeated from attempt 1 |
| Run status | `complete` | `incomplete` | `incomplete` |
| Advocates ok / 4 | 4 | 1 | 2 |
| Judges ok / 3 | 3 | 0 (not run) | 0 (not run) |
| Seats ok / 7 | 7 | 1 | 2 |
| Seats failed or not run / 7 | 0 | 6 | 5 |
| Prompt tokens | 19,154 | 1,883 | 3,619 |
| Completion tokens | 19,504 | 560 | 6,233 |
| Total tokens | 38,658 | 2,443 | 9,852 |
| Cost (USD, provider-reported) | $0.00 | $0.00 | $0.00 |
| Wall-clock duration | 121.5 s | 120.0 s | 28.3 s |

Every model used across all three runs is a free-tier model, so the $0.00
figures are real provider-reported costs, not a mock placeholder — this
project has not yet spent money on a live call. Token and cost totals are
not a fair efficiency comparison between the modes: mode A's totals reflect
seven completed calls including three ~300-620 word judge opinions, while
mode B's totals reflect at most two completed advocate calls and several
calls that failed before producing any completion tokens at all. Comparing
them would be comparing the cost of finishing a job to the cost of a job
that stopped partway through.

Wall-clock duration is similarly not comparable on its own. Mode A's 121.5 s
covers two full concurrent phases actually running to completion, one call
in it (`jon_snow`) taking 64.9 s alone. Mode B attempt 1's 120.0 s is almost
entirely one call (`daenerys_targaryen`, nemotron-3.5-lightning) hanging
until the timeout aborted it — the other three advocate calls each returned
in under a second, mostly rejections. Attempt 2's 28.3 s is close to the
slowest of the two calls that actually completed (`tyrion_lannister`,
28.3 s), because everything else failed almost immediately.

## Distinct failure kinds, in one afternoon

Four different real-world failure modes have now been recorded across the
four live model choices this project has tried (`google/gemma-4-31b-it` and
`nvidia/nemotron-3-super-120b-a12b` in mode A on 09-03/09-05; the seven
models of mode B's two attempts on 09-06). None of them is our own
OpenRouter account limit — every failed call here was rejected or timed out
before doing any of our 20/min or 50/day budget's worth of damage:

1. **Upstream shared-pool rate limiting** (`limit_source:
   upstream_provider_shared_pool`) — `google/gemma-4-31b-it` (mode A,
   09-03), most of `z-ai/glm-5.2` (mode A, 09-05), and
   `google/gemma-4-26b-a4b-it` / `poolside/laguna-s-2.1` (mode B, attempt 1).
   The free tier of that specific model was saturated across all OpenRouter
   users at the moment of the call.
2. **A silent timeout** — `nvidia/nemotron-3.5-lightning` (mode B, attempt
   1) never returned anything at all; the call ran the full 120 s and was
   aborted by our own client-side timeout, not a provider error.
3. **An access-tier 403** — both ThinkingMachines models (mode B, attempt 2)
   are listed as free but rejected plain chat requests outright:
   `"only available on agentic harnesses"`. This is not congestion; it is a
   free listing this pipeline is not eligible to call the way it calls
   models.
4. **Success** — `nvidia/nemotron-3-super-120b-a12b` (mode A, 09-05),
   `minimax/minimax-m3` (mode B, attempt 1), and `liquid/lfm-2.5-2.6b` /
   `nvidia/nemotron-3-ultra-550b-a55b` (mode B, attempt 2) all returned real,
   parseable, in-character replies.

No single model is condemned by one bad call and none is vindicated by one
good one — this is exactly the "anecdote, not a result" caveat above, applied
to the individual models rather than to the modes. What the four kinds
together support is narrower and firmer: a free-tier model can fail for
reasons that have nothing to do with this project's code, its prompts, or
its account limits, and the number of ways to fail only grows as more
distinct models are put behind one run.

## Mode A vs mode B, paid: one run each (2026-09-06 / 2026-09-07)

The comparison above stayed open because mode B never reached the judges on
the free tier. It has now run once, live, against paid models — this section
completes that comparison rather than replacing it; the free-tier findings
above still stand as their own record.

Comparing `runs/2026-09-06T07-51-57-229Z` (mode A, `openai/gpt-5-nano` behind
all seven seats) against `runs/2026-09-07T09-59-57-177Z` (mode B, seven
distinct paid models, one per seat). Same charge sheet, same seven prompts,
same code in both; only the model or models behind the seats differ.

**Still an anecdote.** One paid run of mode A and one paid run of mode B is
exactly as much of a result as the free-tier comparison above was: none. A
second live comparison does not turn an anecdote into a finding, even though
this one, unlike the free-tier attempts, finally has three opinions on both
sides to compare. Nothing below should be read as "mode B is as reliable as
mode A now that both are paid," or as a general claim about how paid models
compare to free ones. It is what happened on one morning, with these seven
specific models, at these specific prices.

### The verdicts

| Judge | Mode A verdict (`openai/gpt-5-nano`, all seats) | Mode B verdict (model behind that seat) |
|---|---|---|
| The Barak model | `not_justified` | `not_justified` (`openai/gpt-5.6-luna`) |
| The Elon model | `not_justified` | `not_justified` (`anthropic/claude-haiku-4.5`) |
| The Shamgar model | `not_justified` | `not_justified` (`google/gemini-3.1-flash-lite`) |

All six opinions across both runs reached the same verdict. This is reported,
not interpreted: the three opinions in each mode are not merged, ranked or
averaged here or anywhere else, and "all six agree" is not read as evidence
that these seven models converge on this case, or that mode A and mode B
produce interchangeable results — one run of each cannot support either
claim. Nor can this comparison separate two different explanations for the
agreement: the seven models genuinely reasoning to the same place, versus the
four advocate arguments not differing enough between the two runs to move a
judge either way. Nothing recorded here distinguishes those.

### Whether the three opinions were more or less alike

"Alike" points in different directions here depending on what is measured.
On verdict, mode B was maximally alike mode A: all three judges landed on
`not_justified` in both. On opinion length, mode B's three opinions were
*less* alike each other than mode A's three were: mode A clustered tightly
(233, 274, 279 words — a 46-word spread), while mode B's spread over 221
words (302 to 523) against the same 300-500 word contract — one opinion
barely inside the floor, another over the ceiling. One run cannot say
whether that wider spread is a property of three different model families
answering three differently-written judge prompts, or noise.

### Opinion word counts

| Judge | Mode A words | Mode B words | Contract range |
|---|---|---|---|
| The Barak model | 233 | 383 | 300–500 |
| The Elon model | 274 | 523 | 300–500 |
| The Shamgar model | 279 | 302 | 300–500 |

Mode A missed the floor on all three judges (recorded 09-06). In mode B,
`judge_shamgar_model` (gemini-3.1-flash-lite) just cleared the floor at 302;
`judge_barak_model` (gpt-5.6-luna) landed mid-range at 383; `judge_elon_model`
(claude-haiku-4.5) overshot the ceiling at 523, and that reply also arrived
wrapped in a markdown fence the contract forbids, recovered via
`parse: "extracted"` rather than failing outright. Across the two live models
tried behind mode A and the three now tried as mode B's judges, the 300-500
word contract has now been missed low, missed low again, hit, and missed
high — four judge calls, four different outcomes, across two runs. Per
instruction, this is recorded as a third data point and nothing is changed
in response yet; whether the fix belongs in a gate, the prompts, or both is
still open.

Word-count drift was not limited to judges this time. `grey_worm`'s contract
asks for 180-300 words; mode B's `grey_worm` (`openai/gpt-oss-20b`) returned
152 — under the floor, the first advocate-level word-count miss recorded in
this project. Mode A's `grey_worm` (gpt-5-nano) was within range at 212 words
(also recorded 09-06).

### Token counts

| | Mode A | Mode B |
|---|---|---|
| Prompt tokens | 18,969 | 19,045 |
| Completion tokens | 30,546 | 15,817 |
| Total tokens | 49,515 | 34,862 |

Prompt tokens are nearly identical, as expected: both runs send the same
charge sheet and the same shared rules built from the same four prompt
files. Completion tokens differ by nearly half. The gap is concentrated,
not spread evenly: mode A's `daenerys_targaryen` (gpt-5-nano) alone produced
5,810 completion tokens, where mode B's same seat (`openai/gpt-oss-120b`)
produced 681. This is a property of these particular models' verbosity on
this particular prompt, not a property of "mode A" or "mode B" as a design.

### Real cost

| | Mode A | Mode B |
|---|---|---|
| Total cost (provider-reported) | $0.013167 | $0.025956 |
| Budget | $0.50 | $0.50 |
| Exceeded | No | No |

Mode B cost roughly twice mode A's. Over half of that cost is one call:
`judge_elon_model` on `anthropic/claude-haiku-4.5` alone cost $0.014118 —
more than the entirety of mode A's seven-call run. The other six mode B
calls together cost $0.011838, less than mode A's total by itself. Pairing
the seats that read the most — the three judges, each given the charge
sheet and all four advocate arguments — with the more capable models was
the stated intent behind this selection, and the cost breakdown shows
exactly where that intent spent the money.

### Wall-clock time

| | Mode A | Mode B |
|---|---|---|
| Run duration | 56.2 s | 96.3 s |
| Slowest call | 29.8 s (`daenerys_targaryen`) | 74.7 s (`grey_worm`, `openai/gpt-oss-20b`) |
| Fastest call | 22.1 s (`tyrion_lannister`) | 4.1 s (`tyrion_lannister`, `openai/gpt-5.4-mini`) |

Mode A's seven calls, all on one model, landed in a tight 22-30 s band. Mode
B's seven calls, on seven different models, spread from 4 s to 75 s — nearly
a 20x range inside a single run. A single-model run finishing in a tighter,
more predictable window than a seven-model run is intuitive, and this run
is consistent with that; one run is not proof of it.

### Failures

Mode A: none, in its one live run. Mode B: none, in *this* run — but this
was mode B's third live attempt overall to reach the judges, and its second
attempt this same day. The first attempt this morning failed before any
judge sat: the OpenRouter key's own spending cap rejected
`tyrion_lannister`'s call (`openai/gpt-5.4-mini`) with HTTP 402, a third
failure kind distinct from anything the free tier produced (see
`docs/models.md`). That failure was about the account, not about any model
or about mode B's design, and it cleared once the key's limit was raised.
It is recorded here because "mode B succeeded" is only true of the second
try today, not the first — the honest total is one success in three live
attempts across two days, and the judges have now sat exactly once.
