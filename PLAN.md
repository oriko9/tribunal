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
Day 3 and Day 5 (go live) done, the latter out of order and spilling from
09-05 through 09-07 to cover both modes on both tiers. Mode A and mode B have
each run live, complete, against paid models, and docs/mode-a-vs-b.md
compares them in full; mode B's honest record along the way is one success
in three live attempts. Day 6 (the web app) is now in progress: the screen
is built and verified locally in a real browser against real committed run
files, reading from runs/ rather than triggering a live call — a live run's
56-96s exceeds Vercel's free-function 60s timeout, so a click-to-run screen
would fail intermittently and spend money every time. Deploying is the one
step left, blocked on the user authenticating the Vercel CLI. Day 4
(verification gates) is still open, with real evidence to build against: the
word-count contract has now been missed low, high, and every combination in
between, across both modes and both tiers.
Work continues in Claude Code, opened on this folder in VS Code.

## The seven-day plan

| Day | Date | Goal | Status |
|-----|------|------|--------|
| 1 | 09-02 | Repo skeleton, CLAUDE.md, charge sheet as a spec, PLAN.md | done |
| 2 | 09-03 | Seven prompt files, versioned | done |
| 3 | 09-04 | Orchestrator in TypeScript; mode A runs locally | done |
| 4 | 09-06 | Two verification gates; failures surface as failures | not started |
| 5 | 09-05 | Go live: model discovery, one live run of mode A, evidence recorded | done |
| 6 | 09-07 | One-button screen, deployed to Vercel | in progress |
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

## Day 5 checklist (moved ahead of Day 4 — see below)
- [x] `npm run models` — queries OpenRouter, filters to free + >=32k context,
      writes docs/free-models.md as evidence rather than a terminal choice
- [x] Three live models tried against mode A, in order, all recorded
- [x] At least one fully successful live run committed, both files
- [x] Real model deviations from the mock captured in the run files and in
      docs/free-models.md, not fixed yet — that is Day 4's job
- [x] `npm run models` fixed to preserve its own manually-maintained history
      across regeneration, after a re-run silently wiped it on 09-06
- [x] config/run-multi.yaml filled with seven distinct free model ids — the
      graded requirement that a model is swappable per seat, live for the
      first time
- [x] Two live attempts at mode B on the free tier, both recorded regardless
      of outcome; both were incomplete, per instruction to try once more and
      then stop
- [x] Both configs switched to paid models (09-06) after the free tier
      proved unable to sustain mode B
- [x] Budget guard proven against the mock before any real money was spent:
      same run, same cost, two configs differing only in max_usd_per_run,
      one exits 1 over budget, the other 0 — two permanent checks added
- [x] Mode A run live against a paid model, complete, real cost recorded
- [x] Mode B run live against seven paid models — first attempt hit the
      OpenRouter key's own spending cap; stopped and asked rather than
      retrying; second attempt, after the user raised the limit, succeeded
      completely — first time mode B has ever reached the judges
- [x] docs/mode-a-vs-b.md — completed in full: the free-tier section stands
      as its own record (mode B produced zero opinions there), and a second
      section compares the paid mode A and mode B runs on verdicts, opinion
      alikeness, word counts, tokens, cost and wall-clock time, under the
      same "anecdote, not a result" framing

## Day 6 checklist
- [x] CLAUDE.md corrected: no longer claims a serverless function runs the
      deliberation
- [x] Vercel zero-config scaffold: public/, api/runs.ts, vercel.json
      (includeFiles for runs/, since the function's directory doesn't carry
      it by default)
- [x] api/runs.ts — list + single-run read, id validated before touching the
      filesystem, no provider code imported, no API key read
- [x] Frontend: selector (defaulted to the 09-07 mode B complete run) +
      button, four advocates, three opinions as fixed-order siblings with
      verdict/protocol_steps/Q1-Q4, the not-combined notice, cost table, a
      failed seat rendering its own card rather than being dropped
- [x] Verified in an actual headless browser against the real handler and
      real committed run files — not just by reading the code
