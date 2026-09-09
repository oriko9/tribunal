# Lessons

This is evidence, not reflection. Every claim below points at a run file, a
number already recorded in `PLAN.md` or `docs/`, or a specific commit. Where a
claim is a rate (a fraction of runs or opinions), the denominator is stated
next to it.

## 1. Four real failure kinds, and no mock predicted any of them

The mock provider (`src/provider-mock.ts`) exists to make `npm run smoke`
free and deterministic — 77 checks, no model call, `git log` shows it running
green since Day 3. It can inject faults on demand (`invalid_json`,
`missing_field`, `illegal_verdict`, `empty`, `fenced_json`,
`declared_refusal`, `transport_error`, `fabricated_fact`), and every one of
those is a fault this project chose to simulate. None of the four failures
below was chosen — they were discovered, each the first time this project
called a real model that day:

1. **Upstream shared-pool rate limiting.** `limit_source:
   "upstream_provider_shared_pool"`, HTTP 429, in under a second. First seen
   09-03 on `google/gemma-4-31b-it:free` (all 7 calls) —
   `runs/2026-09-03T15-52-06-756Z.json`. Recurred 09-05 on `z-ai/glm-5.2:free`
   (3 of 4 advocates) and again in mode B attempt 1 on 09-06 (2 of 7 seats).
   Not this project's own 20/min or 50/day account limit — the free tier of
   that specific model was saturated across every OpenRouter user at the
   moment of the call. `docs/models.md`, "Live attempts against mode A".
2. **A silent timeout.** `nvidia/nemotron-3.5-lightning:free`, mode B attempt
   1, 09-06 — the call ran the full 120s client-side timeout and returned
   nothing, no error, no partial text. `runs/2026-09-06T07-24-33-092Z.json`.
   A mock fault can return `empty` or `transport_error` instantly; nothing in
   the fault injector holds a connection open for two minutes before failing,
   because there was no reason to model that until it happened.
3. **An access-tier 403.** Both ThinkingMachines models in mode B attempt 2,
   09-06 — `"only available on agentic harnesses"`, despite being listed with
   $0 pricing in the same free-model table `npm run models` had generated the
   same morning (`docs/models.md`, "Free models on OpenRouter"). A free
   listing is not the same claim as free-to-call-this-way.
   `runs/2026-09-06T07-27-39-545Z.json`.
4. **A payment cap on this project's own account.** `tyrion_lannister`
   (`openai/gpt-5.4-mini`), mode B, 09-07, first attempt — HTTP 402,
   `limit_source: "openrouter_key_limit"`, rejected in 621ms with three
   concurrent calls already drawing down the balance ahead of it.
   `runs/2026-09-07T09-46-50-573Z.json`. This is the one failure kind that is
   about the account rather than a model, and it is the one place this
   project stopped and asked instead of retrying (`PLAN.md`, D31) — a retry
   was likely to repeat the failure or spend more into it, and raising a
   spending cap is not a call to make unilaterally.

Four kinds, four separate days, none of them reachable by writing a better
mock fault — each was a property of a real provider or a real account at a
real moment, not of this project's code.

## 2. Mode B reached the judges twice in four live attempts

Mode B is the graded requirement that a different model sits behind each of
the seven seats. Its full live record, in order:

| Attempt | Date | Outcome | Evidence |
|---|---|---|---|
| 1 (free) | 2026-09-06 | 3 of 4 advocates failed (2 rate-limited, 1 silent timeout); judges did not sit | `runs/2026-09-06T07-24-33-092Z.json` |
| 2 (free) | 2026-09-06 | 2 of 4 advocates failed (both 403); judges did not sit | `runs/2026-09-06T07-27-39-545Z.json` |
| 3 (paid), try 1 | 2026-09-07 | 1 of 4 advocates failed (402, payment cap); judges did not sit | `runs/2026-09-07T09-46-50-573Z.json` |
| 3 (paid), try 2 | 2026-09-07 | all 7 seats succeeded; judges sat for the first time | `runs/2026-09-07T09-59-57-177Z.json` |
| 4 (paid, 1.1.0 prompts) | 2026-09-09 | all 7 seats succeeded; every judge landed inside 300-500 | `runs/2026-09-09T09-36-49-975Z.json` |

Read as four live attempts, not five: the payment-cap failure and its
retry the same day (attempt 3) are one attempt, per `PLAN.md` D31. Two of
the four reached the judges — both after the free tier was abandoned for
paid models, and both on the second or later try of that day. The protocol's
own rule — all four advocate arguments or the judges do not sit (`PLAN.md`,
D15) — is what kept every incomplete attempt from being recorded as a
partial result. Nothing was substituted for the missing seats in any of the
failed attempts; each run file shows the affected seats as `not_run` or
`failure`.

The free tier alone could not sustain a seven-independent-model run across
two attempts (`docs/models.md`, "Why this project moved off the free tier"),
which is why both configs moved to paid models on 09-06 (`PLAN.md`, D29)
before mode B's third attempt.

## 3. The word-count contract, missed in both directions

