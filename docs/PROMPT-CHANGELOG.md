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

**What this is not.** One live run at 1.1.0 does not prove the wording
change worked — a single run's word counts could move for reasons that
have nothing to do with the prompt, and three judges succeeding once each
is a small sample after already seeing a 33% baseline success rate. See
the follow-up entry below for what that run actually showed, reported
without treating it as proof either way.

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
