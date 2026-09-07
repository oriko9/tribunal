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

## Status
Work in progress. See PLAN.md.