`npm run verify-runs` re-applied Gate 1 to all 10 committed runs (8 of them
live) without rewriting any of them. Result, recorded in `PLAN.md`'s Day 4
log entry: 8 deviations, all word-count, zero fabricated facts, zero illegal
verdicts. Restricted to the 8 live runs: **6 of 9 live judge opinions (67%)**
missed their 300-500 word range, against **2 of 19 live advocate arguments
(~11%)** missing their own ranges — in both directions, on both the free and
paid tiers (`PLAN.md`, log entry "2026-09-07 (gates)").

The miss pattern across every live judge opinion recorded, in order:
580, 617 (09-05, over); 345 (09-05, in range); 233, 274, 279 (09-06, all
under); 383, 302 (09-07, in range), 523 (09-07, over and fenced). Four
distinct outcomes across the first four judge calls alone —
missed low, missed low again, hit, missed high (`docs/mode-a-vs-b.md`,
"Opinion word counts").

**The 1.1.0 change did not measurably fix it.** Diagnosis and full reasoning
are in `docs/PROMPT-CHANGELOG.md`: the range lived only once, in the output
contract's schema note, too weak a signal for a judge generating long
structured reasoning. The fix added a paragraph to each judge's
`system_prompt` restating the bound with a concrete target (~400 words) and
per-direction guidance. The one live run made against it,
`runs/2026-09-07T12-42-32-415Z.json`: Barak 302 (in range), Elon 248, Shamgar
239 (both under). 1 of 3 in range — a 67% miss rate numerically identical to
the pre-change baseline, on a sample of one run. What changed was the
*direction* of the misses (both under, where the baseline mixed over and
under) — consistent with either a real shift toward brevity or plain noise
on three data points, and the changelog says exactly that rather than
claiming the change worked.

A second live run followed on 2026-09-09, mode B this time, seven distinct
paid models — the condition the first 1.1.0 run couldn't test, since it used
one model for all seven seats (`runs/2026-09-09T09-36-49-975Z.json`). All
three judges landed inside 300-500 (368, 367, 418) — the opposite pattern
from mode A's run, and the first run in this project where every judge hit
the range. Combined, 1.1.0 now has two live samples pulling in opposite
directions: 4 of 6 judge opinions in range across both, against a 6-of-9
(67%) pre-1.1.0 miss rate. Two runs with opposite failure directions cannot
separate a real effect from noise any better than one run could — this is
recorded as a second data point, not a conclusion, in
docs/PROMPT-CHANGELOG.md's 1.1.0 entry.

## 4. Failure vs. deviation, and why collapsing them would have been worse than no gate

Gate 1 (contract conformance) and Gate 2 (fact grounding) do not report the
same way. A word range, a `protocol_steps` count, or `factors_addressed`
completeness that misses is recorded as a **deviation** — visible, but not a
failure. A verdict or stance outside the field's own contract enum, or a
fact id cited that does not exist in `agreed_facts`, is a **failure**
(`PLAN.md`, D25 and the Day 4 checklist in `src/gates.ts`).

The distinction is load-bearing, not cosmetic. If word-count misses were
failures, the one fully successful live run this project has (mode B,
09-07, `runs/2026-09-07T09-59-57-177Z.json`) would report as failed even
though every seat returned usable, in-character, fact-grounded output — the
run status is exactly the thing a reader opening `runs/<id>.md` uses to tell
"the tribunal produced three opinions" from "it didn't," and a gate that
calls a 23-word overrun the same kind of event as a fabricated fact would
make that status meaningless. Conversely, if fact grounding were only a
deviation, the one thing this project committed to never letting an agent do
— assert something outside `agreed_facts` as established (`CLAUDE.md`,
"Nothing outside `specs/charge-sheet.yaml` `agreed_facts` may be treated as
established fact by any agent") — would have no enforcement at all, only a
note next to a "successful" run.

Proof the boundary holds rather than just being asserted: `npm run smoke`
tests both directions of Gate 2 directly, not only its negative case — a
real agreed fact cited any number of times, including embedded in a longer
number, is never flagged (`npm run smoke` output, "Gate 2 — fact grounding").
And `npm run verify-runs`'s real finding — 8 word-count deviations, zero
fabricated facts, zero illegal verdicts, across every run this project has
ever committed — is itself evidence the two categories haven't blurred in
practice: the failure category has stayed empty on live data while the
deviation category has caught something real on 8 of 10 runs.

## 5. What a mock can and cannot prove

The mock provider and the 77-check smoke gate prove structure: every prompt
file loads and is versioned, every contract has a field to declare failure
in, no advocate or judge message leaks another seat's prompt, the budget
guard actually trips at the right threshold, a fault injected on purpose is
caught. All of that has been true since Day 3 and stayed true through Day 7,
checked before every commit.

What it never once produced, in ten committed runs, is any of the four
failure kinds in section 1, or the word-count drift in section 3. Those are
properties of a real provider under real load, a real account under a real
spending cap, and a real model choosing how long to write — none of which a
synthetic reply generator has an opinion about, because it was never asked
to. `PLAN.md`'s D22 called this out before it was proven: Day 5 (going live)
was moved ahead of Day 6 (building the screen) specifically because nothing
had met a real model yet, and building on top of a pipeline that had never
seen one risked discovering the real failure modes after a UI was already
built around the wrong assumptions. Everything in sections 1 through 3 is
that risk having been real: the mock was necessary to build the pipeline
cheaply and reproducibly, and it was never sufficient to know whether the
pipeline actually works.
