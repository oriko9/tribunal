# Prompt changelog

Prompts are code. No prompt file changes without a version bump and an entry
here saying what changed and what it was meant to fix.

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