- [ ] Deployed to Vercel — blocked on `vercel login`, which needs the user
- [ ] URL added to README.md and PLAN.md, pushed

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
| D22 | Day 5 (go live) moved ahead of Day 6 (the screen) | Nothing had ever met a real model before 09-05, and the run configs still said MODEL_ID_TBD. Building a UI on top of a pipeline that has never seen a real reply risks discovering the real failure modes after the screen is built around the wrong assumptions. Go live first, build the screen around what was actually learned |
| D23 | `npm run models` writes its findings to docs/free-models.md instead of leaving them in a terminal | The choice of model has to be evidence in the repository, not a decision made and forgotten in a session. The file states plainly that it is a snapshot and should be regenerated before being relied on again |
| D24 | The first two models tried (`google/gemma-4-31b-it:free`, `z-ai/glm-5.2:free`) both hit `limit_source: upstream_provider_shared_pool` — the free tier of a given model saturated across all OpenRouter users, not our own account's 20/min or 50/day cap | Recorded rather than retried silently: a free model can be unusable at a given moment for reasons outside this project entirely, and the run file and docs/free-models.md both say so |
| D25 | The first fully successful live run surfaced a real contract violation the mock cannot: two of three judges exceeded the 300-500 word opinion range (580 and 617 words) | This is now first-hand evidence for Day 4's verification gates, not a hypothetical. It was recorded, not fixed — fixing it is a gate's job, not a run's |
| D26 | `npm run models` now reads its own prior output and reattaches everything from the `## Live attempts` heading onward before writing the fresh report | Re-running it on 09-06 to refresh the snapshot silently deleted the 09-05 attempt history, since the script always wrote the whole file. The generated table still regenerates in full; only the hand-maintained section survives |
| D27 | Mode B failing twice was committed as evidence rather than treated as a blocker to route around with a third attempt | The instruction was to try once more and then stop regardless of outcome, and the absence of a completed mode B run is itself the finding: a run with seven independent free models is more exposed to any one of them being unavailable than a run with one model repeated seven times |
| D28 | docs/mode-a-vs-b.md states outright that one run of mode A and two attempts at mode B is an anecdote, and names the one narrower claim the evidence does support | A comparison document that lets a single run imply a general property of single- vs multi-model orchestration would be worse than no comparison at all |
| D29 | Both run configs moved to paid models on 09-06; docs/free-models.md renamed to docs/models.md and opened with why, not just relisted as evidence | The free tier could not sustain even one full mode B run across two attempts. The file is renamed rather than superseded by a new one because the full attempt history is the evidence for the decision, and it needed to stay attached to the decision it justifies |
| D30 | `npm run models` now preserves two hand-maintained zones across regeneration — the opening rationale above the table and the attempt history below it — not only the trailing one as before | The rename added a second manual section above the generated table. The same class of bug the 09-06 fix addressed (silent overwrite) would otherwise have recurred immediately on the next regeneration |
| D31 | When mode B's first paid attempt hit a new failure kind (the OpenRouter key's own spending cap), the agent stopped and asked rather than retrying | A retry without the user raising the limit was likely to fail again or worse, since the successful concurrent calls had already drawn the balance down. Spending more real money on a predictable repeat failure is not a call to make unilaterally |
| D32 | The 300-500 word judge contract has now been missed low, low, on-target, and high across four judge calls in two paid runs, plus one advocate miss (grey_worm, under its floor) in the same run mode B finally succeeded in | Recorded as a third data point per instruction; nothing changed in the prompts or a gate in response. Whether the fix belongs in the gate, the prompts, or both is still an open question for Day 4, now with more evidence behind it |
| D33 | The web app renders committed runs from `runs/`; it never triggers a live deliberation | A live run takes 56-96s and Vercel's free serverless functions time out at 60s. A screen that triggered one would fail intermittently on mode B and spend real money on every click. CLAUDE.md's original "one serverless function runs the deliberation" was corrected to match, not left standing alongside code that contradicts it |
| D34 | Zero-config Vercel layout: `public/` for the static page, one function at `api/runs.ts`, `vercel.json` only for `includeFiles` | No framework, no bundler, no build script — matches "styling minimal, don't spend effort there." `includeFiles: "runs/**"` is the one non-default setting needed, since the function's directory doesn't include `runs/` by default |
| D35 | `api/runs.ts` validates the `id` query parameter against the exact pattern `runId()` produces before it ever reaches a file path | Closes path traversal without needing a dependency; an id that doesn't match the pattern a run could actually have is rejected with 400 before any filesystem call |
| D36 | The three opinions are sorted by agent id (alphabetical: barak, elon, shamgar) in the frontend rather than trusting the JSON key order as-is | Belt and suspenders on the same fixed-order rule the backend already gives structurally: explicit, verifiable sort code makes "not sorted by verdict" true by construction, not by accident of object key insertion order |
| D37 | Verified the frontend in an actual headless browser (Playwright, temporarily installed with `--no-save`, package-lock.json reverted after) against a throwaway local harness that runs the real `api/runs.ts` handler — not just by reading the code | `vercel dev` requires an authenticated CLI session, which wasn't available yet at this point in the build. The harness let the real handler and real committed run files be exercised end to end, screenshots included, without needing that login or touching any committed file |

