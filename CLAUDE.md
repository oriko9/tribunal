# CLAUDE.md — context for the agent working on this repository

## What this project is
The Tribunal: a multi-agent application for the ASE-26 running project.
Seven LLM agents deliberate one fixed case (T-001, The Realm v. Jon Snow) and
produce three independent judicial opinions that are shown side by side and are
never combined.

## What the course grades
Not the app. The course grades how the agent was directed, and only what can be
opened and verified in this repository. Four requirements are specific to this
project and outrank everything else:

1. The charge sheet is written as a specification, not free text. -> specs/charge-sheet.yaml
2. The seven agent prompts are written and versioned. -> prompts/**/*.yaml
3. The protocol reports three verdicts side by side, without combining them.
4. The progression from one model toward several is visible. -> config/run-*.yaml

Everything else (UI polish, database, auth, extra pages) is out of scope and
earns nothing.

## Hard rules for any agent working here
- Prompts are code. Never edit a prompt file without bumping its `version` and
  recording the change in docs/PROMPT-CHANGELOG.md.
- Never merge, average, rank or summarise the three judicial opinions. Three
  opinions in, three opinions out.
- The seat an advocate holds fixes only their procedural role. It must never fix
  their conclusion. Do not write "you must argue that Jon is innocent".
- Nothing outside specs/charge-sheet.yaml `agreed_facts` may be treated as
  established fact by any agent.
- A model failure must surface as a visible failure, never as a result.
- The OpenRouter API key lives on the server only. It never reaches the browser.
- Most of this system is plain code. The model is called exactly seven times per
  run, from exactly two entry points: the CLI (`src/cli.ts`) and the live-run
  endpoint (`api/live-seat.ts`), both calling the same `callAgent` — never
  anywhere else.

## Stack
TypeScript, deployed on Vercel. No database: each run of the CLI is written
to runs/<timestamp>.json (and a matching .md protocol) and committed — this
remains the only record.

A full deliberation takes 56-96s depending on mode, and Vercel's free
serverless functions time out at 60s, so a screen that triggered one long
call on a click would fail intermittently and spend real money on every
attempt. Two paths exist because of that constraint, and they answer to
different requirements:

- **The archive** (`api/runs.ts`, one function). Deliberation runs from the
  CLI (`npm run tribunal`) and its output is committed before anyone can view
  it. `api/runs.ts` only reads an already-committed run file and returns it;
  it never calls a model and never touches the OpenRouter key.
- **The live run** (`api/live-seat.ts`, mode A only). One serverless
  invocation per seat — comfortably under the 60s limit, since every live
  mode A call has run in 5-33s — orchestrated from the browser: four
  advocates in parallel, then, only if all four succeed, three judges in
  parallel. The key is read only inside this function. Nothing it produces
  is written to `runs/`; it renders in the browser and is gone. Because each
  invocation is stateless, the judge phase reads advocate text relayed back
  by the browser rather than held in memory for the whole run the way the
  CLI holds it — an explicit, documented trust boundary (see the comment in
  `api/live-seat.ts` and the note on the page itself), which is exactly why
  the committed archive, not a live run, remains the record.

## Working discipline
- Commit before invoking the agent on a task, and after.
- Atomic commits, honest messages. No single squashed "final" commit.
- PLAN.md is updated in the same turn as the work, never afterwards. It is the
  single source of truth for project status; see the note at the top of it.
