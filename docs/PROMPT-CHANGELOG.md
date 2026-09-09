# Prompt changelog

Prompts are code. No prompt file changes without a version bump and an entry
here saying what changed and what it was meant to fix.

## 1.1.0 — 2026-09-07

**Evidence.** `npm run verify-runs` (see docs/models.md and PLAN.md, Day 4)
checked every committed live run against the two gates added that day.
Judges missed the `opinion` field's 300-500 word range in 6 of 9 live
opinions (67%) — in both directions, on both the free and paid tiers.
Advocates missed their own word range far less often: 2 of 19 live
arguments (~11%). The judge instruction is the one that is not working.

**Diagnosis.** Every judge prompt already stated the range once, in
`output_contract.fields.opinion` ("300 to 500 words") — a schema note the
gate reads, appended to the system message as a formatting requirement
alongside six other fields. For a judge generating long, structured legal
reasoning, a bound stated once in that position is too weak a signal to be
self-monitored during generation. Nothing else about a judge's contract
(verdict, protocol_steps, factors_addressed, facts_relied_on) showed this
pattern at anywhere near this rate, and advocates — whose word range lives
in the identical contract position — did not either. The one difference is
what a judge is asked to do before it writes `opinion`: build a structured,
multi-step legal argument, which naturally wants more room than a single
advocate's argument does.

**Change.** Added one paragraph to each of the three judges' `system_prompt`,
inside the reasoning instructions rather than only in the output contract:
a restated firm bound (300-500 words, not a suggestion), a concrete target
(roughly 400, the midpoint) rather than only a range, and explicit guidance
for both directions of miss — what to cut if a draft runs long, what to add
if it runs short. Each judge's addition also names that judge's own other
long-form field (`protocol_steps` for Barak, `controlling_line` for Elon,
`chronology` for Shamgar) and tells the model the detailed reasoning
belongs there, not repeated at length inside `opinion` itself. Elon's
addition additionally addresses a specific tension already present in that
judge's own prompt — "The route may be long... it is not ornamental" — by
saying explicitly that the route may be long in the judge's own thinking
without the written opinion's word count loosening because of it.

The `output_contract.fields.opinion` description itself is untouched
("300 to 500 words" — the exact string the gate and the mock both parse).
No advocate prompt's wording changed at all: the evidence did not flag
advocates, so nothing about their instructions moved. All seven prompt
files are bumped to 1.1.0 together so the set stays on one version line,
even though four of them carry no content change beyond the version field.

**What one live run at 1.1.0 actually showed.** Run immediately after this
bump, mode A, `openai/gpt-5-nano`, all seven seats (`runs/2026-09-07T12-42-32-415Z`):
Barak 302 words (in range — previously 580 then 233), Elon 248 (out of
range — previously 617 then 523, both over), Shamgar 239 (out of range —
previously 345, 279, 302, mostly in range). 1 of 3 judges landed inside
300-500; 2 of 3 did not. All four advocates stayed in range, as expected
since their wording did not change.

That is a 67% deviation rate — numerically identical to the 6-of-9
baseline this change was meant to move, on a sample of 3. What visibly
changed is the *direction*: both misses this time undershot (248, 239)
rather than the mix of over- and under-shoots seen before, which is
consistent with "aim for roughly 400 and cut if you run long" landing as
"write shorter" more than as "hit the range." It is also exactly the kind
of pattern three data points cannot distinguish from noise.

**This is not a fix, confirmed or otherwise.** One run does not prove
whether 1.1.0 helped, hurt, or did nothing — the honest reading is that it
is inconclusive, on a rate that looks unchanged with a failure mode that
looks different. Whether to run more live samples before drawing a
conclusion, adjust the wording again, or address this in the gate instead
is left open.

**A second live run at 1.1.0, mode B, seven distinct models
(`runs/2026-09-09T09-36-49-975Z`).** The first 1.1.0 run tested the change
on one model repeated seven times; this one tests it on seven independent
judge/advocate model pairings, the condition mode B exists to cover. Result:
Barak (`openai/gpt-5.6-luna`) 368 words, Elon (`anthropic/claude-haiku-4.5`)
367 words, Shamgar (`google/gemini-3.1-flash-lite`) 418 words — all three
inside 300-500, zero deviations. This is the opposite pattern from the mode
A 1.1.0 run five days earlier, where 2 of 3 judges undershot the floor. It
is also the first run in this project's history where all three judges
landed in range.

`judge_elon_model`'s reply arrived wrapped in a markdown fence again
(`parse: "extracted"`), the same as this judge's reply in the 09-07 mode B
run on the same model (`anthropic/claude-haiku-4.5`) — that time 523 words,
over the ceiling; this time 367, in range. The fence recurred independent of
whether the word count itself was in or out of range, which points to it
being a trait of this model on this prompt rather than something 1.1.0's
wording change touches one way or the other.

Combined, 1.1.0 now has two live samples: mode A (1 of 3 judges in range,
both misses under) and mode B (3 of 3 in range). Across all six judge
opinions produced at 1.1.0, 2 missed and 4 hit — compared to the pre-1.1.0
baseline of 6 of 9 (67%) missing. Six data points, spread across two runs
with different failure directions in each, still cannot separate a real
improvement from noise, and this is recorded as a second data point, not
a conclusion. Whether 1.1.0 helped remains open.

## 1.0.0 — 2026-09-03
First version of all seven prompts and the shared rules.

- `prompts/_shared.yaml` — three rules injected into every agent: the evidence
  rule (only F1..F5 are established, cite identifiers), the simulation rule (the
  seat fixes the procedural role, never the conclusion), and the failure rule
  (declare failure rather than inventing content).
- `prompts/advocates/*` — four advocates. Each returns a stance, an argument,
  the fact identifiers relied on, and a concessions list. The concessions field
  exists to stop the model producing a one-sided brief that ignores the record.
- `prompts/judges/*` — three judges. Each returns a verdict, an opinion, an
  answer to each of the four factors Q1..Q4, the fact identifiers relied on, the
  strongest point against its own conclusion, and `protocol_steps`.
- `protocol_steps` is the field that makes the required protocol real: it is the
  ordered record of how the judge reached the verdict, not only what it decided.
- Each judge carries a disclaimer stating that the profile adapts a judicial
  method and does not impersonate the judge or predict a real ruling.