## Open questions
- [x] OpenRouter account — created, key in .env.local, first live run committed.
- [x] GitHub repository — created, remote added, pushed.
- [x] Which free models on OpenRouter are currently available and adequate —
      answered and then superseded. Availability was volatile enough (three
      distinct failure kinds across four live choices, mode B never reaching
      the judges in two attempts) that the project moved to paid models on
      09-06. See docs/models.md, "Why this project moved off the free tier."
- [x] Whether a third free-tier attempt at mode B on a calmer moment would
      succeed — closed without testing, superseded by the move to paid
      models rather than answered directly.
- [x] Whether the seven models chosen for mode B's second free-tier attempt
      were a fair test — closed for the same reason: moot once the free tier
      itself was abandoned rather than one selection within it.
- [ ] Whether the two judges that overran the 300-500 word opinion range on
      09-05 do so consistently or only that once — Day 4's gates need to
      catch it either way, but it affects whether prompt wording (not just
      the gate) is worth revisiting. Still open with paid models: nothing
      about switching provider fixes a contract the models aren't held to.
- [x] What mode A and mode B cost against paid models — mode A $0.013167
      (09-06, openai/gpt-5-nano, all seven seats); mode B $0.025956 (09-07,
      seven distinct models, roughly double mode A's, over half of it one
      call: judge_elon_model on claude-haiku-4.5). See docs/models.md and
      docs/mode-a-vs-b.md's completed paid comparison.
