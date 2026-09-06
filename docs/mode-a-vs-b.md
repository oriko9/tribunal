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

## What a future run of mode B would need to say more

A mode B run that actually reaches the judges — on this tier, on a good day,
or with paid keys backing the seats — would let this document answer the
question it was written to ask: whether seven differently-trained models
reading the same charge sheet reach three opinions that agree with each
other more, less, or about as often as one model does across the same three
judge prompts. Until that run exists, this section stays open rather than
guessed at.
