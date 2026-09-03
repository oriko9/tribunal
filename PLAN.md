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
Day 3 done. Mode A runs end to end against the mock provider: seven agents,
four then three, two files written per run. Pushed to github.com/oriko9/tribunal.
No live model has been called yet — that waits on the OpenRouter account.
Work continues in Claude Code, opened on this folder in VS Code.

## The seven-day plan

| Day | Date | Goal | Status |
|-----|------|------|--------|
| 1 | 09-02 | Repo skeleton, CLAUDE.md, charge sheet as a spec, PLAN.md | done |
| 2 | 09-03 | Seven prompt files, versioned | done |
| 3 | 09-04 | Orchestrator in TypeScript; mode A runs locally | done |
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
- [x] First push (run locally on 09-03)

## Day 2 checklist
- [x] prompts/_shared.yaml — rules injected into all seven agents
- [x] Four advocate prompts, versioned 1.0.0
- [x] Three judge prompts, versioned 1.0.0
- [x] docs/PROMPT-CHANGELOG.md
- [x] config/run-single.yaml and config/run-multi.yaml (model ids pending OpenRouter)

## Day 3 checklist
- [x] TypeScript scaffold: package.json, tsconfig, dependencies (yaml, tsx)
- [x] Input layer: every file read and validated at run time, nothing hardcoded
- [x] Message assembly: shared rules + own seat prompt + verbatim charge sheet
- [x] `npm run smoke` — the free verification gate, 23 properties, exits non-zero
- [x] Provider layer: interface, mock, OpenRouter client
- [x] Fault injector, so the failure path can be exercised before Day 4
- [x] .env.local loading, with a committed template
- [x] Orchestrator: 4 advocates concurrent, then 3 judges concurrent
- [x] Run file written to runs/, with per-call usage and totals
- [x] runs/<timestamp>.md — the same run as a readable protocol
- [x] Mode A runs end to end against the mock

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
| D11 | The charge sheet is injected into every agent as its literal YAML source, not as a re-serialisation | What an agent reads is then byte-identical to the committed specification, and no field can be silently dropped in transit |
| D12 | Shared rules are read as an open map of every string field in `_shared.yaml` | A rule added to that file reaches all seven agents with no code change. Requirement #2 says prompts are the unit of change, not code |
| D13 | Independence is structural, not instructed: `buildAdvocateMessages` has no parameter that can carry another advocate, `buildJudgeMessages` none for another judge | An instruction can be disobeyed by a model. A missing function parameter cannot |
| D14 | `npm run smoke` is a committed gate that calls no model and exits non-zero | It can run before every run and every commit at zero cost. It also proves the seam between files: if the charge sheet's permitted verdicts change, the judge prompts must change with them |
| D15 | If any advocate fails, the judges do not sit at all | The protocol has each judge read all four arguments. An opinion written from three of four is a different proceeding, and it would arrive wearing the shape of a real result. The run file records the skipped seats and the reason |
| D16 | Each run writes two files: `<id>.json` and `<id>.md` | The JSON is the machine record. The markdown is the protocol a person opens in GitHub without running anything, and the course grades what can be opened in the repository |
| D17 | The three opinions are stored as three named siblings under `opinions`, not as an array | An array invites reduction. Three named siblings do not have a natural "combine" operation, and the shape itself carries the rule |
| D18 | A declared refusal is a failure, not a result | The shared failure rule tells an agent to declare failure in the refusal field instead of inventing content. Honouring that means treating the declaration as the failure it is |
| D19 | JSON recovered from a fenced or wrapped reply is accepted, but recorded as `parse: "extracted"` | The contract forbids fencing and real models do it anyway. The deviation is visible in the run file rather than silently normalised; Day 4's gate can decide to reject it |
| D20 | Cost is never estimated. A call that reports none contributes nothing and the total is marked a floor | An invented number in a cost report is worse than an absent one |
| D21 | Run ids use hyphens where an ISO timestamp uses colons | Colons are not legal in Windows filenames. The true ISO instant is inside both files |

## Open questions
- [ ] OpenRouter account — the only thing standing between this and a live run.
      Everything else is wired: paste the key into .env.local, set
      TRIBUNAL_PROVIDER=openrouter, replace MODEL_ID_TBD in the configs.
- [x] GitHub repository — created, remote added, pushed.
- [ ] Which free models on OpenRouter are currently available and adequate.

## Out of scope, on purpose
Database, authentication, a form for entering new cases, a "past cases" page,
visual polish, prompt caching, multi-case architecture. None of it is graded.

## Log
- 2026-09-04 — Day 3 finished. The orchestrator runs: four advocates
  concurrently, then three judges concurrently, each judge reading the charge
  sheet and all four arguments and none of them reading another judge. Mode A
  runs end to end against the mock. Each run writes runs/<id>.json and
  runs/<id>.md, the second being the protocol as a person reads it. Two runs
  are committed as evidence: one clean, one in which a judge returns output
  missing a contract field and is reported as a failure while its two siblings
  stand untouched. Provider layer, fault injector and .env.local loading landed
  the same day. The gate is at 55 checks.
- 2026-09-04 — Day 3 started. TypeScript scaffold, then the input layer: the
  charge sheet, the shared rules, the seven prompts and the run configuration
  are all read and validated at run time and a load failure is fatal. Message
  assembly written. `npm run smoke` added as a committed verification gate —
  23 properties, no model call, non-zero exit. Its two failure paths were
  exercised deliberately: a config that names an agent with no prompt file, and
  a charge sheet whose permitted verdicts drift from the judge prompts. Both
  were caught and both files were restored.
- 2026-09-03 — Seven prompts written at 1.0.0 with output contracts, shared
  rules extracted, prompt changelog opened, both run configurations scaffolded.
  Model identifiers left as MODEL_ID_TBD pending the OpenRouter account.
- 2026-09-02 — Repository created. Charge sheet written as a structured
  specification with identified agreed facts. Context file and plan committed.