- [x] Whether mode B can reach the judges at all, on any tier — yes, once,
      on 09-07, after two prior live failures (free-tier unavailability on
      09-06, the OpenRouter key's own spending cap earlier on 09-07). Mode
      B's honest record is one success in three live attempts across two
      days.
- [ ] Deploying to Vercel needs an authenticated CLI session. `vercel whoami`
      returns "Logged out" as of 09-07. Steps 1-4 of the web app (scaffold,
      backend, frontend, local verification) are done and committed; step 5
      (deploy) is blocked on the user running `vercel login` themselves — an
      interactive browser flow the agent cannot complete on their behalf.

## Out of scope, on purpose
Database, authentication, a form for entering new cases, a "past cases" page,
visual polish, prompt caching, multi-case architecture. None of it is graded.

## Log
- 2026-09-07 (later) — Day 6 started: the web app. Corrected CLAUDE.md, which
  still said one serverless function runs the deliberation — no longer true,
  now that a live run's 56-96s exceeds Vercel's 60s free-function timeout.
  Scaffolded a zero-config layout: public/ for a plain HTML/CSS/JS page, one
  function at api/runs.ts that only reads a committed run file and never
  imports provider code or touches the API key. Built the frontend to mirror
  src/protocol.ts's structure — advocates in prompt-file order, the three
  opinions as siblings sorted by agent id with a fixed-order, not-combined
  notice directly above them, a failed or not_run seat rendering its own
  card with the real failure reason, never dropped. Verified end to end in
  an actual headless browser (Playwright, installed temporarily, reverted
  after) against a throwaway local harness running the real handler and the
  real committed run files, not just by reading the code: default selection
  correctly lands on the 09-07 mode B complete run, the not-combined notice
  is present, switching to the 09-07 payment-cap-failure run correctly
  renders all 4 affected seats as failure cards with nothing substituted,
  zero console errors. Stopped before deploying, as instructed: `vercel
  whoami` returns "Logged out" — that step needs the user to run
  `vercel login` themselves.
- 2026-09-07 — Mode B run live against the seven paid models. First attempt
  failed before the judges could sit: the OpenRouter key's own spending cap
  rejected tyrion_lannister's call (openai/gpt-5.4-mini) with HTTP 402 —
  a third, new failure kind, this time on our own account rather than a
  model. Recorded as evidence, then stopped and asked rather than retrying,
  since a retry was likely to repeat the failure or worsen it. The user
  raised the key's limit; the retry succeeded completely — first time mode
  B has ever produced three opinions. All three verdicts matched mode A's
  09-06 run (not_justified). docs/mode-a-vs-b.md's final section, left
  explicitly open until now, is complete: verdicts, opinion alikeness, word
  counts, tokens, real cost ($0.025956, roughly double mode A's), wall-clock
  time (96.3s vs mode A's 56.2s), and failures, all under the same
  "anecdote, not a result" framing as the free-tier comparison above it.
  Word-count contract missed three different ways in this one run: an
  advocate under its floor for the first time, one judge over its ceiling
  and fenced, two judges in range — recorded, nothing changed per
  instruction. Mode B's honest record: one success in three live attempts
  across two days.
- 2026-09-06 (later) — Moved off the free tier. Two mode B attempts had
  already shown it couldn't sustain a run; renamed docs/free-models.md to
  docs/models.md and opened it with why, keeping the full attempt history as
  the evidence for the decision. npm run models extended to preserve two
  hand-maintained zones across regeneration instead of one, and verified by
  re-running it. Both configs switched to paid models: mode A to
  openai/gpt-5-nano across all seven seats; mode B to seven distinct paid
  models, pairing the three judges — who read the most — with the more
  capable ones. Before spending anything, proved the budget guard: same
  seven-seat mock run priced identically under two configs differing only
  in max_usd_per_run, one exited 1 over budget, the other 0 — isolating
  budget as the one variable, not a run failure. Two permanent checks added
  to npm run smoke for it (57 total). Then ran mode A live, once, for real
  money: $0.013167 for 49,515 tokens, all seven seats clean, budget not
  exceeded. One new contract deviation — all three judges came in under the
  300-500 word floor this time, the mirror of nemotron's overrun on 09-05.
  Mode B not run this turn, by instruction, pending review of this cost.
- 2026-09-06 — Mode B run live for the first time: the graded requirement
  that the model behind each of the seven seats can differ. `npm run models`
  re-run to refresh the snapshot first, which exposed and then fixed a bug —
  the script had been silently discarding its own manually-maintained
  history on every regeneration; restored the 09-05 entries and made the
  script preserve that section going forward. config/run-multi.yaml filled
  with seven distinct free model ids, one per seat. Attempt 1 lost 3 of 4
  advocates (two upstream 429s, one call that never returned and was
  aborted on the 120s timeout); attempt 2, seven entirely different model
  ids per instruction, lost 2 of 4 advocates to a new failure kind — an
  access-tier 403 from both ThinkingMachines models, gated away from a
  plain chat request despite being listed free. Both attempts stopped
  before the judges could sit, since the protocol requires all four
  arguments; per instruction, no third attempt was made. Both runs
  committed as evidence regardless of the incomplete result, and both
  logged in docs/free-models.md. docs/mode-a-vs-b.md written comparing the
  09-05 mode A run against both mode B attempts: it states plainly that
  mode B produced no opinions to compare, that one run each is an anecdote,
  and names the one claim the evidence does support without generalising
  further. ~8 live calls spent today, against a 21-call ceiling.
- 2026-09-05 — Day 5 moved ahead of Day 4 and Day 6, and done: nothing had met
  a real model before today. `npm run models` queried OpenRouter live (424
  models scanned, 21 clear the free + >=32k-context filter) and wrote
  docs/free-models.md as the evidence for model choice. Three models were
  tried against mode A, in order, each committed: google/gemma-4-31b-it:free
  (all 7 calls hit an upstream shared-pool 429), z-ai/glm-5.2:free (3 of 4
  advocates hit the same kind of 429, but tyrion_lannister returned a real,
  fenced-JSON reply that the orchestrator recovered), and
  nvidia/nemotron-3-super-120b-a12b:free (all 7 seats succeeded — the first
  fully successful live run). The successful run also surfaced the first real
  contract violation the mock could never produce: two of three judges wrote
  opinions well outside the stated 300-500 word range. Nothing was fixed; it
  was recorded as evidence for Day 4's gates. config/run-single.yaml now
  points at the model that succeeded.
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
