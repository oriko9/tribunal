# PLAN — The Tribunal

Living document. Updated as work happens, not at the end.
Guiding principle: **it has to work, not be perfect.**

Deadline: 2026-09-09 (one week from 2026-09-02).

## How this document is kept

This file is the single source of truth for where the project stands. Any agent
or session that does work here updates it in the same turn as the work: mark the
day, add what was built, record any decision taken and why. Do not defer it to
the end of the day and do not reconstruct it afterwards. The course grades the
trail, and a trail written later is worth less than one written as it happened.

The chat session that planned this project keeps a mirror of this file. The
mirror is read from here; it never writes back. If the two disagree, this file
wins.

## Current status
Day 2 done. Seven prompts written and versioned at 1.0.0.
Nothing pushed to GitHub yet: the remote is set, the push must be run locally.
Work continues in Claude Code, opened on this folder in VS Code.

## The seven-day plan

| Day | Date | Goal | Status |
|-----|------|------|--------|
| 1 | 09-02 | Repo skeleton, CLAUDE.md, charge sheet as a spec, PLAN.md | done |
| 2 | 09-03 | Seven prompt files, versioned | done |
| 3 | 09-04 | Orchestrator in TypeScript; mode A runs locally | not started |
| 4 | 09-05 | Two verification gates; failures surface as failures | not started |
| 5 | 09-06 | One-button screen, deployed to Vercel | not started |
| 6 | 09-07 | Mode B (a model per agent), cost report, A/B comparison run committed | not started |
| 7 | 09-08 | README, LESSONS.md, merge-ready | not started |

## Day 1 checklist
- [x] Repository initialised
- [x] .gitignore
- [x] CLAUDE.md — context file the agent reads
- [x] specs/charge-sheet.yaml — requirement #1
- [x] README.md
- [x] PLAN.md
- [x] Remote added (github.com/oriko9/tribunal)
- [ ] First push (must be run locally; no network from the assistant's shell)

## Day 2 checklist
- [x] prompts/_shared.yaml — rules injected into all seven agents
- [x] Four advocate prompts, versioned 1.0.0
- [x] Three judge prompts, versioned 1.0.0
- [x] docs/PROMPT-CHANGELOG.md
- [x] config/run-single.yaml and config/run-multi.yaml (model ids pending OpenRouter)

## Decisions taken

| # | Decision | Why |
|---|----------|-----|
| D1 | TypeScript on Vercel, one language end to end | The whole app runs on Vercel; a second language buys nothing |
| D2 | No database. Each run is a JSON file committed to `runs/` | The course grades what it can open in the repo. A committed run file is evidence; a database row is not |
| D3 | Prompts live in external YAML with a `version` field | Requirement #2. Swapping mode A for mode B must not touch code |
| D4 | Agreed facts carry IDs (F1..F5) | Lets the verification gate check that an opinion is grounded in facts that actually exist |
| D5 | Advocates run in parallel and do not see each other; judges likewise | No dialogue is required. Independence is what makes three distinct opinions possible |
| D6 | Repo documents in English | The dossier and all course material are in English |
| D7 | Every agent returns JSON against an output contract in its own prompt file | The contract is what the verification gate on Day 4 checks against |
| D8 | Judges return `protocol_steps`, an ordered record of how they decided | The required output is a protocol, not only three verdicts |
| D9 | Advocates return a `concessions` list; judges return `strongest_opposing_point` | Forces engagement with the other side instead of a one-sided brief, and gives the gate something to check |
| D10 | Shared rules live in prompts/_shared.yaml, not copied into seven files | One change, one version bump, seven agents |

## Open questions
- [ ] OpenRouter account — needed by Day 3. Mocked until then.
- [ ] GitHub repository — needs to be created and the remote added.
- [ ] Which free models on OpenRouter are currently available and adequate.

## Out of scope, on purpose
Database, authentication, a form for entering new cases, a "past cases" page,
visual polish, prompt caching, multi-case architecture. None of it is graded.

## Log
- 2026-09-03 — Seven prompts written at 1.0.0 with output contracts, shared
  rules extracted, prompt changelog opened, both run configurations scaffolded.
  Model identifiers left as MODEL_ID_TBD pending the OpenRouter account.
- 2026-09-02 — Repository created. Charge sheet written as a structured
  specification with identified agreed facts. Context file and plan committed.
