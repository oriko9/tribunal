# The Tribunal

ASE-26 running project. A seven-agent deliberation over one fixed case.

Four advocates (two defence, two prosecution) each produce an independent
argument from the charge sheet. Three judges, each modelled on a distinct
judicial method, then read the charge sheet and all four arguments and each
produce an opinion. The three opinions are reported side by side and are never
combined into a single verdict.

## Live

**https://tribunal-green.vercel.app** — pick a committed run, press the
button. It reads a run already committed to `runs/`; it never triggers a
live deliberation. A live run takes 56-96s and Vercel's free serverless
functions time out at 60s, so a click-to-run screen would fail
intermittently and spend real money on every click. See
`docs/mode-a-vs-b.md` for why, and `api/runs.ts` for the one function this
site calls — it only reads a run file and never touches the OpenRouter key.

## What to open first

To judge this work without running anything: **`docs/LESSONS.md`**. It is
the evidence this project actually produced — four real failure kinds no
mock predicted, mode B's one-success-in-three live record, the word-count
contract missed in both directions and a prompt change that didn't
measurably fix it, and why the gates separate a failure from a deviation
instead of collapsing them. Every claim in it points at a run file or a
number already committed. From there:

- `specs/charge-sheet.yaml` — requirement #1, the case as a specification.
- `prompts/**/*.yaml` and `docs/PROMPT-CHANGELOG.md` — requirement #2, the
  seven agent prompts and why each version changed.
- Any `runs/<id>.md` — a full protocol, three opinions side by side,
  requirement #3. `runs/2026-09-07T09-59-57-177Z.md` is the one complete
  mode B run, all seven seats on distinct models.
- `config/run-single.yaml` vs `config/run-multi.yaml` — requirement #4, one
  model versus seven, the progression the course asks to see.
- `PLAN.md` — the day-by-day log and every decision taken, with why.

## The case
T-001, The Realm v. Jon Snow. See `specs/charge-sheet.yaml` — the charge sheet
is a structured specification, not prose, and it is the only source of
established fact in the system.

## Layout
    specs/     the charge sheet specification
    prompts/   the seven agent prompts, versioned
    config/    run configurations (single-model and multi-model)
    runs/      committed output of each run: protocol, verdicts, cost
    docs/      decisions, prompt changelog, lessons learned
    api/       the one serverless function: reads a committed run, nothing else
    public/    the read-only web page

## Running it
    cp .env.local.example .env.local     # git-ignored; loaded automatically
    npm install
    npm run smoke                        # free verification gate, calls no model
    npm run tribunal -- single           # or: -- multi

Without a key the run uses the mock provider: synthetic replies, nothing spent.
To run against real models, paste an OpenRouter key into `OPENROUTER_API_KEY` in
`.env.local` and set `TRIBUNAL_PROVIDER=openrouter`. The key is read on the
server only and never reaches the browser. Every variable is documented in
`.env.local.example`.

Every reply is checked against two verification gates (`src/gates.ts`): its
own contract's word ranges, step counts and factor completeness (a
DEVIATION — recorded and shown, never a failure), and that every fact
identifier it cites actually exists in the charge sheet (a FAILURE if not —
this is not a result). `npm run verify-runs` re-applies both gates to every
already-committed run in `runs/` without rewriting any of them, and is how
they were proven against real data rather than only synthetic fixtures.

## Status
All seven days done. See `PLAN.md` for the day-by-day record and every
decision taken, and `docs/LESSONS.md` for what the project actually taught.
